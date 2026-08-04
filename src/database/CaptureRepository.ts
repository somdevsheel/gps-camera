import type {Scalar} from '@op-engineering/op-sqlite';
import type {CaptureRecord, CardinalPoint, LocationProviderName, ServiceResult, VerificationStatus} from '../types';
import {fromError, ok} from '../utils/result';
import {getDatabase} from './db';

type Row = Record<string, Scalar>;

const COLUMNS = [
  'captureId',
  'originalImagePath',
  'stampedImagePath',
  'galleryUri',
  'latitude',
  'longitude',
  'accuracy',
  'altitude',
  'speed',
  'address',
  'addressJson',
  'captureTimestamp',
  'gpsTimestamp',
  'heading',
  'cardinal',
  'originalSha256',
  'stampedSha256',
  'verificationStatus',
  'provider',
  'companyName',
  'projectName',
  'note',
  'width',
  'height',
  'createdAt',
] as const;

function text(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numeric(row: Row, key: string): number | null {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mapRow(row: Row): CaptureRecord {
  return {
    captureId: text(row, 'captureId') ?? '',
    originalImagePath: text(row, 'originalImagePath'),
    stampedImagePath: text(row, 'stampedImagePath'),
    galleryUri: text(row, 'galleryUri'),
    latitude: numeric(row, 'latitude'),
    longitude: numeric(row, 'longitude'),
    accuracy: numeric(row, 'accuracy'),
    altitude: numeric(row, 'altitude'),
    speed: numeric(row, 'speed'),
    address: text(row, 'address'),
    addressJson: text(row, 'addressJson'),
    captureTimestamp: numeric(row, 'captureTimestamp') ?? 0,
    gpsTimestamp: numeric(row, 'gpsTimestamp'),
    heading: numeric(row, 'heading'),
    cardinal: (text(row, 'cardinal') as CardinalPoint | null) ?? null,
    originalSha256: text(row, 'originalSha256'),
    stampedSha256: text(row, 'stampedSha256'),
    verificationStatus: (text(row, 'verificationStatus') as VerificationStatus) ?? 'unverified',
    provider: (text(row, 'provider') as LocationProviderName | null) ?? null,
    companyName: text(row, 'companyName'),
    projectName: text(row, 'projectName'),
    note: text(row, 'note'),
    width: numeric(row, 'width'),
    height: numeric(row, 'height'),
    createdAt: numeric(row, 'createdAt') ?? 0,
  };
}

function toParams(record: CaptureRecord): Scalar[] {
  return COLUMNS.map(column => {
    const value = record[column];
    return (value ?? null) as Scalar;
  });
}

/** All capture persistence. Failures return a ServiceResult; nothing throws into UI. */
export const captureRepository = {
  async insert(record: CaptureRecord): Promise<ServiceResult<CaptureRecord>> {
    try {
      const db = await getDatabase();
      const placeholders = COLUMNS.map(() => '?').join(', ');
      await db.execute(
        `INSERT OR REPLACE INTO captures (${COLUMNS.join(', ')}) VALUES (${placeholders})`,
        toParams(record),
      );
      return ok(record);
    } catch (error) {
      return fromError('captureRepository.insert', error, 'DB_INSERT_FAILED');
    }
  },

  async listRecent(limit = 200, offset = 0): Promise<ServiceResult<CaptureRecord[]>> {
    try {
      const db = await getDatabase();
      const result = await db.execute(
        'SELECT * FROM captures ORDER BY captureTimestamp DESC LIMIT ? OFFSET ?',
        [limit, offset],
      );
      return ok(result.rows.map(mapRow));
    } catch (error) {
      return fromError('captureRepository.listRecent', error, 'DB_QUERY_FAILED');
    }
  },

  async getById(captureId: string): Promise<ServiceResult<CaptureRecord | null>> {
    try {
      const db = await getDatabase();
      const result = await db.execute('SELECT * FROM captures WHERE captureId = ? LIMIT 1', [
        captureId,
      ]);
      const row = result.rows[0];
      return ok(row ? mapRow(row) : null);
    } catch (error) {
      return fromError('captureRepository.getById', error, 'DB_QUERY_FAILED');
    }
  },

  async updateVerification(
    captureId: string,
    status: VerificationStatus,
  ): Promise<ServiceResult<boolean>> {
    try {
      const db = await getDatabase();
      await db.execute('UPDATE captures SET verificationStatus = ? WHERE captureId = ?', [
        status,
        captureId,
      ]);
      return ok(true);
    } catch (error) {
      return fromError('captureRepository.updateVerification', error, 'DB_UPDATE_FAILED');
    }
  },

  async setGalleryUri(captureId: string, uri: string): Promise<ServiceResult<boolean>> {
    try {
      const db = await getDatabase();
      await db.execute('UPDATE captures SET galleryUri = ? WHERE captureId = ?', [
        uri,
        captureId,
      ]);
      return ok(true);
    } catch (error) {
      return fromError('captureRepository.setGalleryUri', error, 'DB_UPDATE_FAILED');
    }
  },

  async remove(captureId: string): Promise<ServiceResult<boolean>> {
    try {
      const db = await getDatabase();
      await db.execute('DELETE FROM captures WHERE captureId = ?', [captureId]);
      return ok(true);
    } catch (error) {
      return fromError('captureRepository.remove', error, 'DB_DELETE_FAILED');
    }
  },

  async count(): Promise<number> {
    try {
      const db = await getDatabase();
      const result = await db.execute('SELECT COUNT(*) AS total FROM captures');
      const row = result.rows[0];
      const total = row ? row.total : 0;
      return typeof total === 'number' ? total : 0;
    } catch {
      return 0;
    }
  },
};
