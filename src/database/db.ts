import {open, type DB} from '@op-engineering/op-sqlite';
import {log} from '../utils/logger';

const DB_NAME = 'gps_location_camera.sqlite';

/**
 * Ordered schema migrations. Entry N upgrades a database at version N to N + 1,
 * so an installed app on any older version is brought forward step by step.
 *
 * Never edit or reorder a shipped entry - existing installs have already run
 * it. To change the schema, append a new entry (e.g. an `ALTER TABLE ... ADD
 * COLUMN`) and its statements will run once on every device that updates.
 */
const MIGRATIONS: ReadonlyArray<ReadonlyArray<string>> = [
  // 0 -> 1: initial schema.
  [
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
  ],
];

const SCHEMA_VERSION = MIGRATIONS.length;

let instance: DB | null = null;
let initPromise: Promise<DB> | null = null;

async function readSchemaVersion(db: DB): Promise<number> {
  const result = await db.execute("SELECT value FROM meta WHERE key = 'schemaVersion'");
  const value = Number(result.rows[0]?.value);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

async function migrate(db: DB): Promise<void> {
  await db.execute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT)');
  const current = await readSchemaVersion(db);
  if (current > SCHEMA_VERSION) {
    // Written by a newer build (e.g. after a downgrade); leave it untouched.
    log.warn('db', `schema version ${current} is newer than ${SCHEMA_VERSION}`);
    return;
  }
  for (let version = current; version < SCHEMA_VERSION; version++) {
    const statements = MIGRATIONS[version] ?? [];
    // Each step and its version bump commit together, so an interrupted
    // upgrade resumes from the last completed step on the next launch.
    await db.transaction(async tx => {
      for (const statement of statements) {
        await tx.execute(statement);
      }
      await tx.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('schemaVersion', ?)", [
        String(version + 1),
      ]);
    });
    log.debug('db', `migrated schema to version ${version + 1}`);
  }
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
