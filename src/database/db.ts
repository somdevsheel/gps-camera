import {open, type DB} from '@op-engineering/op-sqlite';
import {log} from '../utils/logger';

const DB_NAME = 'gps_location_camera.sqlite';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS captures (
    captureId TEXT PRIMARY KEY NOT NULL,
    originalImagePath TEXT,
    stampedImagePath TEXT,
    galleryUri TEXT,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    altitude REAL,
    speed REAL,
    address TEXT,
    addressJson TEXT,
    captureTimestamp INTEGER NOT NULL,
    gpsTimestamp INTEGER,
    heading REAL,
    cardinal TEXT,
    originalSha256 TEXT,
    stampedSha256 TEXT,
    verificationStatus TEXT NOT NULL,
    provider TEXT,
    companyName TEXT,
    projectName TEXT,
    note TEXT,
    width INTEGER,
    height INTEGER,
    createdAt INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_captures_time ON captures (captureTimestamp DESC)',
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  )`,
];

const SCHEMA_VERSION = 1;

let instance: DB | null = null;
let initPromise: Promise<DB> | null = null;

async function migrate(db: DB): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(statement);
  }
  await db.execute('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [
    'schemaVersion',
    String(SCHEMA_VERSION),
  ]);
}

/**
 * Lazily opens the database and applies migrations exactly once, even when
 * several screens mount concurrently.
 */
export function getDatabase(): Promise<DB> {
  if (instance) {
    return Promise.resolve(instance);
  }
  if (!initPromise) {
    initPromise = (async () => {
      const db = open({name: DB_NAME});
      await migrate(db);
      instance = db;
      log.debug('db', 'database ready');
      return db;
    })().catch(error => {
      initPromise = null;
      log.error('db', 'failed to open database', error);
      throw error;
    });
  }
  return initPromise;
}

export function closeDatabase(): void {
  try {
    instance?.close();
  } catch (error) {
    log.warn('db', 'close failed', error);
  } finally {
    instance = null;
    initPromise = null;
  }
}
