import NativeGpsImage from '../../specs/NativeGpsImage';
import type {ServiceResult} from '../../types';
import {fromError, ok} from '../../utils/result';

/**
 * SHA-256 over the file bytes, computed natively on a background executor so
 * large JPEGs never block the JS thread or the camera preview.
 */
export const hashService = {
  async sha256(path: string): Promise<ServiceResult<string>> {
    try {
      const digest = await NativeGpsImage.sha256File(path);
      return ok(digest);
    } catch (error) {
      return fromError('HashService.sha256', error, 'HASH_FAILED');
    }
  },

  /** Re-hashes a file and compares against a stored digest. */
  async verify(path: string, expected: string): Promise<ServiceResult<boolean>> {
    const result = await this.sha256(path);
    if (!result.ok) {
      return result;
    }
    return ok(result.value.toLowerCase() === expected.toLowerCase());
  },
};
