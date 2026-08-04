import type {CardinalPoint, GpsFix, GpsQuality} from '../types';
import {GPS} from '../constants';

const CARDINALS: CardinalPoint[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Maps a 0-360 heading onto the 8-point compass rose. */
export function headingToCardinal(heading: number): CardinalPoint {
  const normalized = normalizeHeading(heading);
  const index = Math.round(normalized / 45) % 8;
  return CARDINALS[index] ?? 'N';
}

export function normalizeHeading(heading: number): number {
  const value = heading % 360;
  return value < 0 ? value + 360 : value;
}

/** Smallest signed angular difference, used for jitter thresholds. */
export function headingDelta(a: number, b: number): number {
  const diff = Math.abs(normalizeHeading(a) - normalizeHeading(b));
  return diff > 180 ? 360 - diff : diff;
}

/** Haversine distance in metres. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371008.8;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function qualityFromAccuracy(accuracy: number | null): GpsQuality {
  if (accuracy === null || !Number.isFinite(accuracy) || accuracy <= 0) {
    return 'none';
  }
  if (accuracy <= GPS.ACCURACY_EXCELLENT_M) {
    return 'excellent';
  }
  if (accuracy <= GPS.ACCURACY_GOOD_M) {
    return 'good';
  }
  if (accuracy <= GPS.ACCURACY_FAIR_M) {
    return 'fair';
  }
  return 'poor';
}

export function isFixUsable(fix: GpsFix | null, maxAgeMs: number): boolean {
  if (!fix) {
    return false;
  }
  return Date.now() - fix.receivedAt <= maxAgeMs;
}

export function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0)
  );
}
