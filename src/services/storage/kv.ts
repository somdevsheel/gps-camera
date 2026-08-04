import {createMMKV} from 'react-native-mmkv';
import {log} from '../../utils/logger';

/**
 * Single MMKV instance for small, synchronous key/value state (settings,
 * geocode cache). Structured capture records live in SQLite instead.
 */
const storage = createMMKV({id: 'gps-location-camera'});

export const kv = {
  getObject<T>(key: string): T | null {
    try {
      const raw = storage.getString(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      log.warn('kv', `failed to read ${key}`, error);
      return null;
    }
  },

  setObject(key: string, value: unknown): boolean {
    try {
      storage.set(key, JSON.stringify(value));
      return true;
    } catch (error) {
      log.warn('kv', `failed to write ${key}`, error);
      return false;
    }
  },

  getBoolean(key: string, fallback = false): boolean {
    try {
      return storage.getBoolean(key) ?? fallback;
    } catch {
      return fallback;
    }
  },

  setBoolean(key: string, value: boolean): void {
    try {
      storage.set(key, value);
    } catch (error) {
      log.warn('kv', `failed to write ${key}`, error);
    }
  },

  remove(key: string): void {
    try {
      storage.remove(key);
    } catch (error) {
      log.warn('kv', `failed to delete ${key}`, error);
    }
  },
};
