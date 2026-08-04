import NativeGpsGeocoder from '../../specs/NativeGpsGeocoder';
import type {PostalAddress} from '../../types';
import {log} from '../../utils/logger';
import type {ReverseGeocodeProvider} from './types';

type Raw = Record<string, unknown>;

function str(raw: Raw, key: string): string | null {
  const value = raw[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * On-device reverse geocoding via android.location.Geocoder. Keeps location
 * data on the handset: no coordinates are sent to any Anthropic or third-party
 * server by this app.
 */
export class AndroidGeocoderProvider implements ReverseGeocodeProvider {
  readonly name = 'android-platform-geocoder';

  async isAvailable(): Promise<boolean> {
    try {
      return await NativeGpsGeocoder.isPresent();
    } catch (error) {
      log.warn('AndroidGeocoderProvider', 'isPresent failed', error);
      return false;
    }
  }

  async reverse(latitude: number, longitude: number): Promise<PostalAddress | null> {
    const raw = (await NativeGpsGeocoder.reverseGeocode(latitude, longitude)) as Raw;
    if (!raw || raw.ok !== true) {
      return null;
    }
    return {
      featureName: str(raw, 'featureName'),
      street: str(raw, 'street'),
      subLocality: str(raw, 'subLocality'),
      locality: str(raw, 'locality'),
      subAdminArea: str(raw, 'subAdminArea'),
      adminArea: str(raw, 'adminArea'),
      postalCode: str(raw, 'postalCode'),
      countryName: str(raw, 'countryName'),
      countryCode: str(raw, 'countryCode'),
      formatted: str(raw, 'formatted'),
    };
  }
}
