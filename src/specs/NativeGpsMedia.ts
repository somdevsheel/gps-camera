import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/** MediaStore export, system share sheet, clipboard and maps hand-off. */
export interface Spec extends TurboModule {
  saveToGallery(path: string, albumName: string): Promise<string>;
  shareImage(path: string, message: string): Promise<boolean>;
  openInMaps(latitude: number, longitude: number, label: string): Promise<boolean>;
  copyToClipboard(text: string): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GpsMedia');
