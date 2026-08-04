import NativeGpsImage from '../../specs/NativeGpsImage';
import type {
  AppSettings,
  GpsFix,
  ServiceResult,
  StampLine,
  StampPayload,
  StampResult,
} from '../../types';
import {Colors, EXIF_SOFTWARE, IMAGE_QUALITY_JPEG, TEXT_SCALE} from '../../constants';
import {fail, fromError, ok} from '../../utils/result';
import {log} from '../../utils/logger';

export interface AppPaths {
  originals: string;
  stamped: string;
  cache: string;
}

export interface StampRequest {
  sourcePath: string;
  outputPath: string;
  title: string;
  lines: StampLine[];
  settings: AppSettings;
  mapImagePath: string | null;
  verified: boolean;
}

export interface ExifRequest {
  path: string;
  fix: GpsFix | null;
  timestamp: number;
  heading: number | null;
}

function normalizePath(path: string): string {
  return path.startsWith('file://') ? path.slice(7) : path;
}

export const imageService = {
  async getPaths(): Promise<ServiceResult<AppPaths>> {
    try {
      const raw = (await NativeGpsImage.getPaths()) as Partial<AppPaths>;
      if (!raw?.originals || !raw?.stamped || !raw?.cache) {
        return fail('PATHS_UNAVAILABLE', 'App storage directories are not available.');
      }
      return ok({originals: raw.originals, stamped: raw.stamped, cache: raw.cache});
    } catch (error) {
      return fromError('ImageService.getPaths', error, 'PATHS_UNAVAILABLE');
    }
  },

  /**
   * Burns the overlay into a new JPEG. The native side scales every metric
   * (padding, font size, map thumbnail) from the source image width so a 12 MP
   * shot and a 2 MP shot get proportionally identical stamps.
   */
  async stamp(request: StampRequest): Promise<ServiceResult<StampResult>> {
    const {settings} = request;
    const payload: StampPayload = {
      sourcePath: normalizePath(request.sourcePath),
      outputPath: normalizePath(request.outputPath),
      position: settings.stampPosition,
      style: settings.stampStyle,
      textScale: TEXT_SCALE[settings.textSize],
      jpegQuality: IMAGE_QUALITY_JPEG[settings.imageQuality],
      title: request.title,
      lines: request.lines,
      mapImagePath: request.mapImagePath ? normalizePath(request.mapImagePath) : null,
      logoPath: settings.logoPath ? normalizePath(settings.logoPath) : null,
      accentColor: Colors.accent,
      verified: request.verified,
    };
    try {
      const raw = (await NativeGpsImage.stamp(payload)) as Partial<StampResult>;
      if (!raw?.path) {
        return fail('STAMP_FAILED', 'The stamped image could not be produced.');
      }
      return ok({
        path: raw.path,
        width: raw.width ?? 0,
        height: raw.height ?? 0,
        bytes: raw.bytes ?? 0,
      });
    } catch (error) {
      return fromError('ImageService.stamp', error, 'STAMP_FAILED');
    }
  },

  /**
   * Writes GPS/date/software EXIF tags. Existing camera metadata is preserved;
   * only the tags listed here are added or overwritten.
   */
  async writeExif(request: ExifRequest): Promise<boolean> {
    const {fix} = request;
    try {
      return await NativeGpsImage.writeExifGps({
        path: normalizePath(request.path),
        hasLocation: fix !== null,
        latitude: fix?.latitude ?? 0,
        longitude: fix?.longitude ?? 0,
        hasAltitude: fix?.altitude !== null && fix?.altitude !== undefined,
        altitude: fix?.altitude ?? 0,
        gpsTimestamp: fix?.gpsTimestamp ?? 0,
        timestamp: request.timestamp,
        hasHeading: request.heading !== null,
        heading: request.heading ?? 0,
        software: EXIF_SOFTWARE,
      });
    } catch (error) {
      log.warn('ImageService.writeExif', 'EXIF write failed', error);
      return false;
    }
  },

  async copyToAppStorage(
    sourcePath: string,
    fileName: string,
  ): Promise<ServiceResult<string>> {
    try {
      return ok(await NativeGpsImage.copyToAppStorage(normalizePath(sourcePath), fileName));
    } catch (error) {
      return fromError('ImageService.copyToAppStorage', error, 'COPY_FAILED');
    }
  },
};
