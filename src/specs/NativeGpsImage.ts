import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';
import type {UnsafeObject} from 'react-native/Libraries/Types/CodegenTypes';

/** Image pipeline: hashing, stamp burn-in, EXIF, static map rendering. */
export interface Spec extends TurboModule {
  sha256File(path: string): Promise<string>;
  /** Burns the overlay into a new JPEG. Resolves {path,width,height,bytes}. */
  stamp(options: UnsafeObject): Promise<UnsafeObject>;
  /** Writes GPS + datetime + software tags via androidx ExifInterface. */
  writeExifGps(options: UnsafeObject): Promise<boolean>;
  /** Downloads + composites raster map tiles into a marked PNG. Resolves {ok,path}. */
  renderStaticMap(options: UnsafeObject): Promise<UnsafeObject>;
  copyToAppStorage(sourcePath: string, fileName: string): Promise<string>;
  deleteFile(path: string): Promise<boolean>;
  fileExists(path: string): Promise<boolean>;
  getPaths(): Promise<UnsafeObject>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GpsImage');
