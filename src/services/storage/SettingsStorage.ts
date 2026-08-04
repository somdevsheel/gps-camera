import type {AppSettings} from '../../types';
import {DEFAULT_SETTINGS, STORAGE_KEYS} from '../../constants';
import {kv} from './kv';

/**
 * Settings are merged over defaults on read so that a settings file written by
 * an older build never leaves new keys undefined.
 */
export const settingsStorage = {
  load(): AppSettings {
    const stored = kv.getObject<Partial<AppSettings>>(STORAGE_KEYS.settings);
    if (!stored) {
      return {...DEFAULT_SETTINGS};
    }
    return {...DEFAULT_SETTINGS, ...stored};
  },

  save(settings: AppSettings): boolean {
    return kv.setObject(STORAGE_KEYS.settings, settings);
  },

  reset(): AppSettings {
    kv.remove(STORAGE_KEYS.settings);
    return {...DEFAULT_SETTINGS};
  },

  hasSeenOnboarding(): boolean {
    return kv.getBoolean(STORAGE_KEYS.onboardingSeen, false);
  },

  markOnboardingSeen(): void {
    kv.setBoolean(STORAGE_KEYS.onboardingSeen, true);
  },
};
