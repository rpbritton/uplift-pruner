import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getStravaClient } from '$lib/strava';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const accessToken = cookies.get('strava_access_token');
	if (!accessToken) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const formData = await request.formData();
		const fitFile = formData.get('file') as File;

		if (!fitFile) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		const fitData = new Uint8Array(await fitFile.arrayBuffer());
		const client = getStravaClient(accessToken);

		const result = await client.uploadActivity(fitData);

		return json(result);
	} catch (error: any) {
		console.error('Upload error:', error);
		return json({ error: error.message || 'Upload failed' }, { status: error.status || 500 });
	}
};
