import { Gitlab } from '@gitbeaker/rest';
import { env } from '../config';
import { logger } from './logger';
import { insertEvent, commitExists, prExists } from '../db/queries';

// Initialize GitLab client
const gitlab = env.GITLAB_PAT ? new Gitlab({
	token: env.GITLAB_PAT,
	host: 'https://gitlab.com'
}) : null;

export async function processGitLabWebhook(eventType: string, payload: any): Promise<void> {
	try {
		const projectPath = payload.project?.path_with_namespace || payload.project?.name || 'unknown';
		
		if (eventType === 'Push Hook' || eventType === 'push') {
			// Handle push events - primary focus
			const commits = payload.commits || [];
			for (const commit of commits) {
				await insertEvent({
					source: 'gitlab',
					type: 'commit',
					service: projectPath,
					commit_sha: commit.id,
					timestamp: commit.timestamp,
					author: commit.author?.email,
					raw_data: commit
				});
			}
			logger.info(`Recorded ${commits.length} commits from ${projectPath}`);
		} else if (eventType === 'Merge Request Hook' && payload.object_attributes?.state === 'merged') {
			// Handle merge request events - secondary focus
			await insertEvent({
				source: 'gitlab',
				type: 'pr_merged',
				service: projectPath,
				pr_number: payload.object_attributes.iid?.toString(),
				commit_sha: payload.object_attributes.merge_commit_sha,
				timestamp: payload.object_attributes.merged_at,
				author: payload.user?.email,
				raw_data: payload
			});
			logger.info(`Recorded merged MR !${payload.object_attributes.iid} in ${projectPath}`);
		} else if (eventType === 'Deployment Hook' || payload.object_kind === 'deployment') {
			// Handle deployment events
			await insertEvent({
				source: 'gitlab',
				type: 'deployment',
				service: projectPath,
				environment: payload.environment || 'production',
				commit_sha: payload.sha || payload.commit?.id,
				status: payload.status === 'success' ? 'success' : 
					payload.status === 'failed' ? 'failure' : 'rollback',
				timestamp: payload.created_at || new Date().toISOString(),
				raw_data: payload
			});
			logger.info(`Recorded deployment to ${payload.environment} in ${projectPath}`);
		} else {
			logger.debug(`Ignored GitLab webhook event: ${eventType}`);
		}
	} catch (error) {
		logger.error('Error processing GitLab webhook:', error);
		throw error;
	}
}

export async function scanGitLabGroups(): Promise<void> {
	if (!gitlab) {
		return;
	}
	
	logger.info('Scanning GitLab for your contributions');
	
	try {
		// Get current user info
		const user = await gitlab.Users.showCurrentUser();
		const username = user.username;
		
		logger.info(`Tracking contributions for: ${username}`);
		
		// Get all accessible projects
		const projects = await gitlab.Projects.all({ 
			membership: true,
			perPage: 100
		});
		
		logger.info(`Found ${projects.length} accessible projects`);
		
		for (const project of projects) {
			try {
				// Get commits by the user in the lookback period
				const commits = await gitlab.Commits.all(project.id, {
					since: new Date(Date.now() - env.POLLING_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString(),
					author: username,
					perPage: 100
				});
				
				if (commits.length > 0) {
					logger.info(`Found ${commits.length} commits by ${username} in ${project.path_with_namespace}`);
				}
				
				for (const commit of commits) {
					// Skip if already exists
					if (await commitExists(commit.id, 'gitlab')) {
						continue;
					}
					
					await insertEvent({
						source: 'gitlab',
						type: 'commit',
						service: project.path_with_namespace,
						commit_sha: commit.id,
						timestamp: commit.created_at,
						author: commit.author_email || username,
						raw_data: commit
					});
				}
				
				// Get merge requests by the user
				const mergeRequests = await gitlab.MergeRequests.all({
					projectId: project.id,
					authorUsername: username,
					updatedAfter: new Date(Date.now() - env.POLLING_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString(),
					state: 'merged',
					perPage: 100
				});
				
				for (const mr of mergeRequests) {
					// Skip if already exists
					if (await prExists(mr.iid.toString(), project.path_with_namespace, 'gitlab')) {
						continue;
					}
					
					await insertEvent({
						source: 'gitlab',
						type: 'pr_merged',
						service: project.path_with_namespace,
						pr_number: mr.iid.toString(),
						commit_sha: mr.merge_commit_sha || mr.sha,
						timestamp: mr.merged_at || mr.updated_at,
						author: username,
						raw_data: mr
					});
				}
			} catch (error: any) {
				// Don't fail the whole scan if one project fails
				logger.debug(`Error scanning project ${project.name}:`, error.message);
			}
		}
	} catch (error) {
		logger.error('Error scanning GitLab:', error);
		logger.info('Ensure your GitLab PAT has read_api and read_repository scopes.');
	}
}