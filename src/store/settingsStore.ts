import {create} from 'zustand';
import type {AppSettings} from '../types';
import {settingsStorage} from '../services/storage/SettingsStorage';

interface SettingsState {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  replace: (settings: AppSettings) => void;
  reset: () => void;
}

/**
 * Settings are loaded synchronously from MMKV at store creation, so the first
 * render of the camera already has the correct stamp configuration.
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: settingsStorage.load(),

  update: (key, value) => {
    const next = {...get().settings, [key]: value};
    settingsStorage.save(next);
    set({settings: next});
  },

  replace: settings => {
    settingsStorage.save(settings);
    set({settings});
  },

  reset: () => {
    set({settings: settingsStorage.reset()});
  },
}));

/** Non-reactive read for services that must not subscribe to the store. */
export const getSettings = (): AppSettings => useSettingsStore.getState().settings;
