import { Octokit } from '@octokit/rest';
import { env } from '../config';
import { logger } from './logger';
import { insertEvent, commitExists, prExists } from '../db/queries';

// Initialize Octokit client
const octokit = env.GITHUB_PAT ? new Octokit({ auth: env.GITHUB_PAT }) : null;

export async function processGitHubWebhook(eventType: string, payload: any): Promise<void> {
	try {
		// Process different webhook types
		if (eventType === 'push') {
			// Handle push events - primary focus
			for (const commit of payload.commits || []) {
				await insertEvent({
					source: 'github',
					type: 'commit',
					service: payload.repository.full_name,
					commit_sha: commit.id,
					timestamp: commit.timestamp,
					author: commit.author?.email,
					raw_data: commit
				});
			}
			logger.info(`Recorded ${payload.commits?.length || 0} commits from ${payload.repository.full_name}`);
		} else if (eventType === 'pull_request' && payload.action === 'closed' && payload.pull_request?.merged) {
			// Handle merged PRs - secondary focus
			await insertEvent({
				source: 'github',
				type: 'pr_merged',
				service: payload.repository.full_name,
				pr_number: payload.pull_request.number.toString(),
				commit_sha: payload.pull_request.merge_commit_sha,
				timestamp: payload.pull_request.merged_at,
				author: payload.pull_request.user?.email || payload.pull_request.user?.login,
				raw_data: payload
			});
			logger.info(`Recorded merged PR #${payload.pull_request.number} in ${payload.repository.full_name}`);
		} else if (eventType === 'deployment_status') {
			// Handle deployment events
			await insertEvent({
				source: 'github',
				type: 'deployment',
				service: payload.repository.full_name,
				environment: payload.deployment.environment,
				commit_sha: payload.deployment.sha,
				status: payload.deployment_status.state === 'success' ? 'success' : 
					payload.deployment_status.state === 'failure' ? 'failure' : 'rollback',
				timestamp: payload.deployment_status.created_at,
				raw_data: payload
			});
			logger.info(`Recorded deployment to ${payload.deployment.environment} in ${payload.repository.full_name}`);
		} else {
			logger.debug(`Ignored GitHub webhook event: ${eventType}`);
		}
	} catch (error) {
		logger.error('Error processing GitHub webhook:', error);
		throw error;
	}
}

export async function scanGitHubRepos(): Promise<void> {
	if (!octokit) {
		return;
	}
	
	logger.info('Scanning GitHub for your contributions');
	
	try {
		// Get authenticated user info
		const { data: user } = await octokit.users.getAuthenticated();
		const username = user.login;
		
		logger.info(`Tracking contributions for: ${username}`);
		
		// Get all repositories the user has access to
		const { data: repos } = await octokit.repos.listForAuthenticatedUser({
			visibility: 'all',
			affiliation: 'owner,collaborator,organization_member',
			per_page: 100,
			sort: 'pushed'
		});
		
		logger.info(`Found ${repos.length} accessible repositories`);
		
		for (const repo of repos) {
			try {
				// Get commits by the user in the lookback period
				const { data: commits } = await octokit.repos.listCommits({
					owner: repo.owner?.login || '',
					repo: repo.name,
					author: username,
					since: new Date(Date.now() - env.POLLING_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString(),
					per_page: 100
				});
				
				if (commits.length > 0) {
					logger.info(`Found ${commits.length} commits by ${username} in ${repo.full_name}`);
				}
				
				for (const commit of commits) {
					// Skip if already exists
					if (await commitExists(commit.sha, 'github')) {
						continue;
					}
					
					await insertEvent({
						source: 'github',
						type: 'commit',
						service: repo.full_name, // Use full name to show org/repo
						commit_sha: commit.sha,
						timestamp: commit.commit.author?.date || new Date().toISOString(),
						author: commit.commit.author?.email || username,
						raw_data: commit
					});
				}
			} catch (error: any) {
				// Don't fail the whole scan if one repo fails
				logger.debug(`Error scanning repo ${repo.name}:`, error.message);
			}
		}
		
		// Also get your recent activity (issues, PRs, etc.)
		const { data: events } = await octokit.activity.listEventsForAuthenticatedUser({
			username,
			per_page: 100
		});
		
		for (const event of events) {
			// Track PR merges as deployments (common in many workflows)
			if (event.type === 'PullRequestEvent' && event.payload.action === 'closed') {
				const payload = event.payload as any;
				if (payload.pull_request?.merged) {
					const pr = payload.pull_request;
					
					// Skip if already exists
					if (await prExists(pr.number.toString(), event.repo.name, 'github')) {
						continue;
					}
					
					await insertEvent({
						source: 'github',
						type: 'pr_merged',
						service: event.repo.name,
						pr_number: pr.number.toString(),
						commit_sha: pr.merge_commit_sha || pr.head.sha,
						timestamp: pr.merged_at || event.created_at,
						author: username,
						raw_data: event
					});
				}
			}
		}
		
	} catch (error) {
		logger.error('Error scanning GitHub:', error);
		logger.info('Ensure your GitHub PAT has "repo" and "read:user" scopes.');
	}
}