import {useEffect, useRef} from 'react';
import {COMPASS} from '../constants';
import {compassService} from '../services/compass/CompassService';
import {headingDelta} from '../utils/geo';
import {useGpsStore} from '../store/gpsStore';

/**
 * Subscribes to heading updates while `active`. Sub-degree jitter is filtered
 * out so the HUD does not re-render on sensor noise.
 */
export function useCompassTracking(active: boolean, enabled: boolean): void {
  const lastHeading = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !enabled) {
      compassService.stop();
      return;
    }

    let cancelled = false;

    const unsubscribe = compassService.onReading(reading => {
      const previous = lastHeading.current;
      if (previous !== null && headingDelta(previous, reading.heading) < COMPASS.MIN_DELTA_DEG) {
        return;
      }
      lastHeading.current = reading.heading;
      useGpsStore.getState().setCompass(reading);
    });

    void compassService.isAvailable().then(available => {
      if (cancelled) {
        return;
      }
      useGpsStore.getState().setCompassAvailable(available);
      if (available) {
        compassService.start();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
      compassService.stop();
      lastHeading.current = null;
    };
  }, [active, enabled]);
}
