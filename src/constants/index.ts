import type {AppSettings} from '../types';

export const APP_NAME = 'GPS Camera';
export const ALBUM_NAME = 'GPSLocationCamera';
export const EXIF_SOFTWARE = 'GPS Location Camera 1.0 (Android)';

/** Dark, camera-first palette. */
export const Colors = {
  background: '#000000',
  surface: '#12141A',
  surfaceAlt: '#1C1F27',
  panel: 'rgba(12,14,18,0.72)',
  border: '#2A2E38',
  text: '#F5F7FA',
  textMuted: '#9AA3B2',
  textFaint: '#6B7382',
  accent: '#00C2A8',
  accentDim: '#0A6B5E',
  warning: '#F5A524',
  danger: '#F0483E',
  success: '#2ECC71',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 6,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

/** Minimum accessible touch target (Android Material guidance). */
export const HIT_TARGET = 48;

export const GPS = {
  /** UI refresh throttle for the live coordinate readout. */
  UI_THROTTLE_MS: 1000,
  UPDATE_INTERVAL_MS: 1000,
  MIN_DISTANCE_M: 0,
  /** Hard ceiling for acquiring a fresh fix at capture time. */
  CAPTURE_TIMEOUT_MS: 8000,
  /** A cached fix older than this is not good enough for a verified capture. */
  CAPTURE_MAX_AGE_MS: 10000,
  /** First-fix timeout before showing the "poor signal" hint. Search keeps
   *  running after this fires - it only surfaces the "move to an open area"
   *  hint sooner so a slow indoor lock is actionable instead of silent. */
  SEARCH_TIMEOUT_MS: 20000,
  ACCURACY_EXCELLENT_M: 5,
  ACCURACY_GOOD_M: 12,
  ACCURACY_FAIR_M: 30,
  ACCURACY_POOR_M: 100,
} as const;

export const GEOCODE = {
  /** Re-geocode only after the user has actually moved this far. */
  MIN_MOVE_M: 40,
  /** Never hit the geocoder more often than this. */
  MIN_INTERVAL_MS: 15000,
  CACHE_SIZE: 60,
  CACHE_TTL_MS: 24 * 60 * 60 * 1000,
  /** Cache key precision ~ 11 m. */
  CACHE_PRECISION: 4,
} as const;

export const COMPASS = {
  UPDATE_INTERVAL_MS: 200,
  /** Ignore sub-degree jitter in the UI. */
  MIN_DELTA_DEG: 1,
} as const;

export const MAP = {
  TILE_ZOOM: 16,
  TILE_SIZE: 256,
  /** Rendered map thumbnail edge in px, scaled with image size at stamp time. */
  THUMB_SIZE: 512,
  TIMEOUT_MS: 6000,
} as const;

export const IMAGE_QUALITY_JPEG: Record<AppSettings['imageQuality'], number> = {
  high: 96,
  balanced: 88,
  compact: 75,
};

export const TEXT_SCALE: Record<AppSettings['textSize'], number> = {
  small: 0.85,
  medium: 1,
  large: 1.2,
};

export const DEFAULT_SETTINGS: AppSettings = {
  stampStyle: 'classic',
  stampPosition: 'bottom',
  textSize: 'medium',
  dateFormat: 'DD MMM YYYY',
  timeFormat: '12h',
  coordinateFormat: 'decimal',
  showAccuracy: true,
  showAltitude: true,
  showSpeed: false,
  showCompass: true,
  showAddress: true,
  showMap: false,
  companyName: '',
  projectName: '',
  customNote: '',
  logoPath: null,
  verifiedCaptureMode: false,
  saveOriginal: false,
  saveStamped: true,
  saveToGallery: true,
  writeExif: true,
  imageQuality: 'high',
  highAccuracyGps: true,
};

export const STORAGE_KEYS = {
  settings: 'settings.v1',
  geocodeCache: 'geocode.cache.v1',
  onboardingSeen: 'onboarding.seen.v1',
} as const;

export const EVENTS = {
  locationUpdate: 'GpsLocation:update',
  locationError: 'GpsLocation:error',
  providerChanged: 'GpsLocation:providerChanged',
  compassHeading: 'GpsCompass:heading',
} as const;
