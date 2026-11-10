import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

/**
 * The add-on's own database — docs/ADDONS.md § Own database.
 * Opened on first use, with the core database attached as `core` for joins.
 *
 * @param {{ dataDir: string, id: string, coreDatabasePath: string|null }} options
 */
export function createAddonDatabase({ dataDir, id, coreDatabasePath }) {
  let db = null;

  const open = () => {
    if (db) return db;
    fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(path.join(dataDir, `${id}.sqlite`));
    db.pragma('journal_mode = WAL');
    if (coreDatabasePath && fs.existsSync(coreDatabasePath)) {
      db.prepare('ATTACH DATABASE ? AS core').run(coreDatabasePath);
    }
    return db;
  };

  /**
   * Runs the steps the database hasn't run yet, in one transaction, and records how many
   * ran in `PRAGMA user_version`. Steps are SQL strings or functions receiving the database.
   *
   * @param {Array<string|Function>} steps
   * @returns {number} how many steps ran
   */
  const migrate = (steps) => {
    if (!Array.isArray(steps) || steps.some((step) => typeof step !== 'string' && typeof step !== 'function')) {
      throw new TypeError('migrate() takes an array of SQL strings or functions');
    }
    const database = open();
    const version = database.pragma('user_version', { simple: true });
    if (version > steps.length) {
      throw new Error(
        `the database is at version ${version} but only ${steps.length} steps are declared: ` +
          'released steps must never be removed'
      );
    }
    database.transaction(() => {
      for (const step of steps.slice(version)) {
        if (typeof step === 'function') step(database);
        else database.exec(step);
      }
      database.pragma(`user_version = ${steps.length}`);
    })();
    return steps.length - version;
  };

  const close = () => {
    if (!db) return;
    db.close();
    db = null;
  };

  return { open, migrate, close };
}
