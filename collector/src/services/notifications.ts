import { env } from '../config';
import { logger } from './logger';
import { sendToSlack } from './slack';
import { sendEmail } from './email';

export interface NotificationOptions {
	summary: string;
	metrics: any;
}

export async function sendNotifications(options: NotificationOptions): Promise<void> {
	const { summary, metrics } = options;
	const errors: Error[] = [];
	let successCount = 0;

	// Send to Slack if enabled
	if (env.SLACK_ENABLED) {
		try {
			await sendToSlack(summary, metrics);
			successCount++;
			logger.info('Notification sent to Slack successfully');
		} catch (error) {
			const slackError = new Error(`Slack notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			errors.push(slackError);
			logger.error('Failed to send Slack notification:', error);
		}
	} else {
		logger.debug('Slack notifications are disabled');
	}

	// Send email if enabled
	if (env.EMAIL_ENABLED) {
		try {
			await sendEmail(summary, metrics);
			successCount++;
			logger.info('Notification sent via email successfully');
		} catch (error) {
			const emailError = new Error(`Email notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			errors.push(emailError);
			logger.error('Failed to send email notification:', error);
		}
	} else {
		logger.debug('Email notifications are disabled');
	}

	// Check if at least one notification method is enabled
	if (!env.SLACK_ENABLED && !env.EMAIL_ENABLED) {
		logger.warn('No notification methods are enabled. Enable SLACK_ENABLED or EMAIL_ENABLED in environment variables.');
	}

	// If all enabled methods failed, throw an error
	if (errors.length > 0 && successCount === 0) {
		const combinedMessage = errors.map(e => e.message).join('; ');
		throw new Error(`All notification methods failed: ${combinedMessage}`);
	}

	// Log partial success
	if (errors.length > 0 && successCount > 0) {
		logger.warn(`Partial notification failure: ${successCount} succeeded, ${errors.length} failed`);
	}
}