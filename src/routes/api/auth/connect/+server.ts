import type { RequestHandler } from './$types';
import { json, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';

export const GET: RequestHandler = async ({ url }) => {
	const clientId = env.PUBLIC_STRAVA_CLIENT_ID;
	// Use request origin for redirect URI (works for both localhost and production)
	const redirectUri = `${url.origin}/callback`;

	if (!clientId) {
		return json({ error: 'Strava client ID not configured' }, { status: 500 });
	}

	// Generate random state for CSRF protection
	const state = crypto.randomUUID();

	// Build authorization URL
	const authUrl = new URL(STRAVA_AUTH_URL);
	authUrl.searchParams.set('client_id', clientId);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('scope', 'read,activity:read_all,activity:write,profile:read_all');
	authUrl.searchParams.set('state', state);

	// Store state in cookie for verification
	const headers = new Headers();
	headers.set(
		'Set-Cookie',
		`oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
	);
	headers.set('Location', authUrl.toString());

	return new Response(null, { status: 302, headers });
};
