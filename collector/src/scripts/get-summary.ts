import { config } from 'dotenv';
import { logger } from '../services/logger';
import * as path from 'path';

// Load environment variables
const envPath = process.env.NODE_ENV === 'production' 
	? path.resolve(process.cwd(), '.env')
	: path.resolve(process.cwd(), '..', '.env.local');
config({ path: envPath });

async function getSummary() {
	try {
		const apiUrl = process.env.API_URL || 'http://localhost:3000';
		const apiToken = process.env.API_TOKEN;

		if (!apiToken) {
			throw new Error('API_TOKEN not configured');
		}

		console.log('📊 Getting metrics summary...');

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

		console.log('✅ Summary generated successfully!');
		console.log('');
		console.log(data.summary);
		console.log('');
		console.log('📈 Metrics:');
		console.log(JSON.stringify({
			totalCommits: data.metrics.totalCommits,
			activeProjects: data.metrics.activeProjects,
			activeDays: data.metrics.activeDays,
			prsMerged: data.metrics.prsMerged,
			weekOverWeekChange: data.metrics.weekOverWeekChange
		}, null, 2));

	} catch (error) {
		logger.error('Failed to get summary:', error);
		console.error('❌', error instanceof Error ? error.message : 'Unknown error');
		process.exit(1);
	}
}

if (require.main === module) {
	getSummary();
}