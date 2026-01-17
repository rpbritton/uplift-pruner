import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
	// Clear auth cookies
	cookies.delete('strava_access_token', { path: '/' });
	cookies.delete('strava_refresh_token', { path: '/' });
	cookies.delete('oauth_state', { path: '/' });
	
	return json({ success: true });
};
