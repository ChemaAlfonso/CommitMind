#!/usr/bin/env node

import { Octokit } from '@octokit/rest';
import { Gitlab } from '@gitbeaker/rest';
import { insertEvent, commitExists, prExists } from '../db/queries';
import { initDatabase } from '../db/database';
import { logger } from '../services/logger';
import { env } from '../config';

const currentYear = new Date().getFullYear();
const SINCE_DATE = process.argv[2] || `${currentYear}-01-01`;
const GITHUB_PAT = env.GITHUB_PAT;
const GITLAB_PAT = env.GITLAB_PAT;

logger.info(`GitHub PAT: ${GITHUB_PAT ? 'Found' : 'Not found'}`);
logger.info(`GitLab PAT: ${GITLAB_PAT ? 'Found' : 'Not found'}`);
logger.info(`Seeding data from: ${SINCE_DATE}`);
logger.info(`Database path: ${env.SQLITE_PATH}`);

async function seedGitHubData() {
	if (!GITHUB_PAT) {
		logger.info('No GitHub PAT found, skipping GitHub seeding');
		return;
	}

	const octokit = new Octokit({ auth: GITHUB_PAT });
	logger.info(`Seeding GitHub data since ${SINCE_DATE} for authenticated user only`);

	try {
		// Get authenticated user
		const { data: user } = await octokit.users.getAuthenticated();
		const username = user.login;
		logger.info(`Fetching contributions for GitHub user: ${username}`);

		// Get all accessible repos
		const { data: repos } = await octokit.repos.listForAuthenticatedUser({
			visibility: 'all',
			affiliation: 'owner,collaborator,organization_member',
			per_page: 100,
			sort: 'pushed'
		});

		logger.info(`Found ${repos.length} accessible repositories`);

		let totalCommits = 0;
		let totalPRs = 0;
		let skippedCommits = 0;
		let skippedPRs = 0;

		for (const repo of repos) {
			try {
				// Get ALL commits by the user since the date with pagination
				let allCommits: any[] = [];
				let page = 1;
				let hasMore = true;
				
				while (hasMore) {
					const { data: commits } = await octokit.repos.listCommits({
						owner: repo.owner?.login || '',
						repo: repo.name,
						author: username,
						since: `${SINCE_DATE}T00:00:00Z`,
						per_page: 100,
						page: page
					});
					
					if (commits.length === 0) {
						hasMore = false;
					} else {
						allCommits = allCommits.concat(commits);
						page++;
						// GitHub API has a limit of 10,000 results, so stop if we're getting close
						if (allCommits.length >= 9900) {
							logger.warn(`Reached GitHub API limit for ${repo.full_name}, stopping at ${allCommits.length} commits`);
							hasMore = false;
						}
					}
				}

				if (allCommits.length > 0) {
					logger.info(`Found ${allCommits.length} commits in ${repo.full_name}`);
					totalCommits += allCommits.length;
				}

				for (const commit of allCommits) {
					// Skip if already exists
					if (await commitExists(commit.sha, 'github')) {
						skippedCommits++;
						continue;
					}
					
					await insertEvent({
						source: 'github',
						type: 'commit',
						service: repo.full_name,
						commit_sha: commit.sha,
						timestamp: commit.commit.author?.date || new Date().toISOString(),
						author: commit.commit.author?.email || username,
						raw_data: commit
					});
				}

				// Get ALL merged PRs with pagination
				let allPRs: any[] = [];
				page = 1;
				hasMore = true;
				
				while (hasMore) {
					const { data: pulls } = await octokit.pulls.list({
						owner: repo.owner?.login || '',
						repo: repo.name,
						state: 'closed',
						sort: 'updated',
						direction: 'desc',
						per_page: 100,
						page: page
					});
					
					if (pulls.length === 0) {
						hasMore = false;
					} else {
						// Filter user PRs that are merged and after SINCE_DATE
						const userPRs = pulls.filter(pr => 
							pr.user?.login === username && 
							pr.merged_at && 
							new Date(pr.merged_at) >= new Date(SINCE_DATE)
						);
						
						allPRs = allPRs.concat(userPRs);
						
						// Stop if the oldest PR in this batch is before our date
						const oldestPR = pulls[pulls.length - 1];
						if (oldestPR && oldestPR.updated_at && new Date(oldestPR.updated_at) < new Date(SINCE_DATE)) {
							hasMore = false;
						} else {
							page++;
						}
					}
				}

				if (allPRs.length > 0) {
					logger.info(`Found ${allPRs.length} merged PRs in ${repo.full_name}`);
					totalPRs += allPRs.length;
				}

				for (const pr of allPRs) {
					// Skip if already exists
					if (await prExists(pr.number.toString(), repo.full_name, 'github')) {
						skippedPRs++;
						continue;
					}
					
					await insertEvent({
						source: 'github',
						type: 'pr_merged',
						service: repo.full_name,
						pr_number: pr.number.toString(),
						commit_sha: pr.merge_commit_sha || '',
						timestamp: pr.merged_at || pr.updated_at,
						author: username,
						raw_data: pr
					});
				}

			} catch (error: any) {
				logger.debug(`Error processing repo ${repo.name}: ${error.message}`);
			}
		}

		logger.info(`GitHub seeding complete: ${totalCommits} commits (${skippedCommits} skipped), ${totalPRs} PRs (${skippedPRs} skipped)`);
	} catch (error: any) {
		logger.error('Error seeding GitHub data:', error.message);
		if (error.response) {
			logger.error('GitHub API Response:', error.response.data);
		}
		throw error;
	}
}

async function seedGitLabData() {
	if (!GITLAB_PAT) {
		logger.info('No GitLab PAT found, skipping GitLab seeding');
		return;
	}

	const gitlab = new Gitlab({
		token: GITLAB_PAT,
		host: 'https://gitlab.com'
	});

	logger.info(`Seeding GitLab data since ${SINCE_DATE} for authenticated user only`);

	try {
		// Get current user
		const user = await gitlab.Users.showCurrentUser();
		const username = user.username;
		const userEmail = user.email;
		
		// Also get all emails associated with the user
		const userEmails = await gitlab.UserEmails.all();
		const allUserEmails = [userEmail, ...userEmails.map(e => e.email)];
		
		logger.info(`Fetching contributions for GitLab user: ${username} (${userEmail})`);
		logger.debug(`User details: name="${user.name}", username="${username}"`);
		logger.debug(`User emails: ${allUserEmails.join(', ')}`);

		// Get all accessible projects
		const projects = await gitlab.Projects.all({
			membership: true,
			perPage: 100
		});

		logger.info(`Found ${projects.length} accessible projects`);

		let totalCommits = 0;
		let totalMRs = 0;
		let skippedCommits = 0;
		let skippedMRs = 0;

		for (const project of projects) {
			try {
				logger.debug(`Checking project: ${project.path_with_namespace}`);
				
				// Get ALL commits since the date - gitbeaker's .all() handles pagination automatically
				const commits = await gitlab.Commits.all(project.id, {
					since: `${SINCE_DATE}T00:00:00Z`,
					perPage: 100 // Max allowed per page by GitLab API
					// No maxPages limit - get ALL commits since the date
				});
				
				// Filter commits by the authenticated user only
				const userCommits = commits.filter(commit => {
					// Check against all known user emails
					const emailMatch = allUserEmails.some(email => 
						commit.author_email?.toLowerCase() === email?.toLowerCase()
					);
					
					// Also check by name
					const nameMatch = commit.author_name?.toLowerCase() === user.name?.toLowerCase() ||
						commit.author_name?.toLowerCase() === username?.toLowerCase();
					
					return emailMatch || nameMatch;
				});

				if (userCommits.length > 0) {
					logger.info(`Found ${userCommits.length} commits by ${username} in ${project.path_with_namespace}`);
					totalCommits += userCommits.length;
				} else if (commits.length > 0) {
					logger.debug(`Project ${project.path_with_namespace} has ${commits.length} commits (by all authors) but none by ${username}`);
				}

				for (const commit of userCommits) {
					// Skip if already exists
					if (await commitExists(commit.id, 'gitlab')) {
						skippedCommits++;
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

				// Get ALL merged MRs by the user - gitbeaker handles pagination
				const mergeRequests = await gitlab.MergeRequests.all({
					projectId: project.id,
					authorUsername: username,
					createdAfter: `${SINCE_DATE}T00:00:00Z`,
					state: 'merged',
					perPage: 100 // Max per page
					// No maxPages limit - get ALL MRs since the date
				});

				if (mergeRequests.length > 0) {
					logger.info(`Found ${mergeRequests.length} merged MRs in ${project.path_with_namespace}`);
					totalMRs += mergeRequests.length;
				}

				for (const mr of mergeRequests) {
					// Skip if already exists
					if (await prExists(mr.iid.toString(), project.path_with_namespace, 'gitlab')) {
						skippedMRs++;
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
				if (error.response?.status === 403) {
					logger.warn(`Access denied to project ${project.name} - skipping`);
				} else {
					logger.error(`Error processing project ${project.name}: ${error.message}`);
					if (error.response?.data) {
						logger.debug('Error details:', error.response.data);
					}
				}
			}
		}

		logger.info(`GitLab seeding complete: ${totalCommits} commits (${skippedCommits} skipped), ${totalMRs} MRs (${skippedMRs} skipped)`);
	} catch (error) {
		logger.error('Error seeding GitLab data:', error);
	}
}

async function main() {
	logger.info(`Starting historical data seed from ${SINCE_DATE}`);
	
	// Initialize database
	await initDatabase();
	
	// Seed data from both platforms (don't fail if one fails)
	const results = await Promise.allSettled([
		seedGitHubData(),
		seedGitLabData()
	]);
	
	// Report results
	results.forEach((result, index) => {
		const platform = index === 0 ? 'GitHub' : 'GitLab';
		if (result.status === 'rejected') {
			logger.error(`${platform} seeding failed:`, result.reason);
		}
	});
	
	logger.info('Historical data seeding complete!');
	process.exit(0);
}

main().catch(error => {
	logger.error('Fatal error:', error);
	process.exit(1);
});