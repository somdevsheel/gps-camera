import type {
  AppSettings,
  CaptureRecord,
  CompassReading,
  GeocodeResult,
  GpsFix,
  PostalAddress,
  ServiceResult,
  VerificationStatus,
} from '../../types';
import {ALBUM_NAME, GPS, MAP} from '../../constants';
import {createId} from '../../utils/id';
import {formatAddress} from '../../utils/format';
import {isFixUsable} from '../../utils/geo';
import {fail, ok, withTimeout} from '../../utils/result';
import {log} from '../../utils/logger';
import {captureRepository} from '../../database/CaptureRepository';
import {geocodingService} from '../geocoding/GeocodingService';
import {hashService} from '../hashing/HashService';
import {imageService} from '../image/ImageService';
import {buildStamp} from '../image/stampBuilder';
import {locationService} from '../location/LocationService';
import {mapService} from '../map/MapService';
import {mediaService} from '../media/MediaService';

export interface CaptureInput {
  /** Absolute path to the JPEG vision-camera just wrote. */
  photoPath: string;
  width: number;
  height: number;
  settings: AppSettings;
  /** Latest streamed fix; used when a fresh one cannot be obtained in time. */
  cachedFix: GpsFix | null;
  compass: CompassReading | null;
  cachedGeocode: GeocodeResult | null;
}

export type CaptureStage =
  | 'locating'
  | 'geocoding'
  | 'hashing'
  | 'stamping'
  | 'saving'
  | 'done';

export interface CaptureProgress {
  stage: CaptureStage;
}

export interface CaptureOutcome {
  record: CaptureRecord;
  /** Non-fatal degradations worth surfacing in the preview screen. */
  warnings: string[];
}

const STAMPED_PREFIX = 'GPSCAM';

function fileNameFor(kind: 'orig' | 'stamp', timestamp: number, captureId: string): string {
  const suffix = captureId.slice(-6);
  return `${STAMPED_PREFIX}_${kind}_${timestamp}_${suffix}.jpg`;
}

/**
 * Orchestrates the whole capture pipeline.
 *
 * Design rules enforced here:
 *  - the photo is never lost because an optional step failed;
 *  - reverse geocoding and map tiles are time-boxed and always optional;
 *  - `gps-verified` is only assigned when a fresh, fine-grained, non-mocked fix
 *    was obtained from the OS at capture time.
 */
export const captureService = {
  async process(
    input: CaptureInput,
    onProgress?: (progress: CaptureProgress) => void,
  ): Promise<ServiceResult<CaptureOutcome>> {
    const {settings} = input;
    const captureId = createId();
    const captureTimestamp = Date.now();
    const warnings: string[] = [];

    const report = (stage: CaptureStage): void => onProgress?.({stage});

    const pathsResult = await imageService.getPaths();
    if (!pathsResult.ok) {
      return fail('STORAGE_UNAVAILABLE', 'App storage is unavailable, cannot save the photo.');
    }
    const paths = pathsResult.value;

    /* ---- 1. Location ------------------------------------------------- */
    report('locating');
    let fix: GpsFix | null = input.cachedFix;
    let fixIsFresh = false;

    if (settings.verifiedCaptureMode) {
      const fresh = await locationService.getFreshFix(
        GPS.CAPTURE_TIMEOUT_MS,
        settings.highAccuracyGps,
      );
      if (fresh.ok) {
        fix = fresh.value;
        fixIsFresh = true;
      } else {
        warnings.push('Could not obtain a fresh GPS fix; capture is not GPS-verified.');
      }
    } else if (isFixUsable(input.cachedFix, GPS.CAPTURE_MAX_AGE_MS)) {
      fixIsFresh = true;
    } else if (input.cachedFix) {
      warnings.push('Position is older than 10 seconds.');
    } else {
      warnings.push('No GPS fix was available; the photo has no coordinates.');
    }

    /* ---- 2. Address (optional, time-boxed) --------------------------- */
    report('geocoding');
    let addressLine: string | null = null;
    let addressJson: string | null = null;
    let addressData: PostalAddress | null = null;
    if (fix && settings.showAddress) {
      const cached =
        input.cachedGeocode?.status === 'ok' ? input.cachedGeocode : geocodingService.peekCached(fix.latitude, fix.longitude);
      const geocode =
        cached ??
        (await withTimeout(
          geocodingService.lookup(fix.latitude, fix.longitude),
          5000,
          'GEOCODE_TIMEOUT',
        ).catch(() => null));
      if (geocode?.status === 'ok' && geocode.address) {
        addressLine = formatAddress(geocode.address);
        addressJson = JSON.stringify(geocode.address);
        addressData = geocode.address;
      } else {
        warnings.push('Address lookup unavailable; coordinates were still stamped.');
      }
    }

    /* ---- 3. Optional map thumbnail ----------------------------------- */
    let mapImagePath: string | null = null;
    if (fix && settings.showMap) {
      const map = await mapService.render(fix.latitude, fix.longitude, MAP.THUMB_SIZE);
      if (map.ok) {
        mapImagePath = map.value;
      } else {
        warnings.push('Map preview unavailable; stamped text-only.');
      }
    }

    /* ---- 4. Persist the original, hash it ---------------------------- */
    report('hashing');
    const originalName = fileNameFor('orig', captureTimestamp, captureId);
    const originalCopy = await imageService.copyToAppStorage(input.photoPath, originalName);
    if (!originalCopy.ok) {
      return fail('STORAGE_FAILED', 'The captured photo could not be stored.');
    }
    const originalPath = originalCopy.value;

    let originalSha256: string | null = null;
    if (settings.verifiedCaptureMode) {
      const digest = await hashService.sha256(originalPath);
      if (digest.ok) {
        originalSha256 = digest.value;
      } else {
        warnings.push('Original image hash could not be computed.');
      }
    }

    /* ---- 5. Burn the stamp ------------------------------------------- */
    report('stamping');
    const verified = Boolean(
      settings.verifiedCaptureMode && fix && fixIsFresh && !fix.isCoarse && !fix.mocked,
    );
    const {title, lines} = buildStamp({
      fix,
      addressLine,
      address: addressData,
      compass: settings.showCompass ? input.compass : null,
      timestamp: captureTimestamp,
      settings,
      verified,
    });

    const stampedName = fileNameFor('stamp', captureTimestamp, captureId);
    const stampedTarget = `${paths.stamped}/${stampedName}`;
    let stampedPath: string | null = null;
    let width = input.width;
    let height = input.height;

    if (settings.saveStamped) {
      const stamped = await imageService.stamp({
        sourcePath: originalPath,
        outputPath: stampedTarget,
        title,
        lines,
        settings,
        mapImagePath,
        verified,
      });
      if (stamped.ok) {
        stampedPath = stamped.value.path;
        width = stamped.value.width || width;
        height = stamped.value.height || height;
      } else {
        warnings.push('Stamping failed; the unmodified photo was kept.');
      }
    }

    /* ---- 6. EXIF + hash of the stamped file -------------------------- */
    const exifTarget = stampedPath ?? originalPath;
    if (settings.writeExif) {
      const written = await imageService.writeExif({
        path: exifTarget,
        fix,
        timestamp: captureTimestamp,
        heading: input.compass?.heading ?? null,
      });
      if (!written) {
        warnings.push('EXIF metadata could not be written.');
      }
    }

    let stampedSha256: string | null = null;
    if (settings.verifiedCaptureMode && stampedPath) {
      const digest = await hashService.sha256(stampedPath);
      if (digest.ok) {
        stampedSha256 = digest.value;
      } else {
        warnings.push('Stamped image hash could not be computed.');
      }
    }

    /* ---- 7. Gallery export ------------------------------------------- */
    report('saving');
    let galleryUri: string | null = null;
    if (settings.saveToGallery) {
      const exportPath = stampedPath ?? originalPath;
      const saved = await mediaService.saveToGallery(exportPath);
      if (saved.ok) {
        galleryUri = saved.value;
      } else {
        warnings.push(`Could not export to the ${ALBUM_NAME} album.`);
      }
    }

    /* ---- 8. Record --------------------------------------------------- */
    const verificationStatus: VerificationStatus = settings.verifiedCaptureMode
      ? verified
        ? 'gps-verified'
        : 'unverified'
      : 'not-applicable';

    const record: CaptureRecord = {
      captureId,
      originalImagePath: settings.saveOriginal || !stampedPath ? originalPath : null,
      stampedImagePath: stampedPath,
      galleryUri,
      latitude: fix?.latitude ?? null,
      longitude: fix?.longitude ?? null,
      accuracy: fix?.accuracy ?? null,
      altitude: fix?.altitude ?? null,
      speed: fix?.speed ?? null,
      address: addressLine,
      addressJson,
      captureTimestamp,
      gpsTimestamp: fix?.gpsTimestamp ?? null,
      heading: input.compass?.heading ?? null,
      cardinal: input.compass?.cardinal ?? null,
      originalSha256,
      stampedSha256,
      verificationStatus,
      provider: fix?.provider ?? null,
      companyName: settings.companyName.trim() || null,
      projectName: settings.projectName.trim() || null,
      note: settings.customNote.trim() || null,
      width,
      height,
      createdAt: Date.now(),
    };

    // Discard the untouched original when the user asked us not to keep it.
    if (!settings.saveOriginal && stampedPath) {
      await mediaService.deleteFile(originalPath);
    }
    // The camera's temp file is never needed once it has been copied.
    if (input.photoPath !== originalPath) {
      await mediaService.deleteFile(input.photoPath);
    }
    if (mapImagePath) {
      await mediaService.deleteFile(mapImagePath);
    }

    const inserted = await captureRepository.insert(record);
    if (!inserted.ok) {
      warnings.push('The capture record could not be saved to the local database.');
      log.warn('CaptureService', 'record insert failed', inserted.message);
    }

    report('done');
    return ok({record, warnings});
  },

  /**
   * Recomputes hashes and compares them with the stored digests. A mismatch is
   * recorded as `tampered` rather than silently corrected.
   */
  async reverify(record: CaptureRecord): Promise<ServiceResult<VerificationStatus>> {
    if (record.verificationStatus === 'not-applicable') {
      return ok('not-applicable');
    }
    const target = record.stampedImagePath ?? record.originalImagePath;
    const expected = record.stampedImagePath ? record.stampedSha256 : record.originalSha256;
    if (!target || !expected) {
      return ok(record.verificationStatus);
    }
    const result = await hashService.verify(target, expected);
    if (!result.ok) {
      return fail(result.code, result.message);
    }
    const status: VerificationStatus = result.value
      ? record.verificationStatus === 'tampered'
        ? 'gps-verified'
        : record.verificationStatus
      : 'tampered';
    if (status !== record.verificationStatus) {
      await captureRepository.updateVerification(record.captureId, status);
    }
    return ok(status);
  },

  async deleteCapture(record: CaptureRecord): Promise<ServiceResult<boolean>> {
    await mediaService.deleteFile(record.stampedImagePath);
    await mediaService.deleteFile(record.originalImagePath);
    return captureRepository.remove(record.captureId);
  },
};
