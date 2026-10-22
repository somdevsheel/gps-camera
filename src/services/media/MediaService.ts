import NativeGpsMedia from '../../specs/NativeGpsMedia';
import NativeGpsImage from '../../specs/NativeGpsImage';
import {ALBUM_NAME} from '../../constants';
import type {ServiceResult} from '../../types';
import {fail, fromError, ok} from '../../utils/result';
import {permissionService} from '../permissions/PermissionService';

/** Gallery export, sharing, clipboard and maps hand-off. */
export const mediaService = {
  async saveToGallery(path: string): Promise<ServiceResult<string>> {
    if (!(await permissionService.ensureGalleryAccess())) {
      return fail('GALLERY_PERMISSION_DENIED', 'Storage permission is required to save to the gallery.');
    }
    try {
      return ok(await NativeGpsMedia.saveToGallery(path, ALBUM_NAME));
    } catch (error) {
      return fromError('MediaService.saveToGallery', error, 'GALLERY_SAVE_FAILED');
    }
  },

  async share(path: string, message: string): Promise<ServiceResult<boolean>> {
    try {
      return ok(await NativeGpsMedia.shareImage(path, message));
    } catch (error) {
      return fromError('MediaService.share', error, 'SHARE_FAILED');
    }
  },

  async openInMaps(
    latitude: number,
    longitude: number,
    label: string,
  ): Promise<ServiceResult<boolean>> {
    try {
      return ok(await NativeGpsMedia.openInMaps(latitude, longitude, label));
    } catch (error) {
      return fromError('MediaService.openInMaps', error, 'MAPS_UNAVAILABLE');
    }
  },

  async copyToClipboard(text: string): Promise<ServiceResult<boolean>> {
    try {
      return ok(await NativeGpsMedia.copyToClipboard(text));
    } catch (error) {
      return fromError('MediaService.copyToClipboard', error, 'CLIPBOARD_FAILED');
    }
  },

  async deleteFile(path: string | null): Promise<boolean> {
    if (!path) {
      return false;
    }
    try {
      return await NativeGpsImage.deleteFile(path);
    } catch {
      return false;
    }
  },

  async fileExists(path: string | null): Promise<boolean> {
    if (!path) {
      return false;
    }
    try {
      return await NativeGpsImage.fileExists(path);
    } catch {
      return false;
    }
  },
};
