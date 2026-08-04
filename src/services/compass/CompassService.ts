import {DeviceEventEmitter} from 'react-native';
import NativeGpsCompass from '../../specs/NativeGpsCompass';
import type {CompassAccuracy, CompassReading} from '../../types';
import {COMPASS, EVENTS} from '../../constants';
import {headingToCardinal, normalizeHeading} from '../../utils/geo';
import {log} from '../../utils/logger';

type Raw = Record<string, unknown>;

function parseAccuracy(value: unknown): CompassAccuracy {
  switch (value) {
    case 'high':
    case 'medium':
    case 'low':
    case 'unreliable':
      return value;
    default:
      return 'unknown';
  }
}

function parseReading(raw: unknown): CompassReading | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Raw;
  const heading = obj.heading;
  if (typeof heading !== 'number' || !Number.isFinite(heading)) {
    return null;
  }
  const trueHeading = normalizeHeading(heading);
  const magnetic =
    typeof obj.magneticHeading === 'number' && Number.isFinite(obj.magneticHeading)
      ? normalizeHeading(obj.magneticHeading)
      : trueHeading;
  return {
    heading: trueHeading,
    magneticHeading: magnetic,
    cardinal: headingToCardinal(trueHeading),
    accuracy: parseAccuracy(obj.accuracy),
    isTrueNorth: obj.isTrueNorth === true,
  };
}

/**
 * Compass access. Devices without a rotation-vector or magnetometer resolve
 * `isAvailable()` to false and the UI simply hides direction.
 */
class CompassService {
  private started = false;

  async isAvailable(): Promise<boolean> {
    try {
      return await NativeGpsCompass.isAvailable();
    } catch (error) {
      log.warn('CompassService', 'isAvailable failed', error);
      return false;
    }
  }

  start(): void {
    if (this.started) {
      return;
    }
    try {
      NativeGpsCompass.start(COMPASS.UPDATE_INTERVAL_MS);
      this.started = true;
    } catch (error) {
      log.warn('CompassService', 'start failed', error);
    }
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    try {
      NativeGpsCompass.stop();
    } catch (error) {
      log.warn('CompassService', 'stop failed', error);
    } finally {
      this.started = false;
    }
  }

  onReading(listener: (reading: CompassReading) => void): () => void {
    const sub = DeviceEventEmitter.addListener(EVENTS.compassHeading, (raw: unknown) => {
      const reading = parseReading(raw);
      if (reading) {
        listener(reading);
      }
    });
    return () => sub.remove();
  }
}

export const compassService = new CompassService();
