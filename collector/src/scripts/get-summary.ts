import { logger } from '../services/logger';
import { env } from '../config';

async function getSummary() {
	try {
		const apiUrl = env.API_URL;
		const apiToken = env.API_TOKEN;

		if (!apiToken) {
			throw new Error('API_TOKEN not configured');
		}

		logger.info('📊 Getting metrics summary...');

		const response = await fetch(`${apiUrl}/api/metrics/bot/summary`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiToken}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to get summary (HTTP ${response.status}): ${error}`);
		}

		const data = await response.json() as {
			summary: string;
			metrics: {
				totalCommits: number;
				activeProjects: number;
				activeDays: number;
				prsMerged: number;
				weekOverWeekChange: string;
			};
		};

		logger.info('✅ Summary generated successfully!');
		logger.info({ summary: data.summary }, 'Generated summary');
		logger.info({ metrics: {
			totalCommits: data.metrics.totalCommits,
			activeProjects: data.metrics.activeProjects,
			activeDays: data.metrics.activeDays,
			prsMerged: data.metrics.prsMerged,
			weekOverWeekChange: data.metrics.weekOverWeekChange
		} }, '📈 Metrics');

	} catch (error) {
		logger.error('Failed to get summary:', error);
		logger.error({ error }, '❌ Failed to get summary');
		process.exit(1);
	}
}

if (require.main === module) {
	getSummary();
}