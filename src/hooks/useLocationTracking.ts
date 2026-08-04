import {useEffect, useRef} from 'react';
import type {GpsFix} from '../types';
import {GPS} from '../constants';
import {locationService} from '../services/location/LocationService';
import {useGpsStore} from '../store/gpsStore';
import {useSettingsStore} from '../store/settingsStore';

/**
 * Streams positions while `active` is true.
 *
 * Updates arrive as often as once per second; committing each one to the store
 * would re-render the whole HUD, so the newest fix is buffered in a ref and
 * flushed on a fixed interval. The buffer always holds the freshest value, so
 * throttling never costs accuracy — only render frequency.
 */
export function useLocationTracking(active: boolean, hasPermission: boolean): void {
  const highAccuracy = useSettingsStore(state => state.settings.highAccuracyGps);
  const pending = useRef<GpsFix | null>(null);
  const firstFixTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const store = useGpsStore.getState();

    if (!active) {
      locationService.stop();
      return;
    }
    if (!hasPermission) {
      store.setPhase('permission-denied');
      locationService.stop();
      return;
    }

    let cancelled = false;
    let flushTimer: ReturnType<typeof setInterval> | null = null;

    const start = async (): Promise<void> => {
      const status = await locationService.getProviderStatus();
      if (cancelled) {
        return;
      }
      useGpsStore.getState().setProviders(status);
      if (!status.anyEnabled) {
        useGpsStore.getState().setPhase('disabled');
        return;
      }

      useGpsStore.getState().setPhase('searching');

      // Seed the HUD with the last known position so the user is not staring at
      // an empty panel; it is clearly superseded by the first live fix.
      const last = await locationService.getLastKnown();
      if (!cancelled && last.ok && !useGpsStore.getState().gps.fix) {
        pending.current = last.value;
      }

      locationService.start(highAccuracy);

      firstFixTimer.current = setTimeout(() => {
        const state = useGpsStore.getState();
        if (state.gps.phase === 'searching') {
          state.setPhase('timeout');
        }
      }, GPS.SEARCH_TIMEOUT_MS);

      flushTimer = setInterval(() => {
        const fix = pending.current;
        if (fix) {
          pending.current = null;
          useGpsStore.getState().setFix(fix);
        }
      }, GPS.UI_THROTTLE_MS);
    };

    const unsubscribeUpdate = locationService.onUpdate(fix => {
      pending.current = fix;
      if (firstFixTimer.current) {
        clearTimeout(firstFixTimer.current);
        firstFixTimer.current = null;
      }
      // First fix is committed immediately; later ones ride the flush interval.
      if (!useGpsStore.getState().gps.fix) {
        pending.current = null;
        useGpsStore.getState().setFix(fix);
      }
    });

    const unsubscribeError = locationService.onError((code, message) => {
      const phase =
        code === 'PROVIDER_DISABLED'
          ? 'disabled'
          : code === 'PERMISSION_DENIED'
            ? 'permission-denied'
            : 'error';
      useGpsStore.getState().setPhase(phase, code, message);
    });

    const unsubscribeProvider = locationService.onProviderChange(status => {
      const state = useGpsStore.getState();
      state.setProviders(status);
      if (!status.anyEnabled) {
        state.setPhase('disabled');
      } else if (state.gps.phase === 'disabled') {
        state.setPhase('searching');
        locationService.start(highAccuracy);
      }
    });

    void start();

    return () => {
      cancelled = true;
      unsubscribeUpdate();
      unsubscribeError();
      unsubscribeProvider();
      if (flushTimer) {
        clearInterval(flushTimer);
      }
      if (firstFixTimer.current) {
        clearTimeout(firstFixTimer.current);
        firstFixTimer.current = null;
      }
      pending.current = null;
      locationService.stop();
    };
  }, [active, hasPermission, highAccuracy]);
}
