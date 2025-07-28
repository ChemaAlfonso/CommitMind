import { logger } from '../services/logger';
import { env } from '../config';

async function sendReport() {
	try {
		const apiUrl = env.API_URL;
		const apiToken = env.API_TOKEN;

		if (!apiToken) {
			throw new Error('API_TOKEN not configured');
		}

		logger.info('📊 Sending metrics report via configured notification channels...');

		const response = await fetch(`${apiUrl}/api/metrics/bot/notify`, {
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

		logger.info('✅ Report sent successfully!');

	} catch (error) {
		logger.error('Failed to send report:', error);
		logger.error({ error }, '❌ Failed to send report');
		process.exit(1);
	}
}

if (require.main === module) {
	sendReport();
}