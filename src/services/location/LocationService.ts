import {DeviceEventEmitter} from 'react-native';
import NativeGpsLocation from '../../specs/NativeGpsLocation';
import type {GpsFix, LocationProviderName, ProviderStatus, ServiceResult} from '../../types';
import {EVENTS, GPS} from '../../constants';
import {fail, fromError, ok, withTimeout} from '../../utils/result';
import {isValidCoordinate} from '../../utils/geo';
import {log} from '../../utils/logger';
import type {
  LocationErrorListener,
  LocationProvider,
  LocationUpdateListener,
  ProviderListener,
} from './types';

type RawFix = Record<string, unknown>;

function num(raw: RawFix, key: string): number | null {
  const value = raw[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function bool(raw: RawFix, key: string): boolean {
  return raw[key] === true;
}

/**
 * Converts a native payload into a GpsFix. Returns null for anything that is
 * not a real, plausible position — we never fabricate or interpolate values.
 */
export function parseFix(raw: unknown): GpsFix | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as RawFix;
  if (obj.ok === false) {
    return null;
  }
  const latitude = num(obj, 'latitude');
  const longitude = num(obj, 'longitude');
  if (latitude === null || longitude === null || !isValidCoordinate(latitude, longitude)) {
    return null;
  }
  const providerRaw = typeof obj.provider === 'string' ? obj.provider : 'unknown';
  const provider: LocationProviderName =
    providerRaw === 'gps' ||
    providerRaw === 'network' ||
    providerRaw === 'passive' ||
    providerRaw === 'fused'
      ? providerRaw
      : 'unknown';

  return {
    latitude,
    longitude,
    accuracy: num(obj, 'accuracy'),
    altitude: num(obj, 'altitude'),
    altitudeAccuracy: num(obj, 'altitudeAccuracy'),
    speed: num(obj, 'speed'),
    bearing: num(obj, 'bearing'),
    gpsTimestamp: num(obj, 'gpsTimestamp') ?? Date.now(),
    receivedAt: Date.now(),
    provider,
    isCoarse: bool(obj, 'isCoarse'),
    mocked: bool(obj, 'mocked'),
  };
}

function parseProviderStatus(raw: unknown): ProviderStatus {
  const obj = (raw ?? {}) as RawFix;
  const gpsEnabled = bool(obj, 'gpsEnabled');
  const networkEnabled = bool(obj, 'networkEnabled');
  const passiveEnabled = bool(obj, 'passiveEnabled');
  return {
    gpsEnabled,
    networkEnabled,
    passiveEnabled,
    anyEnabled: gpsEnabled || networkEnabled || passiveEnabled,
  };
}

class AndroidLocationService implements LocationProvider {
  private running = false;

  async isEnabled(): Promise<boolean> {
    try {
      return await NativeGpsLocation.isLocationEnabled();
    } catch (error) {
      log.warn('LocationService', 'isLocationEnabled failed', error);
      return false;
    }
  }

  async getProviderStatus(): Promise<ProviderStatus> {
    try {
      return parseProviderStatus(await NativeGpsLocation.getProviderStatus());
    } catch (error) {
      log.warn('LocationService', 'getProviderStatus failed', error);
      return {
        gpsEnabled: false,
        networkEnabled: false,
        passiveEnabled: false,
        anyEnabled: false,
      };
    }
  }

  start(highAccuracy: boolean): void {
    if (this.running) {
      return;
    }
    try {
      NativeGpsLocation.startUpdates({
        highAccuracy,
        intervalMs: GPS.UPDATE_INTERVAL_MS,
        minDistanceM: GPS.MIN_DISTANCE_M,
      });
      this.running = true;
    } catch (error) {
      log.error('LocationService', 'startUpdates failed', error);
    }
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    try {
      NativeGpsLocation.stopUpdates();
    } catch (error) {
      log.warn('LocationService', 'stopUpdates failed', error);
    } finally {
      this.running = false;
    }
  }

  /**
   * Requests a fix acquired at (or very near) call time. Used by verified
   * capture so a stale cached position can never be stamped as fresh.
   */
  async getFreshFix(
    timeoutMs: number,
    highAccuracy: boolean,
  ): Promise<ServiceResult<GpsFix>> {
    try {
      const raw = await withTimeout(
        NativeGpsLocation.getCurrentPosition({
          timeoutMs,
          maximumAgeMs: GPS.CAPTURE_MAX_AGE_MS,
          highAccuracy,
        }),
        timeoutMs + 1500,
        'GPS_TIMEOUT',
      );
      const fix = parseFix(raw);
      return fix ? ok(fix) : fail('GPS_NO_FIX', 'No usable position was returned.');
    } catch (error) {
      return fromError('LocationService.getFreshFix', error, 'GPS_TIMEOUT');
    }
  }

  async getLastKnown(): Promise<ServiceResult<GpsFix>> {
    try {
      const fix = parseFix(await NativeGpsLocation.getLastKnownPosition());
      return fix ? ok(fix) : fail('GPS_NO_FIX', 'No cached position available.');
    } catch (error) {
      return fromError('LocationService.getLastKnown', error, 'GPS_ERROR');
    }
  }

  openSettings(): void {
    try {
      NativeGpsLocation.openLocationSettings();
    } catch (error) {
      log.warn('LocationService', 'openLocationSettings failed', error);
    }
  }

  onUpdate(listener: LocationUpdateListener): () => void {
    const sub = DeviceEventEmitter.addListener(EVENTS.locationUpdate, (raw: unknown) => {
      const fix = parseFix(raw);
      if (fix) {
        listener(fix);
      }
    });
    return () => sub.remove();
  }

  onError(listener: LocationErrorListener): () => void {
    const sub = DeviceEventEmitter.addListener(EVENTS.locationError, (raw: unknown) => {
      const obj = (raw ?? {}) as RawFix;
      listener(
        typeof obj.code === 'string' ? obj.code : 'GPS_ERROR',
        typeof obj.message === 'string' ? obj.message : 'Location error',
      );
    });
    return () => sub.remove();
  }

  onProviderChange(listener: ProviderListener): () => void {
    const sub = DeviceEventEmitter.addListener(EVENTS.providerChanged, (raw: unknown) => {
      listener(parseProviderStatus(raw));
    });
    return () => sub.remove();
  }
}

export const locationService: LocationProvider = new AndroidLocationService();
