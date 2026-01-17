/**
 * Strava API client
 * Handles authentication and API requests to Strava
 */

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

export interface StravaActivity {
	id: number;
	name: string;
	type: string;
	sport_type?: string;
	distance: number;
	moving_time: number;
	elapsed_time: number;
	total_elevation_gain: number;
	start_date: string;
	start_date_local?: string;
	private?: boolean;
	map: {
		summary_polyline: string;
	};
	segment_efforts: SegmentEffort[];
	gear_id?: string;
	device_name?: string;
	average_temp?: number;
	calories?: number;
	max_heartrate?: number;
	average_heartrate?: number;
	max_watts?: number;
	average_watts?: number;
	workout_type?: number;
	trainer?: boolean;
	commute?: boolean;
	hide_from_home?: boolean;
	description?: string;
}

export interface SegmentEffort {
	id: number;
	name: string;
	segment: {
		id: number;
		name: string;
		distance: number;
		average_grade: number;
		elevation_high: number;
		elevation_low: number;
		private?: boolean;
	};
	start_index: number;
	end_index: number;
	elapsed_time: number;
	moving_time: number;
	distance: number;
}

export interface Athlete {
	id: number;
	firstname: string;
	lastname: string;
	profile_medium?: string;
	measurement_preference?: 'feet' | 'meters';
}

export class StravaClient {
	constructor(private accessToken: string) {}

	private async fetch(endpoint: string, options: RequestInit = {}) {
		const response = await fetch(`${STRAVA_API_BASE}${endpoint}`, {
			...options,
			headers: {
				Authorization: `Bearer ${this.accessToken}`,
				...options.headers
			}
		});

		if (!response.ok) {
			const error: any = new Error(`Strava API error: ${response.status} ${response.statusText}`);
			error.status = response.status;
			error.statusCode = response.status;
			throw error;
		}

		return response;
	}

	async getActivity(activityId: string | number): Promise<StravaActivity> {
		const response = await this.fetch(`/activities/${activityId}`);
		return response.json();
	}

	async getActivityStreams(activityId: string): Promise<any> {
		const response = await this.fetch(`/activities/${activityId}/streams?keys=time,latlng,distance,altitude,velocity_smooth,heartrate,cadence,watts,temp,moving,grade_smooth&key_by_type=true`);
		return response.json();
	}

	async getRecentActivities(limit: number = 10): Promise<StravaActivity[]> {
		const response = await this.fetch(`/athlete/activities?per_page=${limit}`);
		return response.json();
	}

	async getAthlete(): Promise<Athlete> {
		const response = await this.fetch('/athlete');
		return response.json();
	}

	async uploadActivity(fitData: Uint8Array): Promise<{ uploadId: number; activityId?: number }> {
		const formData = new FormData();
		formData.append('file', new Blob([new Uint8Array(fitData)], { type: 'application/octet-stream' }));
		formData.append('data_type', 'fit');

		const response = await this.fetch('/uploads', {
			method: 'POST',
			body: formData
		});

		const upload = await response.json();
		return { uploadId: upload.id, activityId: upload.activity_id };
	}

	async getUploadStatus(uploadId: number): Promise<{ activityId?: number; error?: string; status: string }> {
		const response = await this.fetch(`/uploads/${uploadId}`);
		const status = await response.json();
		
		return {
			activityId: status.activity_id,
			error: status.error,
			status: status.status
		};
	}

	async updateActivity(activityId: number, updates: {
		name?: string;
		description?: string;
		gear_id?: string;
		trainer?: boolean;
		commute?: boolean;
		hide_from_home?: boolean;
	}): Promise<void> {
		await this.fetch(`/activities/${activityId}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(updates)
		});
	}
}

export function getStravaClient(accessToken: string): StravaClient {
	return new StravaClient(accessToken);
}
