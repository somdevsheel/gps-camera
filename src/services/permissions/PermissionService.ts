import {Linking, PermissionsAndroid, Platform} from 'react-native';
import type {PermissionSnapshot, PermissionState} from '../../types';
import {log} from '../../utils/logger';

type AndroidPermission = Parameters<typeof PermissionsAndroid.check>[0];

const CAMERA = PermissionsAndroid.PERMISSIONS.CAMERA;
const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

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

  openAppSettings(): void {
    Linking.openSettings().catch(error =>
      log.warn('PermissionService', 'openSettings failed', error),
    );
  },
};
