import { getDb } from '../db/database';
import { promisify } from 'util';
import { logger } from './logger';

export interface WeeklyMetrics {
	totalCommits: number;
	activeProjects: number;
	activeDays: number;
	activeAuthors: number;
	prsMerged: number;
	topProjects: Array<{ service: string; commits: number }>;
	commitPatterns: Array<{ hour: number; commits: number }>;
	weekOverWeekChange: number;
	weekOverWeekPercent: number;
	deploymentStats?: {
		deployments: number;
		successfulDeployments: number;
		failedDeployments: number;
	};
}

export async function getWeeklyMetrics(): Promise<WeeklyMetrics> {
	const db = getDb();
	const allAsync = promisify(db.all.bind(db));
	const getAsync = promisify(db.get.bind(db));

	try {
		// Get this week's metrics
		const commitStats = await getAsync(`
			SELECT 
				COUNT(*) as totalCommits,
				COUNT(DISTINCT service) as activeProjects,
				COUNT(DISTINCT DATE(timestamp)) as activeDays,
				COUNT(DISTINCT author) as activeAuthors
			FROM events 
			WHERE type = 'commit' 
			AND timestamp >= datetime('now', '-7 days')
		`) as any;
		
		// PRs merged this week
		const prStats = await getAsync(`
			SELECT COUNT(*) as prsMerged
			FROM events 
			WHERE type = 'pr_merged' 
			AND timestamp >= datetime('now', '-7 days')
		`) as any;
		
		// Top projects
		const topProjects = await allAsync(`
			SELECT service, COUNT(*) as commits
			FROM events 
			WHERE type = 'commit' 
			AND timestamp >= datetime('now', '-7 days')
			GROUP BY service
			ORDER BY commits DESC
			LIMIT 5
		`) as any[];
		
		// Commit patterns by hour
		const commitPatterns = await allAsync(`
			SELECT 
				CAST(strftime('%H', timestamp) as INTEGER) as hour,
				COUNT(*) as commits
			FROM events 
			WHERE type = 'commit' 
			AND timestamp >= datetime('now', '-7 days')
			GROUP BY hour
			ORDER BY hour
		`) as any[];
		
		// Week over week comparison
		const lastWeekStats = await getAsync(`
			SELECT COUNT(*) as lastWeekCommits
			FROM events 
			WHERE type = 'commit' 
			AND timestamp >= datetime('now', '-14 days')
			AND timestamp < datetime('now', '-7 days')
		`) as any;
		
		// Optional: include deployment stats if any exist
		const deploymentStats = await getAsync(`
			SELECT 
				COUNT(*) as deployments,
				COUNT(CASE WHEN status = 'success' THEN 1 END) as successfulDeployments,
				COUNT(CASE WHEN status = 'failure' THEN 1 END) as failedDeployments
			FROM events 
			WHERE type = 'deployment' 
			AND timestamp >= datetime('now', '-7 days')
		`) as any;
		
		const metrics: WeeklyMetrics = {
			...commitStats,
			prsMerged: prStats.prsMerged,
			topProjects,
			commitPatterns,
			weekOverWeekChange: commitStats.totalCommits - lastWeekStats.lastWeekCommits,
			weekOverWeekPercent: lastWeekStats.lastWeekCommits > 0 
				? Math.round(((commitStats.totalCommits - lastWeekStats.lastWeekCommits) / lastWeekStats.lastWeekCommits) * 100)
				: 0
		};
		
		// Include deployment data only if deployments exist
		if (deploymentStats.deployments > 0) {
			metrics.deploymentStats = deploymentStats;
		}
		
		return metrics;
	} catch (error) {
		logger.error('Error getting weekly metrics:', error);
		throw error;
	}
}

export async function getCommitFrequency(days: number = 30): Promise<any[]> {
	const db = getDb();
	const allAsync = promisify(db.all.bind(db));
	
	const result = await allAsync(`
		SELECT * FROM commit_frequency 
		WHERE date >= date('now', '-${days} days')
		ORDER BY date
	`);
	
	return result as any[];
}

export async function getProjectActivity(limit: number = 20): Promise<any[]> {
	const db = getDb();
	const allAsync = promisify(db.all.bind(db));
	
	const result = await allAsync(`
		SELECT * FROM project_activity 
		WHERE commits_last_month > 0
		ORDER BY commits_last_month DESC
		LIMIT ${limit}
	`);
	
	return result as any[];
}

export async function getWeeklyProductivity(weeks: number = 12): Promise<any[]> {
	const db = getDb();
	const allAsync = promisify(db.all.bind(db));
	
	const result = await allAsync(`
		SELECT * FROM weekly_productivity 
		ORDER BY week DESC
		LIMIT ${weeks}
	`);
	
	return result as any[];
}

export async function getDailyCommitPatterns(): Promise<any[]> {
	const db = getDb();
	const allAsync = promisify(db.all.bind(db));
	
	const result = await allAsync(`
		SELECT * FROM daily_commit_pattern 
		ORDER BY hour
	`);
	
	return result as any[];
}