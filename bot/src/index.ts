import axios from 'axios';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

const API_TOKEN = process.env.API_TOKEN;
const API_URL = process.env.API_URL || 'http://collector:3000';

async function main() {
	try {
		console.log('Generating and sending weekly developer metrics summary...');
		
		// Generate summary and send to Slack in one call
		await axios.post(`${API_URL}/api/metrics/bot/slack`, {}, {
			headers: { Authorization: `Bearer ${API_TOKEN}` }
		});
		
		console.log('Weekly metrics summary sent to Slack successfully');
		
	} catch (error) {
		console.error('Error generating summary:', error);
		// If Slack webhook is not configured, we might want to just generate the summary
		if (axios.isAxiosError(error) && error.response?.data?.error?.includes('SLACK_WEBHOOK_URL')) {
			console.log('Slack webhook not configured, generating summary only...');
			try {
				const response = await axios.post(`${API_URL}/api/metrics/bot/summary`, {}, {
					headers: { Authorization: `Bearer ${API_TOKEN}` }
				});
				console.log('Summary generated:', response.data.summary);
			} catch (summaryError) {
				console.error('Error generating summary:', summaryError);
			}
		}
	}
}

main();