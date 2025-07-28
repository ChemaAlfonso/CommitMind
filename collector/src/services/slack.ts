import axios from 'axios';
import { env } from '../config';
import { logger } from './logger';

export async function sendToSlack(summary: string, metrics: any): Promise<void> {
	if (!env.SLACK_WEBHOOK_URL) {
		throw new Error('SLACK_WEBHOOK_URL not configured');
	}

	// Convert markdown to Slack format and clean up the summary
	const cleanSummary = summary
		.replace(/\*\*(.*?)\*\*/g, '*$1*')  // Convert bold **text** to *text*
		.replace(/\*(.*?)\*/g, '_$1_')      // Convert italic *text* to _text_
		.replace(/#{1,6}\s/g, '')           // Remove headers
		.replace(/```[\s\S]*?```/g, '')     // Remove code blocks
		.replace(/`([^`]+)`/g, '`$1`')      // Keep inline code
		.trim();

	const message = {
		blocks: [
			{
				type: 'header',
				text: {
					type: 'plain_text',
					text: '📊 Reporte Semanal de Métricas de Desarrollo'
				}
			},
			{
				type: 'divider'
			},
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: cleanSummary
				}
			},
			{
				type: 'divider'
			},
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: '*📈 Métricas de la Semana:*'
				}
			},
			{
				type: 'section',
				fields: [
					{
						type: 'mrkdwn',
						text: `*Total de Commits:* ${metrics.totalCommits || 0}`
					},
					{
						type: 'mrkdwn',
						text: `*Proyectos Activos:* ${metrics.activeProjects || 0}`
					},
					{
						type: 'mrkdwn',
						text: `*Días Activos:* ${metrics.activeDays || 0}`
					},
					{
						type: 'mrkdwn',
						text: `*PRs Fusionados:* ${metrics.prsMerged || 0}`
					}
				]
			},
			{
				type: 'context',
				elements: [
					{
						type: 'mrkdwn',
						text: `⏰ _Generado el ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}_`
					}
				]
			}
		]
	};

	try {
		await axios.post(env.SLACK_WEBHOOK_URL, message);
		logger.info('Metrics summary sent to Slack');
	} catch (error) {
		logger.error('Error sending to Slack:', error);
		throw new Error('Failed to send metrics to Slack');
	}
}