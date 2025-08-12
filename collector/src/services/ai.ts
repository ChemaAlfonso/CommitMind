import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config';
import { logger } from './logger';
import { WeeklyMetrics, formatMetricsAsMarkdown } from './metrics';

export async function generateAISummary(metrics: WeeklyMetrics): Promise<string> {
	const formattedMetrics = formatMetricsAsMarkdown(metrics);
	const language = env.REPORTS_LANGUAGE || 'English';
	const prToCommitRatio = metrics.totalCommits > 0 ? (metrics.prsMerged / metrics.totalCommits).toFixed(2) : '0';
	
	const prompt = `You are a developer productivity analyst. Analyze these weekly metrics and provide insights:

${formattedMetrics}

Provide a structured analysis focusing on:

1. **Productivity Health Score** (1-10):
   - Based on consistency (active days), volume, and week-over-week trend
   - Flag if commits < 10 (low activity) or > 200 (possible burnout risk)

2. **Work Patterns Analysis**:
   - Identify peak productivity hours from the hourly distribution
   - Detect concerning patterns (late night work after 20:00, weekend activity)
   - Suggest optimal focus time blocks based on commit distribution

3. **Project Focus Assessment**:
   - Identify if effort is well-distributed or too scattered (>5 projects might indicate context switching)
   - Highlight the main focus area (project with most commits)
   - Note if working on ${metrics.activeProjects} projects is optimal for productivity

4. **Momentum Indicators**:
   - Interpret the ${metrics.weekOverWeekPercent}% week-over-week change meaningfully
   - If negative > 30%: possible vacation/break or blockers
   - If positive > 50%: sprint push or catching up
   - Stable (±15%): consistent rhythm

5. **Collaboration Health**:
   - PRs/Commits ratio: ${prToCommitRatio} (${metrics.prsMerged} PRs / ${metrics.totalCommits} commits)
   - Low ratio (<0.1) might indicate solo work
   - High ratio (>0.3) suggests good review culture

6. **Actionable Recommendations** (pick 2-3 most relevant):
   - If low activity: suggest breaking tasks into smaller commits
   - If late hours detected: recommend shifting schedule for better work-life balance
   - If scattered across many projects: suggest time-boxing for focus
   - If declining trend: check for blockers or need for break
   - Based on ${metrics.activeDays} active days out of 7

${metrics.deploymentStats ? `\n7. **Deployment Quality**: ${metrics.deploymentStats.successfulDeployments}/${metrics.deploymentStats.deployments} success rate - ${metrics.deploymentStats.failedDeployments === 0 ? 'Excellent stability!' : 'Review failed deployments for improvement opportunities'}` : ''}

Keep the tone encouraging and constructive. Focus on sustainable practices.
Format: Brief paragraph for each section, no markdown formatting.
IMPORTANT: Respond in ${language}.`;

	try {
		if (env.AI_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY) {
			const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
			const response = await anthropic.messages.create({
				model: env.ANTHROPIC_MODEL,
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 800
			});
			return response.content[0].type === 'text' ? response.content[0].text : 'Unable to generate summary';
		} else if (env.OPENAI_API_KEY) {
			const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
			const response = await openai.chat.completions.create({
				model: env.OPENAI_MODEL,
				messages: [{ role: 'user', content: prompt }]
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