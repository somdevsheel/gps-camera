import {useEffect, useRef} from 'react';
import {geocodingService} from '../services/geocoding/GeocodingService';
import {useGpsStore} from '../store/gpsStore';

/**
 * Resolves an address for the current fix.
 *
 * Guarded twice over: the service refuses lookups that are too frequent or too
 * close to the previous one, and this hook drops results that arrive after the
 * user has already moved on (or the screen unmounted).
 */
export function useReverseGeocode(active: boolean, enabled: boolean): void {
  const fix = useGpsStore(state => state.gps.fix);
  const inFlight = useRef(false);

  const latitude = fix?.latitude ?? null;
  const longitude = fix?.longitude ?? null;

  useEffect(() => {
    if (!active || !enabled || latitude === null || longitude === null) {
      return;
    }

    const cached = geocodingService.peekCached(latitude, longitude);
    if (cached) {
      useGpsStore.getState().setGeocode(cached);
      return;
    }
    if (inFlight.current || !geocodingService.shouldLookup(latitude, longitude)) {
      return;
    }

    let cancelled = false;
    inFlight.current = true;
    useGpsStore.getState().setGeocode({
      status: 'loading',
      address: null,
      latitude,
      longitude,
      resolvedAt: Date.now(),
    });

    geocodingService
      .lookup(latitude, longitude)
      .then(result => {
        if (!cancelled) {
          useGpsStore.getState().setGeocode(result);
        }
      })
      .finally(() => {
        inFlight.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [active, enabled, latitude, longitude]);
}
