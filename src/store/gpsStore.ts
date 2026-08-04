import {create} from 'zustand';
import type {
  CompassReading,
  GeocodeResult,
  GpsFix,
  GpsPhase,
  GpsState,
  PermissionSnapshot,
  ProviderStatus,
} from '../types';
import {qualityFromAccuracy} from '../utils/geo';

const INITIAL_GPS: GpsState = {
  phase: 'idle',
  fix: null,
  quality: 'none',
  message: 'Starting GPS…',
  errorCode: null,
};

const PHASE_MESSAGES: Record<GpsPhase, string> = {
  idle: 'Starting GPS…',
  searching: 'Finding GPS…',
  ready: 'GPS ready',
  disabled: 'Location is turned off',
  'permission-denied': 'Location permission denied',
  timeout: 'Weak GPS signal — move to an open area',
  unavailable: 'Location unavailable',
  error: 'Location error',
};

interface GpsStoreState {
  gps: GpsState;
  compass: CompassReading | null;
  compassAvailable: boolean;
  geocode: GeocodeResult | null;
  providers: ProviderStatus | null;
  permissions: PermissionSnapshot | null;
  setFix: (fix: GpsFix) => void;
  setPhase: (phase: GpsPhase, errorCode?: string | null, message?: string) => void;
  setCompass: (reading: CompassReading | null) => void;
  setCompassAvailable: (available: boolean) => void;
  setGeocode: (result: GeocodeResult | null) => void;
  setProviders: (status: ProviderStatus) => void;
  setPermissions: (snapshot: PermissionSnapshot) => void;
  resetLocation: () => void;
}

export const useGpsStore = create<GpsStoreState>(set => ({
  gps: INITIAL_GPS,
  compass: null,
  compassAvailable: false,
  geocode: null,
  providers: null,
  permissions: null,

  setFix: fix =>
    set({
      gps: {
        phase: 'ready',
        fix,
        quality: qualityFromAccuracy(fix.accuracy),
        message: PHASE_MESSAGES.ready,
        errorCode: null,
      },
    }),

  setPhase: (phase, errorCode = null, message) =>
    set(state => ({
      gps: {
        ...state.gps,
        phase,
        // A previously acquired fix stays visible while we re-acquire, but it is
        // dropped outright when location becomes unusable.
        fix: phase === 'permission-denied' || phase === 'disabled' ? null : state.gps.fix,
        quality: phase === 'ready' ? state.gps.quality : 'none',
        message: message ?? PHASE_MESSAGES[phase],
        errorCode,
      },
    })),

  setCompass: reading => set({compass: reading}),
  setCompassAvailable: available => set({compassAvailable: available}),
  setGeocode: result => set({geocode: result}),
  setProviders: status => set({providers: status}),
  setPermissions: snapshot => set({permissions: snapshot}),
  resetLocation: () => set({gps: INITIAL_GPS, geocode: null, compass: null}),
}));
