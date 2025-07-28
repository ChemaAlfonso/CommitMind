import { getDb } from './database';

export interface Event {
	id?: number;
	source: 'github' | 'gitlab' | 'manual';
	type: 'commit' | 'pr_opened' | 'pr_merged' | 'deployment';
	service: string;
	environment?: string;
	commit_sha?: string;
	pr_number?: string;
	status?: 'success' | 'failure' | 'rollback';
	timestamp: string;
	author?: string;
	raw_data?: any;
}

export async function insertEvent(event: Event): Promise<void> {
	const db = getDb();
	
	return new Promise((resolve, reject) => {
		db.run(
			`INSERT INTO events (source, type, service, environment, commit_sha, pr_number, status, timestamp, author, raw_data)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				event.source,
				event.type,
				event.service,
				event.environment,
				event.commit_sha,
				event.pr_number,
				event.status,
				event.timestamp,
				event.author,
				JSON.stringify(event.raw_data)
			],
			(err) => {
				if (err) reject(err);
				else resolve();
			}
		);
	});
}

export async function commitExists(commitSha: string, source: string): Promise<boolean> {
	const db = getDb();
	
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT COUNT(*) as count FROM events WHERE commit_sha = ? AND source = ? AND type = 'commit'`,
			[commitSha, source],
			(err, row: any) => {
				if (err) reject(err);
				else resolve(row.count > 0);
			}
		);
	});
}

export async function prExists(prNumber: string, service: string, source: string): Promise<boolean> {
	const db = getDb();
	
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT COUNT(*) as count FROM events WHERE pr_number = ? AND service = ? AND source = ? AND type = 'pr_merged'`,
			[prNumber, service, source],
			(err, row: any) => {
				if (err) reject(err);
				else resolve(row.count > 0);
			}
		);
	});
}