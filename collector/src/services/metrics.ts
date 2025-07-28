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
	projectStats?: Array<{
		project: string;
		commits: number;
		additions: number;
		deletions: number;
	}>;
	hourlyDistribution?: Record<string, number>;
}

export async function getWeeklyMetrics(): Promise<WeeklyMetrics>;
export async function getWeeklyMetrics(format: 'markdown'): Promise<string>;
export async function getWeeklyMetrics(format?: 'markdown'): Promise<WeeklyMetrics | string> {
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
		
		// Return markdown format if requested
		if (format === 'markdown') {
			return formatMetricsAsMarkdown(metrics);
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

export function formatMetricsAsMarkdown(metrics: WeeklyMetrics): string {
	let formatted = `## Weekly Metrics

### Summary
- **Total Commits**: ${metrics.totalCommits}
- **Active Projects**: ${metrics.activeProjects}
- **Active Days**: ${metrics.activeDays} of 7
- **PRs/MRs Merged**: ${metrics.prsMerged}
- **Week-over-Week Change**: ${metrics.weekOverWeekChange > 0 ? '+' : ''}${metrics.weekOverWeekChange} commits (${metrics.weekOverWeekPercent > 0 ? '+' : ''}${metrics.weekOverWeekPercent}%)

### Project Activity`;

	if (metrics.projectStats && metrics.projectStats.length > 0) {
		metrics.projectStats.forEach((project) => {
			formatted += `\n- **${project.project}**: ${project.commits} commits, ${project.additions}+ / ${project.deletions}- lines`;
		});
	} else if (metrics.topProjects && metrics.topProjects.length > 0) {
		metrics.topProjects.forEach((project) => {
			formatted += `\n- **${project.service}**: ${project.commits} commits`;
		});
	}

	if (metrics.hourlyDistribution) {
		formatted += `\n\n### Hourly Commit Distribution\n`;
		const sortedHours = Object.entries(metrics.hourlyDistribution)
			.sort(([a], [b]) => parseInt(a) - parseInt(b))
			.filter(([_, count]) => count > 0);
		
		if (sortedHours.length > 0) {
			sortedHours.forEach(([hour, count]) => {
				const hourNum = parseInt(hour);
				const timeRange = `${hourNum.toString().padStart(2, '0')}:00-${(hourNum + 1).toString().padStart(2, '0')}:00`;
				formatted += `- ${timeRange}: ${count} commits\n`;
			});
		}
	} else if (metrics.commitPatterns && metrics.commitPatterns.length > 0) {
		formatted += `\n\n### Hourly Commit Distribution\n`;
		metrics.commitPatterns
			.filter(pattern => pattern.commits > 0)
			.forEach(pattern => {
				const timeRange = `${pattern.hour.toString().padStart(2, '0')}:00-${(pattern.hour + 1).toString().padStart(2, '0')}:00`;
				formatted += `- ${timeRange}: ${pattern.commits} commits\n`;
			});
	}

	if (metrics.deploymentStats && metrics.deploymentStats.deployments > 0) {
		formatted += `\n\n### Deployments\n`;
		formatted += `- **Total Deployments**: ${metrics.deploymentStats.deployments}\n`;
		formatted += `- **Successful**: ${metrics.deploymentStats.successfulDeployments}\n`;
		formatted += `- **Failed**: ${metrics.deploymentStats.failedDeployments}`;
	}

	return formatted;
}