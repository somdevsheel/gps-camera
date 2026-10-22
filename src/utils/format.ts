import type {
  CoordinateFormat,
  DateFormat,
  PostalAddress,
  TimeFormat,
} from '../types';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const pad = (value: number, size = 2): string => String(value).padStart(size, '0');

export function formatDate(timestamp: number, format: DateFormat): string {
  const d = new Date(timestamp);
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD MMM YYYY':
    default:
      return `${day} ${MONTHS[d.getMonth()]} ${year}`;
  }
}

export function formatTime(
  timestamp: number,
  format: TimeFormat,
  includeSeconds = true,
): string {
  const d = new Date(timestamp);
  const seconds = includeSeconds ? `:${pad(d.getSeconds())}` : '';
  const minutes = pad(d.getMinutes());
  if (format === '24h') {
    return `${pad(d.getHours())}:${minutes}${seconds}`;
  }
  const hours24 = d.getHours();
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${pad(hours12)}:${minutes}${seconds} ${suffix}`;
}

/** e.g. "GMT +05:30" — the device's own UTC offset at the given instant. */
export function formatGmtOffset(timestamp: number): string {
  const offsetMin = -new Date(timestamp).getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `GMT ${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * The single-line "headline" used atop the stamp card: "Weekday, DD/MM/YYYY
 * 04:23 PM GMT +05:30" — the date/time/timezone read as one glanceable line,
 * mirroring the popular field-camera stamp layout.
 */
export function formatStampDateTime(
  timestamp: number,
  dateFormat: DateFormat,
  timeFormat: TimeFormat,
): string {
  const weekday = WEEKDAYS[new Date(timestamp).getDay()];
  const date = formatDate(timestamp, dateFormat);
  const time = formatTime(timestamp, timeFormat, false);
  return `${weekday}, ${date} ${time} ${formatGmtOffset(timestamp)}`;
}

export function formatDateTime(
  timestamp: number,
  dateFormat: DateFormat,
  timeFormat: TimeFormat,
): string {
  return `${formatDate(timestamp, dateFormat)} ${formatTime(timestamp, timeFormat)}`;
}

/** Groups gallery items; local-date based so items land on the day they were shot. */
export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function friendlyDayLabel(timestamp: number, dateFormat: DateFormat): string {
  const key = dayKey(timestamp);
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86400000);
  if (key === today) {
    return 'Today';
  }
  if (key === yesterday) {
    return 'Yesterday';
  }
  return formatDate(timestamp, dateFormat);
}

function toDms(value: number): string {
  // Round once, in hundredths of a second, so 59.999" carries into the next
  // minute instead of printing as 60.00".
  const hundredths = Math.round(Math.abs(value) * 360000);
  const degrees = Math.floor(hundredths / 360000);
  const minutes = Math.floor((hundredths % 360000) / 6000);
  const seconds = (hundredths % 6000) / 100;
  return `${degrees}° ${pad(minutes)}' ${seconds.toFixed(2).padStart(5, '0')}"`;
}

export function formatLatitude(lat: number, format: CoordinateFormat): string {
  const hemisphere = lat >= 0 ? 'N' : 'S';
  switch (format) {
    case 'dms':
      return `${toDms(lat)} ${hemisphere}`;
    case 'decimal-signed':
      return lat.toFixed(6);
    case 'decimal':
    default:
      return `${Math.abs(lat).toFixed(6)}° ${hemisphere}`;
  }
}

export function formatLongitude(lon: number, format: CoordinateFormat): string {
  const hemisphere = lon >= 0 ? 'E' : 'W';
  switch (format) {
    case 'dms':
      return `${toDms(lon)} ${hemisphere}`;
    case 'decimal-signed':
      return lon.toFixed(6);
    case 'decimal':
    default:
      return `${Math.abs(lon).toFixed(6)}° ${hemisphere}`;
  }
}

export function formatCoordinatePair(
  lat: number,
  lon: number,
  format: CoordinateFormat,
): string {
  return `${formatLatitude(lat, format)}, ${formatLongitude(lon, format)}`;
}

/** "Lat 28.977643° N  Long 79.396606° E" — the stamp's single coordinate line. */
export function formatLatLongLine(lat: number, lon: number, format: CoordinateFormat): string {
  return `Lat ${formatLatitude(lat, format)}  Long ${formatLongitude(lon, format)}`;
}

export function formatAccuracy(accuracy: number | null): string {
  if (accuracy === null || !Number.isFinite(accuracy)) {
    return 'Unknown';
  }
  return `±${accuracy < 10 ? accuracy.toFixed(1) : Math.round(accuracy)} m`;
}

export function formatAltitude(altitude: number | null): string {
  if (altitude === null || !Number.isFinite(altitude)) {
    return 'Unknown';
  }
  return `${Math.round(altitude)} m`;
}

export function formatSpeed(speed: number | null): string {
  if (speed === null || !Number.isFinite(speed)) {
    return 'Unknown';
  }
  return `${(speed * 3.6).toFixed(1)} km/h`;
}

export function formatHeading(heading: number | null, cardinal: string | null): string {
  if (heading === null || !Number.isFinite(heading)) {
    return 'Unavailable';
  }
  return `${cardinal ?? ''} ${Math.round(heading)}°`.trim();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Builds the human-readable address line, preferring the most specific parts
 * available and dropping duplicates (Android often repeats locality/subAdmin).
 */
export function formatAddress(address: PostalAddress | null): string | null {
  if (!address) {
    return null;
  }
  const parts = [
    address.featureName,
    address.street,
    address.subLocality,
    address.locality,
    address.subAdminArea,
    address.adminArea,
    address.postalCode,
    address.countryName,
  ];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cleaned.push(value);
  }
  if (cleaned.length === 0) {
    return address.formatted?.trim() || null;
  }
  return cleaned.join(', ');
}

/** Short form used on the camera HUD where horizontal space is tight. */
export function formatShortAddress(address: PostalAddress | null): string | null {
  if (!address) {
    return null;
  }
  const parts = [
    address.subLocality ?? address.street ?? address.featureName,
    address.locality ?? address.subAdminArea,
    address.adminArea,
  ];
  const cleaned = parts.map(p => p?.trim()).filter((p): p is string => Boolean(p));
  const unique = Array.from(new Set(cleaned));
  return unique.length > 0 ? unique.join(', ') : formatAddress(address);
}

/** ISO 3166-1 alpha-2 ("IN") → 🇮🇳. Falls back to '' for anything malformed. */
export function countryFlagEmoji(countryCode: string | null): string {
  const code = countryCode?.trim().toUpperCase();
  if (!code || code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
    return '';
  }
  const codePoints = [...code].map(char => 0x1f1e6 + (char.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

/**
 * The big headline atop the stamp card: "City, State, Country 🇮🇳" — the
 * short, glanceable place name, as opposed to {@linkcode formatAddress}'s
 * full street-level line underneath it.
 */
export function formatHeadlineAddress(address: PostalAddress | null): string | null {
  if (!address) {
    return null;
  }
  const parts = [
    address.locality ?? address.subAdminArea ?? address.featureName,
    address.adminArea,
    address.countryName,
  ];
  const cleaned = parts.map(p => p?.trim()).filter((p): p is string => Boolean(p));
  const unique = Array.from(new Set(cleaned));
  if (unique.length === 0) {
    return formatAddress(address);
  }
  const flag = countryFlagEmoji(address.countryCode);
  return flag ? `${unique.join(', ')} ${flag}` : unique.join(', ');
}
