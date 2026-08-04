import type {GeocodeResult, PostalAddress} from '../../types';
import {GEOCODE, STORAGE_KEYS} from '../../constants';
import {kv} from '../storage/kv';
import {distanceMeters} from '../../utils/geo';
import {withTimeout} from '../../utils/result';
import {log} from '../../utils/logger';
import {AndroidGeocoderProvider} from './AndroidGeocoderProvider';
import type {GeocodingApi, ReverseGeocodeProvider} from './types';

interface CacheEntry {
  key: string;
  latitude: number;
  longitude: number;
  address: PostalAddress;
  resolvedAt: number;
}

function cacheKey(latitude: number, longitude: number): string {
  const p = GEOCODE.CACHE_PRECISION;
  return `${latitude.toFixed(p)},${longitude.toFixed(p)}`;
}

/**
 * Caches and rate-limits reverse geocoding.
 *
 * Two guards keep us off the geocoder on every GPS tick: an LRU keyed on
 * rounded coordinates, and a minimum-movement + minimum-interval check applied
 * by callers through `shouldLookup`.
 */
class GeocodingService implements GeocodingApi {
  private cache: CacheEntry[] = [];
  private inFlight = new Map<string, Promise<GeocodeResult>>();
  private lastLookupAt = 0;
  private lastLookupLat: number | null = null;
  private lastLookupLon: number | null = null;

  constructor(private readonly provider: ReverseGeocodeProvider) {
    this.cache = kv.getObject<CacheEntry[]>(STORAGE_KEYS.geocodeCache) ?? [];
    this.pruneExpired();
  }

  /** Callers use this to avoid geocoding on every location update. */
  shouldLookup(latitude: number, longitude: number): boolean {
    const now = Date.now();
    if (this.readCache(latitude, longitude)) {
      return false;
    }
    if (now - this.lastLookupAt < GEOCODE.MIN_INTERVAL_MS) {
      return false;
    }
    if (this.lastLookupLat !== null && this.lastLookupLon !== null) {
      const moved = distanceMeters(
        this.lastLookupLat,
        this.lastLookupLon,
        latitude,
        longitude,
      );
      if (moved < GEOCODE.MIN_MOVE_M) {
        return false;
      }
    }
    return true;
  }

  peekCached(latitude: number, longitude: number): GeocodeResult | null {
    const entry = this.readCache(latitude, longitude);
    if (!entry) {
      return null;
    }
    return {
      status: 'ok',
      address: entry.address,
      latitude: entry.latitude,
      longitude: entry.longitude,
      resolvedAt: entry.resolvedAt,
    };
  }

  async lookup(latitude: number, longitude: number): Promise<GeocodeResult> {
    const cached = this.peekCached(latitude, longitude);
    if (cached) {
      return cached;
    }

    const key = cacheKey(latitude, longitude);
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const task = this.performLookup(latitude, longitude, key).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, task);
    return task;
  }

  private async performLookup(
    latitude: number,
    longitude: number,
    key: string,
  ): Promise<GeocodeResult> {
    this.lastLookupAt = Date.now();
    this.lastLookupLat = latitude;
    this.lastLookupLon = longitude;

    const base = {latitude, longitude, resolvedAt: Date.now()};
    try {
      const available = await this.provider.isAvailable();
      if (!available) {
        return {...base, status: 'unavailable', address: null};
      }
      const address = await withTimeout(
        this.provider.reverse(latitude, longitude),
        GEOCODE.MIN_INTERVAL_MS,
        'GEOCODE_TIMEOUT',
      );
      if (!address) {
        return {...base, status: 'no-result', address: null};
      }
      this.writeCache({key, latitude, longitude, address, resolvedAt: Date.now()});
      return {...base, status: 'ok', address};
    } catch (error) {
      log.warn('GeocodingService', 'reverse geocode failed', error);
      return {...base, status: 'error', address: null};
    }
  }

  private readCache(latitude: number, longitude: number): CacheEntry | null {
    const key = cacheKey(latitude, longitude);
    const now = Date.now();
    const index = this.cache.findIndex(entry => entry.key === key);
    if (index < 0) {
      return null;
    }
    const entry = this.cache[index];
    if (!entry || now - entry.resolvedAt > GEOCODE.CACHE_TTL_MS) {
      this.cache.splice(index, 1);
      return null;
    }
    // Move-to-front keeps the LRU ordering cheap.
    this.cache.splice(index, 1);
    this.cache.unshift(entry);
    return entry;
  }

  private writeCache(entry: CacheEntry): void {
    this.cache = [entry, ...this.cache.filter(item => item.key !== entry.key)].slice(
      0,
      GEOCODE.CACHE_SIZE,
    );
    kv.setObject(STORAGE_KEYS.geocodeCache, this.cache);
  }

  private pruneExpired(): void {
    const now = Date.now();
    const next = this.cache.filter(entry => now - entry.resolvedAt <= GEOCODE.CACHE_TTL_MS);
    if (next.length !== this.cache.length) {
      this.cache = next;
      kv.setObject(STORAGE_KEYS.geocodeCache, this.cache);
    }
  }

  clearCache(): void {
    this.cache = [];
    kv.remove(STORAGE_KEYS.geocodeCache);
  }
}

export const geocodingService = new GeocodingService(new AndroidGeocoderProvider());
