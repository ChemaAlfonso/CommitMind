import { getDb } from './database';
import { promisify } from 'util';
import { logger } from '../services/logger';

interface Migration {
	version: number;
	name: string;
	up: string;
}

// Note: Since this is a new app not in production, we've consolidated all migrations
// into a single initial schema. Future changes should be added as new migrations.
const migrations: Migration[] = [
	{
		version: 1,
		name: 'initial_schema',
		up: `
			-- Core events table
			CREATE TABLE IF NOT EXISTS events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				source TEXT NOT NULL,
				type TEXT NOT NULL,
				service TEXT NOT NULL,
				environment TEXT,
				commit_sha TEXT,
				pr_number TEXT,
				status TEXT,
				timestamp DATETIME NOT NULL,
				author TEXT,
				raw_data JSON,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			
			-- Indexes for performance
			CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
			CREATE INDEX IF NOT EXISTS idx_events_service ON events(service);
			CREATE INDEX IF NOT EXISTS idx_events_commit ON events(commit_sha);
			CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
			CREATE INDEX IF NOT EXISTS idx_events_author ON events(author);
			
			-- Commit Frequency: commits per day
			CREATE VIEW IF NOT EXISTS commit_frequency AS
			SELECT 
				DATE(timestamp) as date,
				COUNT(*) as commit_count,
				COUNT(DISTINCT service) as projects_touched,
				COUNT(DISTINCT author) as authors
			FROM events
			WHERE type = 'commit'
			GROUP BY DATE(timestamp);
			
			-- PR/MR Activity: merged PRs per day
			CREATE VIEW IF NOT EXISTS pr_activity AS
			SELECT 
				DATE(timestamp) as date,
				COUNT(*) as pr_count,
				COUNT(DISTINCT service) as projects_with_prs,
				source
			FROM events
			WHERE type = 'pr_merged'
			GROUP BY DATE(timestamp), source;
			
			-- Weekly Productivity: commits per week
			CREATE VIEW IF NOT EXISTS weekly_productivity AS
			SELECT 
				strftime('%Y-W%W', timestamp) as week,
				COUNT(*) as commit_count,
				COUNT(DISTINCT DATE(timestamp)) as days_active,
				COUNT(DISTINCT service) as projects_touched,
				ROUND(CAST(COUNT(*) as FLOAT) / COUNT(DISTINCT DATE(timestamp)), 1) as avg_commits_per_day
			FROM events
			WHERE type = 'commit'
			GROUP BY strftime('%Y-W%W', timestamp);
			
			-- Project Activity: all time stats with recent activity columns
			CREATE VIEW IF NOT EXISTS project_activity AS
			SELECT 
				service,
				COUNT(*) as total_commits,
				COUNT(DISTINCT DATE(timestamp)) as days_active,
				MAX(timestamp) as last_commit,
				COUNT(CASE WHEN timestamp >= datetime('now', '-7 days') THEN 1 END) as commits_last_week,
				COUNT(CASE WHEN timestamp >= datetime('now', '-30 days') THEN 1 END) as commits_last_month
			FROM events
			WHERE type = 'commit'
			GROUP BY service
			ORDER BY total_commits DESC;
			
			-- Daily Commit Pattern: hourly distribution
			CREATE VIEW IF NOT EXISTS daily_commit_pattern AS
			SELECT 
				CAST(strftime('%H', timestamp) as INTEGER) as hour,
				COUNT(*) as commit_count,
				ROUND(CAST(COUNT(*) as FLOAT) * 100.0 / (SELECT COUNT(*) FROM events WHERE type = 'commit'), 1) as percentage
			FROM events
			WHERE type = 'commit'
			GROUP BY hour
			ORDER BY hour;
			
			-- Monthly Trends: commits per month
			CREATE VIEW IF NOT EXISTS monthly_trends AS
			SELECT 
				strftime('%Y-%m', timestamp) as month,
				COUNT(*) as total_commits,
				COUNT(DISTINCT service) as unique_projects,
				COUNT(DISTINCT DATE(timestamp)) as active_days,
				COUNT(DISTINCT author) as unique_authors,
				ROUND(CAST(COUNT(*) as FLOAT) / COUNT(DISTINCT DATE(timestamp)), 1) as avg_commits_per_day
			FROM events
			WHERE type = 'commit'
			GROUP BY strftime('%Y-%m', timestamp)
			ORDER BY month DESC;
			
			-- Collaboration Metrics: commits on shared projects
			CREATE VIEW IF NOT EXISTS collaboration_metrics AS
			SELECT 
				service,
				COUNT(DISTINCT author) as contributors,
				COUNT(*) as total_commits,
				ROUND(CAST(COUNT(*) as FLOAT) / COUNT(DISTINCT author), 1) as avg_commits_per_contributor
			FROM events
			WHERE type = 'commit'
			GROUP BY service
			HAVING COUNT(DISTINCT author) > 1
			ORDER BY contributors DESC;
		`
	}
];

export async function runMigrations(): Promise<void> {
	const db = getDb();
	const runAsync = promisify(db.run.bind(db));
	const getAsync = promisify(db.get.bind(db));
	
	// Create migrations table
	await runAsync(`
		CREATE TABLE IF NOT EXISTS migrations (
			version INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`);
	
	// Get current version
	const result = await getAsync('SELECT MAX(version) as version FROM migrations') as any;
	const currentVersion = result?.version || 0;
	
	logger.info(`Current migration version: ${currentVersion}`);
	
	// Run pending migrations
	for (const migration of migrations) {
		if (migration.version > currentVersion) {
			logger.info(`Running migration ${migration.version}: ${migration.name}`);
			
			try {
				// Split migration by semicolons and run each statement
				const statements = migration.up.split(';').filter(s => s.trim());
				for (const statement of statements) {
					await runAsync(statement);
				}
				
				// Record migration
				await runAsync(
					`INSERT INTO migrations (version, name) VALUES ('${migration.version}', '${migration.name}')`
				);
				
				logger.info(`Migration ${migration.version} completed`);
			} catch (error) {
				logger.error(`Migration ${migration.version} failed:`, error);
				throw error;
			}
		}
	}
	
	logger.info('All migrations completed');
}

// CLI runner
if (require.main === module) {
	runMigrations()
		.then(() => process.exit(0))
		.catch(() => process.exit(1));
}