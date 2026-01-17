import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getStravaClient } from '$lib/strava';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const { id } = params;
	
	const accessToken = cookies.get('strava_access_token');
	if (!accessToken) {
		return json(
			{ error: 'Not authenticated' },
			{ status: 401 }
		);
	}

	try {
		const client = getStravaClient(accessToken);
		const status = await client.getUploadStatus(parseInt(id));
		
		return json(status);
	} catch (error: any) {
		console.error('Upload status error:', error);
		return json(
			{ error: error.message || 'Failed to get upload status' },
			{ status: error.status || 500 }
		);
	}
};
