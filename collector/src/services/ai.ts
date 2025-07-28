import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config';
import { logger } from './logger';
import { WeeklyMetrics, formatMetricsAsMarkdown } from './metrics';

export async function generateAISummary(metrics: WeeklyMetrics): Promise<string> {
	const formattedMetrics = formatMetricsAsMarkdown(metrics);
	const language = env.REPORTS_LANGUAGE || 'English';
	const prompt = `You are a developer productivity analyst. Analyze these weekly metrics and provide insights:

${formattedMetrics}

Key focus areas:
1. Commit patterns and consistency
2. Activity distribution across projects
3. Productivity trends and week-over-week changes
4. Work-life balance (based on commit hours)
5. Collaboration patterns (merged PRs, active projects)

${metrics.deploymentStats ? 'Also note: There were ' + metrics.deploymentStats.deployments + ' deployments this week.' : ''}

Provide actionable insights about developer effectiveness and health. Be encouraging and constructive. Keep it concise.
IMPORTANT: Respond in ${language} and use simple format without markdown (don't use **, *, #, etc).`;

	try {
		if (env.AI_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY) {
			const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
			const response = await anthropic.messages.create({
				model: 'claude-3-opus-20240229',
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 500
			});
			return response.content[0].type === 'text' ? response.content[0].text : 'Unable to generate summary';
		} else if (env.OPENAI_API_KEY) {
			const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
			const response = await openai.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 500
			});
			return response.choices[0].message.content || 'Unable to generate summary';
		} else {
			return 'No AI provider configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY.';
		}
	} catch (error) {
		logger.error('Error generating AI summary:', error);
		return 'Error generating AI summary. Please check your API keys and try again.';
	}
}