import { env } from '../config';
import { logger } from './logger';
import { scanGitHubRepos } from './github';
import { scanGitLabGroups } from './gitlab';

export class PollingService {
	private intervalId: NodeJS.Timeout | null = null;
	private isRunning = false;

	start() {
		const { POLLING_INTERVAL_MINUTES, POLLING_LOOKBACK_HOURS } = env;

		// Check if we have PATs configured
		if (!env.GITHUB_PAT && !env.GITLAB_PAT) {
			logger.info('Polling service not started: no GitHub or GitLab PATs configured');
			return;
		}

		if (POLLING_INTERVAL_MINUTES === 'never') {
			logger.info('Polling is disabled (POLLING_INTERVAL_MINUTES=never)');
			return;
		}

		const intervalMinutes = parseInt(POLLING_INTERVAL_MINUTES, 10);
		if (isNaN(intervalMinutes) || intervalMinutes <= 0) {
			logger.error(`Invalid POLLING_INTERVAL_MINUTES value: ${POLLING_INTERVAL_MINUTES}`);
			return;
		}

		logger.info(`Starting polling service: will poll every ${intervalMinutes} minutes for changes in the last ${POLLING_LOOKBACK_HOURS} hours`);

		// Run immediately on start
		this.poll();

		// Schedule periodic runs
		this.intervalId = setInterval(() => {
			this.poll();
		}, intervalMinutes * 60 * 1000);
	}

	stop() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
			logger.info('Polling service stopped');
		}
	}

	private async poll() {
		if (this.isRunning) {
			logger.info('Polling already in progress, skipping this iteration');
			return;
		}

		this.isRunning = true;
		const startTime = Date.now();

		try {
			logger.info('Starting periodic poll for recent changes');

			// Run both scans in parallel
			const results = await Promise.allSettled([
				this.pollGitHub(),
				this.pollGitLab()
			]);

			// Report results
			results.forEach((result, index) => {
				const platform = index === 0 ? 'GitHub' : 'GitLab';
				if (result.status === 'rejected') {
					logger.error(`${platform} polling failed:`, result.reason);
				}
			});

			const duration = Math.round((Date.now() - startTime) / 1000);
			logger.info(`Polling completed in ${duration} seconds`);
		} catch (error) {
			logger.error('Error during polling:', error);
		} finally {
			this.isRunning = false;
		}
	}

	private async pollGitHub() {
		if (!env.GITHUB_PAT) {
			logger.debug('Skipping GitHub polling: no PAT configured');
			return;
		}

		try {
			await scanGitHubRepos();
		} catch (error) {
			logger.error('GitHub polling error:', error);
			throw error;
		}
	}

	private async pollGitLab() {
		if (!env.GITLAB_PAT) {
			logger.debug('Skipping GitLab polling: no PAT configured');
			return;
		}

		try {
			await scanGitLabGroups();
		} catch (error) {
			logger.error('GitLab polling error:', error);
			throw error;
		}
	}
}

// Export singleton instance
export const pollingService = new PollingService();