import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	const { code, state } = await request.json();

	// Verify state
	const storedState = cookies.get('oauth_state');
	if (!storedState || storedState !== state) {
		return json({ error: 'Invalid state parameter' }, { status: 400 });
	}

	const clientId = env.PUBLIC_STRAVA_CLIENT_ID;
	const clientSecret = privateEnv.STRAVA_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		return json({ error: 'Strava credentials not configured' }, { status: 500 });
	}

	try {
		// Exchange authorization code for tokens
		const response = await fetch(STRAVA_TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_id: clientId,
				client_secret: clientSecret,
				code,
				grant_type: 'authorization_code'
			})
		});

		if (!response.ok) {
			throw new Error('Token exchange failed');
		}

		const data = await response.json();

		// Store tokens in HTTP-only cookies
		cookies.set('strava_access_token', data.access_token, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: data.expires_in
		});

		cookies.set('strava_refresh_token', data.refresh_token, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 180 // 180 days
		});

		// Clear state cookie
		cookies.delete('oauth_state', { path: '/' });

		return json({ success: true });
	} catch (error) {
		console.error('Token exchange error:', error);
		return json({ error: 'Authentication failed' }, { status: 500 });
	}
};
