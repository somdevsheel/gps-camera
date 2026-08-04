import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';
import type {UnsafeObject} from 'react-native/Libraries/Types/CodegenTypes';

/**
 * Native location bridge backed by android.location.LocationManager.
 *
 * Deliberately does NOT depend on Google Play Services so the app works on
 * de-Googled devices and fully offline. Returned objects use an `ok` boolean
 * discriminator instead of null, keeping the codegen boundary non-nullable.
 */
export interface Spec extends TurboModule {
  /** True when at least one location provider is enabled in system settings. */
  isLocationEnabled(): Promise<boolean>;
  /** {gpsEnabled, networkEnabled, passiveEnabled, anyEnabled} */
  getProviderStatus(): Promise<UnsafeObject>;
  /** options: {highAccuracy:boolean, intervalMs:number, minDistanceM:number} */
  startUpdates(options: UnsafeObject): void;
  stopUpdates(): void;
  /** options: {timeoutMs:number, maximumAgeMs:number, highAccuracy:boolean} */
  getCurrentPosition(options: UnsafeObject): Promise<UnsafeObject>;
  getLastKnownPosition(): Promise<UnsafeObject>;
  openLocationSettings(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GpsLocation');
