import type {GeocodeResult, PostalAddress} from '../../types';

/**
 * Reverse geocoding contract. The default implementation is the on-device
 * Android Geocoder; swapping in a hosted service later means implementing this
 * interface only — no screen or store touches the provider directly.
 */
export interface ReverseGeocodeProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  reverse(latitude: number, longitude: number): Promise<PostalAddress | null>;
}

export interface GeocodingApi {
  lookup(latitude: number, longitude: number): Promise<GeocodeResult>;
  peekCached(latitude: number, longitude: number): GeocodeResult | null;
  clearCache(): void;
}
