import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getStravaClient } from '$lib/strava';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const accessToken = cookies.get('strava_access_token');
	
	if (!accessToken) {
		return json(
			{ error: 'Not authenticated', suggestion: 'Please log in again.' },
			{ status: 401 }
		);
	}

	const { id } = params;
	
	if (!id) {
		return json(
			{ error: 'Activity ID is required', suggestion: 'Please provide a valid activity ID.' },
			{ status: 400 }
		);
	}

	try {
		const client = getStravaClient(accessToken);
		
		// Fetch activity streams from Strava
		const streams = await client.getActivityStreams(id);
		
		return json({ streams });
	} catch (error: any) {
		console.error('Failed to fetch activity streams:', error);
		const status = error.status || error.statusCode || 500;
		let message = 'Failed to fetch activity data';
		let suggestion = 'Please try again.';
		
		if (status === 401) {
			message = 'Authentication expired';
			suggestion = 'Please log in again.';
		} else if (status === 404) {
			message = 'Activity not found';
			suggestion = 'Please check the activity ID and try again.';
		} else if (status === 429) {
			message = 'Rate limit exceeded';
			suggestion = 'Please wait a moment and try again.';
		}
		
		return json(
			{ error: message, suggestion },
			{ status }
		);
	}
};
