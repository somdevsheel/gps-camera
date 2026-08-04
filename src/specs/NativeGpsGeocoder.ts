import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';
import type {UnsafeObject} from 'react-native/Libraries/Types/CodegenTypes';

/** Platform reverse geocoding (android.location.Geocoder). No third-party servers. */
export interface Spec extends TurboModule {
  isPresent(): Promise<boolean>;
  /** Resolves {ok:boolean, ...addressFields}. Never rejects on "no result". */
  reverseGeocode(latitude: number, longitude: number): Promise<UnsafeObject>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GpsGeocoder');
