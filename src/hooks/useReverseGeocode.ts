import {useEffect, useRef} from 'react';
import {geocodingService} from '../services/geocoding/GeocodingService';
import {useGpsStore} from '../store/gpsStore';

/**
 * Resolves an address for the current fix.
 *
 * The service refuses lookups that are too frequent or too close to the
 * previous one, so at most one runs at a time. Its result is always stored,
 * even if the fix has jittered or the screen lost focus meanwhile: dropping it
 * would leave the HUD on "Resolving address…" with no retry, because the rate
 * limit blocks a new lookup until the user moves on. The result carries its
 * own coordinates, so consumers can tell how far away it was resolved.
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
      .then(result => useGpsStore.getState().setGeocode(result))
      .finally(() => {
        inFlight.current = false;
      });
  }, [active, enabled, latitude, longitude]);
}
