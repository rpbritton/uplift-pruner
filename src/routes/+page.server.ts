import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	// Check if user has access token
	const accessToken = cookies.get('strava_access_token');
	
	if (accessToken) {
		// User is logged in, redirect to select page
		throw redirect(302, '/select');
	}
	
	// Not logged in, show landing page
	return {};
};
