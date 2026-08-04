/* ------------------------------------------------------------------ */
/* Location                                                            */
/* ------------------------------------------------------------------ */

export type LocationProviderName = 'gps' | 'network' | 'passive' | 'fused' | 'unknown';

/** A real, device-reported position fix. Never synthesised. */
export interface GpsFix {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy radius in metres (68% confidence). */
  accuracy: number | null;
  /** Metres above WGS84 ellipsoid, when the provider reports it. */
  altitude: number | null;
  /** Vertical accuracy in metres (API 26+). */
  altitudeAccuracy: number | null;
  /** Ground speed in m/s. */
  speed: number | null;
  /** Bearing of travel in degrees, distinct from compass heading. */
  bearing: number | null;
  /** Provider clock, epoch millis (this is the "GPS timestamp"). */
  gpsTimestamp: number;
  /** Device wall clock at the moment the fix reached JS. */
  receivedAt: number;
  provider: LocationProviderName;
  /** True when the OS only granted coarse location. */
  isCoarse: boolean;
  mocked: boolean;
}

export type GpsQuality = 'none' | 'poor' | 'fair' | 'good' | 'excellent';

export type GpsPhase =
  | 'idle'
  | 'permission-denied'
  | 'disabled'
  | 'searching'
  | 'ready'
  | 'timeout'
  | 'unavailable'
  | 'error';

export interface GpsState {
  phase: GpsPhase;
  fix: GpsFix | null;
  quality: GpsQuality;
  message: string;
  errorCode: string | null;
}

export interface ProviderStatus {
  gpsEnabled: boolean;
  networkEnabled: boolean;
  passiveEnabled: boolean;
  anyEnabled: boolean;
}

/* ------------------------------------------------------------------ */
/* Geocoding                                                           */
/* ------------------------------------------------------------------ */

export interface PostalAddress {
  featureName: string | null;
  street: string | null;
  subLocality: string | null;
  locality: string | null;
  subAdminArea: string | null;
  adminArea: string | null;
  postalCode: string | null;
  countryName: string | null;
  countryCode: string | null;
  /** Provider-formatted single line, used as the display fallback. */
  formatted: string | null;
}

export type GeocodeStatus = 'idle' | 'loading' | 'ok' | 'unavailable' | 'no-result' | 'error';

export interface GeocodeResult {
  status: GeocodeStatus;
  address: PostalAddress | null;
  /** Coordinates the address was resolved for. */
  latitude: number;
  longitude: number;
  resolvedAt: number;
}

/* ------------------------------------------------------------------ */
/* Compass                                                             */
/* ------------------------------------------------------------------ */

export type CardinalPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type CompassAccuracy = 'unreliable' | 'low' | 'medium' | 'high' | 'unknown';

export interface CompassReading {
  /** Degrees clockwise from true north (declination applied when possible). */
  heading: number;
  /** Raw magnetic heading before declination correction. */
  magneticHeading: number;
  cardinal: CardinalPoint;
  accuracy: CompassAccuracy;
  isTrueNorth: boolean;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type StampStyle = 'classic' | 'compact' | 'detailed' | 'minimal';
export type StampPosition = 'bottom' | 'top';
export type TextSize = 'small' | 'medium' | 'large';
export type DateFormat = 'DD MMM YYYY' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type TimeFormat = '12h' | '24h';
export type CoordinateFormat = 'decimal' | 'dms' | 'decimal-signed';
export type ImageQuality = 'high' | 'balanced' | 'compact';

export interface AppSettings {
  stampStyle: StampStyle;
  stampPosition: StampPosition;
  textSize: TextSize;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  coordinateFormat: CoordinateFormat;
  showAccuracy: boolean;
  showAltitude: boolean;
  showSpeed: boolean;
  showCompass: boolean;
  showAddress: boolean;
  showMap: boolean;
  companyName: string;
  projectName: string;
  customNote: string;
  logoPath: string | null;
  verifiedCaptureMode: boolean;
  saveOriginal: boolean;
  saveStamped: boolean;
  saveToGallery: boolean;
  writeExif: boolean;
  imageQuality: ImageQuality;
  highAccuracyGps: boolean;
}

/* ------------------------------------------------------------------ */
/* Capture records                                                     */
/* ------------------------------------------------------------------ */

/**
 * `gps-verified` is only ever written when coordinates came straight from the
 * OS at capture time. Anything user-supplied or edited downgrades to
 * `unverified`; a broken hash chain becomes `tampered`.
 */
export type VerificationStatus = 'gps-verified' | 'unverified' | 'tampered' | 'not-applicable';

export interface CaptureRecord {
  captureId: string;
  originalImagePath: string | null;
  stampedImagePath: string | null;
  galleryUri: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  address: string | null;
  addressJson: string | null;
  captureTimestamp: number;
  gpsTimestamp: number | null;
  heading: number | null;
  cardinal: CardinalPoint | null;
  originalSha256: string | null;
  stampedSha256: string | null;
  verificationStatus: VerificationStatus;
  provider: LocationProviderName | null;
  companyName: string | null;
  projectName: string | null;
  note: string | null;
  width: number | null;
  height: number | null;
  createdAt: number;
}

export interface GallerySection {
  title: string;
  dayKey: string;
  data: CaptureRecord[];
}

/* ------------------------------------------------------------------ */
/* Stamping                                                            */
/* ------------------------------------------------------------------ */

export interface StampLine {
  label: string | null;
  value: string;
  emphasis: 'title' | 'strong' | 'normal' | 'muted';
}

export interface StampPayload {
  sourcePath: string;
  outputPath: string;
  position: StampPosition;
  style: StampStyle;
  textScale: number;
  jpegQuality: number;
  title: string;
  lines: StampLine[];
  mapImagePath: string | null;
  logoPath: string | null;
  accentColor: string;
  verified: boolean;
}

export interface StampResult {
  path: string;
  width: number;
  height: number;
  bytes: number;
}

/* ------------------------------------------------------------------ */
/* Permissions                                                         */
/* ------------------------------------------------------------------ */

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'blocked' | 'limited';

export interface PermissionSnapshot {
  camera: PermissionState;
  fineLocation: PermissionState;
  coarseLocation: PermissionState;
  /** True when the user granted only approximate location. */
  approximateOnly: boolean;
}

/** Discriminated result used across services so failures never throw into UI. */
export type ServiceResult<T> =
  | {ok: true; value: T}
  | {ok: false; code: string; message: string};
