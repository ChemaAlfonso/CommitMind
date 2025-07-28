import { config } from 'dotenv';
import { logger } from '../services/logger';
import * as path from 'path';

// Load environment variables
const envPath = process.env.NODE_ENV === 'production' 
	? path.resolve(process.cwd(), '.env')
	: path.resolve(process.cwd(), '..', '.env.local');
config({ path: envPath });

async function sendReport() {
	try {
		const apiUrl = process.env.API_URL || 'http://localhost:3000';
		const apiToken = process.env.API_TOKEN;

		if (!apiToken) {
			throw new Error('API_TOKEN not configured');
		}

		console.log('📊 Sending metrics report to Slack...');

		const response = await fetch(`${apiUrl}/api/metrics/bot/slack`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiToken}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to send report (HTTP ${response.status}): ${error}`);
		}

		console.log('✅ Report sent to Slack successfully!');

	} catch (error) {
		logger.error('Failed to send report:', error);
		console.error('❌', error instanceof Error ? error.message : 'Unknown error');
		process.exit(1);
	}
}

if (require.main === module) {
	sendReport();
}