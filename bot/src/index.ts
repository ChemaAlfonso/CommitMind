import axios from 'axios';
import { logger } from './logger';
import { env } from './config';

const API_TOKEN = env.API_TOKEN;
const API_URL = env.API_URL;

async function main() {
	try {
		logger.info('Generating and sending weekly developer metrics summary...');
		
		// Generate summary and send to Slack in one call
		await axios.post(`${API_URL}/api/metrics/bot/slack`, {}, {
			headers: { Authorization: `Bearer ${API_TOKEN}` }
		});
		
		logger.info('Weekly metrics summary sent to Slack successfully');
		
	} catch (error) {
		logger.error({ error }, 'Error generating summary');
		// If Slack webhook is not configured, we might want to just generate the summary
		if (axios.isAxiosError(error) && error.response?.data?.error?.includes('SLACK_WEBHOOK_URL')) {
			logger.info('Slack webhook not configured, generating summary only...');
			try {
				const response = await axios.post(`${API_URL}/api/metrics/bot/summary`, {}, {
					headers: { Authorization: `Bearer ${API_TOKEN}` }
				});
				logger.info({ summary: response.data.summary }, 'Summary generated');
			} catch (summaryError) {
				logger.error({ error: summaryError }, 'Error generating summary');
			}
		}
	}
}

main();