import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getStravaClient } from '$lib/strava';
import { activityIdSchema, validateRequest } from '$lib/utils/validation';

export const GET: RequestHandler = async ({ url, cookies, platform }) => {
	const activityId = url.searchParams.get('id');

	if (!activityId) {
		return json(
			{ error: 'Activity ID required', suggestion: 'Please provide a valid activity ID.' },
			{ status: 400 }
		);
	}

	// Validate activity ID format
	const validation = validateRequest(activityIdSchema, activityId);
	if (!validation.success) {
		return json(
			{ error: validation.error, suggestion: 'Please provide a valid numeric activity ID.' },
			{ status: 400 }
		);
	}

	const accessToken = cookies.get('strava_access_token');
	if (!accessToken) {
		return json(
			{ error: 'Not authenticated', suggestion: 'Please log in again.' },
			{ status: 401 }
		);
	}

	try {
		const client = getStravaClient(accessToken);

		// Fetch athlete preferences
		const athlete = await client.getAthlete();

		// Fetch activity details with segment efforts
		const activity = await client.getActivity(activityId);

		// Fetch detailed coordinate stream for segment highlighting
		let streams = null;
		try {
			streams = await client.getActivityStreams(activityId);
		} catch (error) {
			console.warn(`No stream data available for activity ${activityId}`);
			// This is optional, so we continue without it
		}

		return json({
			...activity,
			athlete,
			streams
		});
	} catch (error: any) {
		console.error('Activity fetch error:', error);

		// Pass through the status code from Strava if available
		const status = error.status || error.statusCode || 500;
		let message = 'Failed to fetch activity';
		let suggestion = 'Please try again.';

		if (status === 404) {
			message = 'Activity not found';
			suggestion = 'Please check the activity ID and try again.';
		} else if (status === 401) {
			message = 'Authentication expired';
			suggestion = 'Please log in again.';
		} else if (status === 429) {
			message = 'Rate limit exceeded';
			suggestion = 'Please wait a moment and try again.';
		}

		return json({ error: message, suggestion }, { status });
	}
};
