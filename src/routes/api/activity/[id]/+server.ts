import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getStravaClient } from '$lib/strava';

export const PUT: RequestHandler = async ({ params, cookies, request }) => {
	const { id } = params;

	const accessToken = cookies.get('strava_access_token');
	if (!accessToken) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const updates = await request.json();
		const client = getStravaClient(accessToken);
		await client.updateActivity(parseInt(id), updates);

		return json({ success: true });
	} catch (error: any) {
		console.error('Update activity error:', error);
		return json(
			{ error: error.message || 'Failed to update activity' },
			{ status: error.status || 500 }
		);
	}
};
