/**
 * Generate FIT files from Strava activity data
 * This creates a complete FIT file that can be edited using Garmin's SDK
 */

import { Encoder, Profile } from '@garmin/fitsdk';
import type { StravaActivity } from './strava';

export interface StravaStreams {
	time?: { data: number[] };
	latlng?: { data: [number, number][] };
	distance?: { data: number[] };
	altitude?: { data: number[] };
	velocity_smooth?: { data: number[] };
	heartrate?: { data: number[] };
	cadence?: { data: number[] };
	watts?: { data: number[] };
	temp?: { data: number[] };
	moving?: { data: boolean[] };
	grade_smooth?: { data: number[] };
}

/**
 * Map Strava sport_type to FIT sport and sub_sport enums
 */
function mapStravaTypeToFitSport(sportType: string): { sport: number; sub_sport: number } {
	const type = sportType?.toLowerCase() || '';
	const mapping: { [key: string]: { sport: number; sub_sport: number } } = {
		// Cycling (sport: 2)
		'ride': { sport: 2, sub_sport: 0 },
		'mountainbikeride': { sport: 2, sub_sport: 8 },
		'gravelride': { sport: 2, sub_sport: 46 },
		'ebikeride': { sport: 21, sub_sport: 0 },
		'emountainbikeride': { sport: 21, sub_sport: 8 },
		'velomobile': { sport: 2, sub_sport: 0 },
		'virtualride': { sport: 2, sub_sport: 10 },
		'handcycle': { sport: 2, sub_sport: 14 },
		'cycling': { sport: 2, sub_sport: 0 },
		'biking': { sport: 2, sub_sport: 0 },
		
		// Running (sport: 1)
		'run': { sport: 1, sub_sport: 0 },
		'trailrun': { sport: 1, sub_sport: 3 },
		'virtualrun': { sport: 1, sub_sport: 10 },
		'running': { sport: 1, sub_sport: 0 },
		'treadmillrun': { sport: 1, sub_sport: 1 },
		
		// Walking & Hiking
		'walk': { sport: 11, sub_sport: 0 },
		'walking': { sport: 11, sub_sport: 0 },
		'hike': { sport: 17, sub_sport: 0 },
		'hiking': { sport: 17, sub_sport: 0 },
		
		// Swimming (sport: 5)
		'swim': { sport: 5, sub_sport: 0 },
		'swimming': { sport: 5, sub_sport: 0 },
		'openwater': { sport: 5, sub_sport: 2 },
		'pool': { sport: 5, sub_sport: 0 },
		
		// Winter Sports
		'alpineski': { sport: 13, sub_sport: 0 },
		'backcountryski': { sport: 13, sub_sport: 2 },
		'downhillski': { sport: 13, sub_sport: 0 },
		'skiing': { sport: 13, sub_sport: 0 },
		'nordicski': { sport: 12, sub_sport: 0 },
		'crosscountryskiing': { sport: 12, sub_sport: 0 },
		'rollerski': { sport: 12, sub_sport: 0 },
		'snowboard': { sport: 14, sub_sport: 0 },
		'snowboarding': { sport: 14, sub_sport: 0 },
		'snowshoe': { sport: 35, sub_sport: 0 },
		'snowshoeing': { sport: 35, sub_sport: 0 },
		'iceskate': { sport: 33, sub_sport: 0 },
		'iceskating': { sport: 33, sub_sport: 0 },
		
		// Add more as needed...
	};
	
	return mapping[type] || { sport: 0, sub_sport: 0 };
}

/**
 * Generate a complete FIT file from Strava activity and streams
 * Returns the FIT file as a Uint8Array
 */
export function generateFitFromStrava(
	activity: StravaActivity,
	streams: StravaStreams
): Uint8Array {
	const startTime = new Date(activity.start_date);
	const endTime = new Date(new Date(activity.start_date).getTime() + activity.elapsed_time * 1000);

	// Helper function to convert Date to FIT timestamp (seconds since Dec 31, 1989 00:00:00 UTC)
	const FIT_EPOCH = 631065600; // Seconds from Unix epoch (Jan 1, 1970) to FIT epoch
	const dateToFitTimestamp = (date: Date): number => {
		return Math.floor(date.getTime() / 1000) - FIT_EPOCH;
	};

	const encoder = new Encoder();
	const { sport, sub_sport } = mapStravaTypeToFitSport(activity.sport_type || activity.type);
	const deviceName = activity.device_name || 'Uplift Pruner';
	const productName = deviceName.includes('Uplift Pruner') 
		? deviceName 
		: `${deviceName} x Uplift Pruner`;

	// 1. File ID (required)
	encoder.onMesg(Profile.MesgNum.FILE_ID, {
		type: 'activity',
		manufacturer: 'development',
		productName: productName,
		serialNumber: activity.id,
		timeCreated: startTime
	});

	// 2. Device Info
	encoder.onMesg(Profile.MesgNum.DEVICE_INFO, {
		timestamp: startTime,
		manufacturer: 'development',
		productName,
		serialNumber: activity.id,
		softwareVersion: 1.0
	});

	// 3. Records (all GPS and sensor data points)
	const length = streams.time?.data?.length || 0;
	if (length === 0) {
		throw new Error('No stream data available');
	}

	for (let i = 0; i < length; i++) {
		const timeOffset = streams.time?.data?.[i] || 0;
		const record: any = {
			timestamp: new Date(startTime.getTime() + timeOffset * 1000)
		};

		// Position (convert from degrees to semicircles for FIT format)
		if (streams.latlng?.data?.[i]) {
			const [lat, lng] = streams.latlng.data[i];
			record.positionLat = lat * (Math.pow(2, 31) / 180);
			record.positionLong = lng * (Math.pow(2, 31) / 180);
		}

		// Other fields
		if (streams.altitude?.data?.[i] !== undefined) record.altitude = streams.altitude.data[i];
		if (streams.distance?.data?.[i] !== undefined) record.distance = streams.distance.data[i];
		if (streams.velocity_smooth?.data?.[i] !== undefined) record.speed = streams.velocity_smooth.data[i];
		if (streams.heartrate?.data?.[i] !== undefined) record.heartRate = streams.heartrate.data[i];
		if (streams.cadence?.data?.[i] !== undefined) record.cadence = streams.cadence.data[i];
		if (streams.watts?.data?.[i] !== undefined) record.power = streams.watts.data[i];
		if (streams.temp?.data?.[i] !== undefined) record.temperature = streams.temp.data[i];
		// Note: grade is from streams but not typically in device FIT files, omitting for compatibility

		encoder.onMesg(Profile.MesgNum.RECORD, record);
	}

	// 4. Lap (single lap for entire activity initially)
	encoder.onMesg(Profile.MesgNum.LAP, {
		timestamp: endTime,
		startTime: startTime,
		totalElapsedTime: activity.elapsed_time,
		totalTimerTime: activity.moving_time,
		totalDistance: activity.distance,
		sport,
		subSport: sub_sport
	});

	// 5. Session (activity summary)
	encoder.onMesg(Profile.MesgNum.SESSION, {
		timestamp: endTime,
		startTime: startTime,
		totalElapsedTime: activity.elapsed_time,
		totalTimerTime: activity.moving_time,
		totalDistance: activity.distance,
		sport,
		subSport: sub_sport,
		totalCalories: activity.calories,
		avgHeartRate: activity.average_heartrate,
		maxHeartRate: activity.max_heartrate,
		avgPower: activity.average_watts,
		maxPower: activity.max_watts
	});

	// 6. Activity (wrapper)
	encoder.onMesg(Profile.MesgNum.ACTIVITY, {
		timestamp: endTime,
		numSessions: 1
	});

	return encoder.close();
}
