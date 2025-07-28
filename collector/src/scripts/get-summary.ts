import { logger } from '../services/logger';
import { getWeeklyMetrics, formatMetricsAsMarkdown } from '../services/metrics';
import { generateAISummary } from '../services/ai';

// Check command line arguments
const args = process.argv.slice(2);
const useMarkdown = args.includes('--markdown') || args.includes('-m');

async function getSummary() {
	try {
		logger.info('📊 Getting metrics summary...');

		// Get metrics directly from database
		const metrics = await getWeeklyMetrics();
		
		if (useMarkdown) {
			// Just output the markdown metrics
			const markdownMetrics = formatMetricsAsMarkdown(metrics);
			console.log(markdownMetrics);
			
			// Also generate AI summary if available
			try {
				const summary = await generateAISummary(metrics);
				console.log('\n## AI Summary\n');
				console.log(summary);
			} catch (aiError) {
				logger.warn('Could not generate AI summary:', aiError);
			}
		} else {
			// Generate AI summary
			const summary = await generateAISummary(metrics);
			logger.info('✅ Summary generated successfully!');
			logger.info({ summary }, 'Generated summary');
			logger.info({ metrics }, '📈 Metrics');
		}

	} catch (error) {
		logger.error('Failed to get summary:', error);
		logger.error({ error }, '❌ Failed to get summary');
		process.exit(1);
	}
}

if (require.main === module) {
	getSummary();
}