import sqlite3 from 'sqlite3';
import { env } from '../config';
import { logger } from '../services/logger';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import { runMigrations } from './migrations';

let db: sqlite3.Database;

export function getDb(): sqlite3.Database {
	if (!db) {
		// Ensure directory exists
		const dir = dirname(env.SQLITE_PATH);
		logger.info(`Creating database directory: ${dir}`);
		mkdirSync(dir, { recursive: true });

		logger.info(`Opening database at: ${env.SQLITE_PATH}`);
		db = new sqlite3.Database(env.SQLITE_PATH, (err) => {
			if (err) {
				logger.error('Error opening database:', err);
				throw err;
			}
			logger.info(`Connected to SQLite database at ${env.SQLITE_PATH}`);
		});
		
		// Enable foreign keys
		db.run('PRAGMA foreign_keys = ON');
		// Disable WAL mode for better compatibility with read-only containers
		db.run('PRAGMA journal_mode = DELETE');
		db.run('PRAGMA busy_timeout = 5000');
		// Ensure changes are written immediately
		db.run('PRAGMA synchronous = FULL');
	}
	return db;
}

export async function initDatabase(): Promise<void> {
	// Just run migrations
	await runMigrations();
}