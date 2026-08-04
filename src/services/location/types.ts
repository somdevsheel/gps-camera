import type {GpsFix, ProviderStatus, ServiceResult} from '../../types';

export interface LocationUpdateListener {
  (fix: GpsFix): void;
}

export interface LocationErrorListener {
  (code: string, message: string): void;
}

export interface ProviderListener {
  (status: ProviderStatus): void;
}

/**
 * Location source abstraction. Keeping this an interface means the
 * LocationManager implementation can be swapped (e.g. for a Fused/GMS build)
 * without touching hooks, stores or screens.
 */
export interface LocationProvider {
  isEnabled(): Promise<boolean>;
  getProviderStatus(): Promise<ProviderStatus>;
  start(highAccuracy: boolean): void;
  stop(): void;
  getFreshFix(timeoutMs: number, highAccuracy: boolean): Promise<ServiceResult<GpsFix>>;
  getLastKnown(): Promise<ServiceResult<GpsFix>>;
  openSettings(): void;
  onUpdate(listener: LocationUpdateListener): () => void;
  onError(listener: LocationErrorListener): () => void;
  onProviderChange(listener: ProviderListener): () => void;
}
