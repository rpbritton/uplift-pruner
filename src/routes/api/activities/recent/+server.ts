import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getStravaClient } from '$lib/strava';
import { recentActivitiesQuerySchema, validateRequest } from '$lib/utils/validation';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const accessToken = cookies.get('strava_access_token');

	if (!accessToken) {
		return json(
			{ error: 'Not authenticated', suggestion: 'Please log in again.' },
			{ status: 401 }
		);
	}

	// Validate query parameters
	const queryData = { limit: url.searchParams.get('limit') };
	const validation = validateRequest(recentActivitiesQuerySchema, queryData);
	if (!validation.success) {
		return json(
			{ error: validation.error, suggestion: 'Limit must be between 1 and 50.' },
			{ status: 400 }
		);
	}

	const { limit } = validation.data;

	try {
		const client = getStravaClient(accessToken);

		// Fetch athlete preferences
		const athlete = await client.getAthlete();

		// Fetch recent activities
		const activities = await client.getRecentActivities(limit);

		return json({
			athlete,
			activities
		});
	} catch (error: any) {
		console.error('Failed to fetch activities:', error);
		const status = error.status || error.statusCode || 500;
		let message = 'Failed to fetch activities';
		let suggestion = 'Please try again.';

		if (status === 401) {
			message = 'Authentication expired';
			suggestion = 'Please log in again.';
		} else if (status === 429) {
			message = 'Rate limit exceeded';
			suggestion = 'Please wait a moment and try again.';
		}

		return json({ error: message, suggestion }, { status });
	}
};
