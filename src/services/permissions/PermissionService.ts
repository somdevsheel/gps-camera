import {Linking, PermissionsAndroid, Platform} from 'react-native';
import type {PermissionSnapshot, PermissionState} from '../../types';
import {log} from '../../utils/logger';

type AndroidPermission = Parameters<typeof PermissionsAndroid.check>[0];

const CAMERA = PermissionsAndroid.PERMISSIONS.CAMERA;
const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
const WRITE_STORAGE = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;

/** Scoped storage (API 29+) lets MediaStore inserts go through without it. */
const NEEDS_LEGACY_STORAGE = Platform.OS === 'android' && Number(Platform.Version) < 29;

function toState(result: string): PermissionState {
  switch (result) {
    case PermissionsAndroid.RESULTS.GRANTED:
      return 'granted';
    case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
      return 'blocked';
    case PermissionsAndroid.RESULTS.DENIED:
      return 'denied';
    default:
      return 'unknown';
  }
}

async function check(permission: AndroidPermission): Promise<PermissionState> {
  if (Platform.OS !== 'android') {
    return 'granted';
  }
  try {
    return (await PermissionsAndroid.check(permission)) ? 'granted' : 'denied';
  } catch (error) {
    log.warn('PermissionService', 'check failed', permission, error);
    return 'unknown';
  }
}

/**
 * Android 12+ lets the user grant only ACCESS_COARSE_LOCATION even when fine
 * was requested. We surface that explicitly rather than silently stamping
 * low-precision coordinates as if they were GPS grade.
 */
export const permissionService = {
  async snapshot(): Promise<PermissionSnapshot> {
    const [camera, fineLocation, coarseLocation] = await Promise.all([
      check(CAMERA),
      check(FINE),
      check(COARSE),
    ]);
    return {
      camera,
      fineLocation,
      coarseLocation,
      approximateOnly: fineLocation !== 'granted' && coarseLocation === 'granted',
    };
  },

  async requestCamera(): Promise<PermissionState> {
    if (Platform.OS !== 'android') {
      return 'granted';
    }
    try {
      return toState(
        await PermissionsAndroid.request(CAMERA, {
          title: 'Camera access',
          message:
            'GPS Location Camera needs the camera to take the photos you stamp with location data.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not now',
        }),
      );
    } catch (error) {
      log.error('PermissionService', 'requestCamera failed', error);
      return 'unknown';
    }
  },

  async requestLocation(): Promise<PermissionSnapshot> {
    if (Platform.OS !== 'android') {
      return this.snapshot();
    }
    try {
      await PermissionsAndroid.requestMultiple([FINE, COARSE]);
    } catch (error) {
      log.error('PermissionService', 'requestLocation failed', error);
    }
    return this.snapshot();
  },

  /**
   * Gallery export on Android 9 and below writes to public storage, which
   * needs a runtime grant. Asks only when not yet granted; true when export
   * can proceed.
   */
  async ensureGalleryAccess(): Promise<boolean> {
    if (!NEEDS_LEGACY_STORAGE) {
      return true;
    }
    if ((await check(WRITE_STORAGE)) === 'granted') {
      return true;
    }
    try {
      const result = await PermissionsAndroid.request(WRITE_STORAGE, {
        title: 'Save to gallery',
        message: 'GPS Location Camera needs storage access to save stamped photos to your gallery.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      });
      return toState(result) === 'granted';
    } catch (error) {
      log.error('PermissionService', 'ensureGalleryAccess failed', error);
      return false;
    }
  },

  openAppSettings(): void {
    Linking.openSettings().catch(error =>
      log.warn('PermissionService', 'openSettings failed', error),
    );
  },
};
