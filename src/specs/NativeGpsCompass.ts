import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/** Rotation-vector (or accelerometer+magnetometer fallback) compass bridge. */
export interface Spec extends TurboModule {
  isAvailable(): Promise<boolean>;
  /** Emits `GpsCompass:heading` device events, throttled to intervalMs. */
  start(intervalMs: number): void;
  stop(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GpsCompass');
