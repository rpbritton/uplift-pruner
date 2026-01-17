/**
 * FIT File Editor
 * Removes intervals from FIT files and recalculates stats using Garmin SDK
 */

import { Decoder, Encoder, Profile, Stream } from '@garmin/fitsdk';
import type { TimeInterval } from './intervals';

interface FitMessages {
	fileIdMessages: any[];
	deviceInfoMessages: any[];
	recordMessages: any[];
	lapMessages: any[];
	sessionMessages: any[];
	activityMessages: any[];
	eventMessages: any[];
}

interface LapStats {
	startTime: Date;
	endTime: Date;
	totalElapsedTime: number;
	totalTimerTime: number;
	totalDistance: number;
	totalAscent: number;
	totalDescent: number;
	avgSpeed: number;
	maxSpeed: number;
	avgHeartRate: number | null;
	maxHeartRate: number | null;
	minHeartRate: number | null;
	avgCadence: number | null;
	maxCadence: number | null;
	avgPower: number | null;
	maxPower: number | null;
	normalizedPower: number | null;
	totalWork: number | null;
	totalCalories: number | null;
	avgTemperature: number | null;
	records: any[];
}

export interface ActivityStats {
	numLaps: number;
	numSignificantLaps: number;
	totalDistance: number;
	totalAscent: number;
	totalDescent: number;
	totalElapsedTime: number;
	totalTimerTime: number;
}

/**
 * Remove intervals from FIT file and recalculate stats
 */
export function removeFitIntervals(
	fitData: Uint8Array,
	intervals: TimeInterval[],
	sport: number,
	subSport: number
): { fitFile: Uint8Array; stats: ActivityStats } {
	// Step 1: Decode FIT file using Stream
	const stream = Stream.fromByteArray(fitData);
	const decoder = new Decoder(stream);
	const { messages, errors } = decoder.read();

	if (errors && errors.length > 0) {
		console.error('FIT decode errors:', errors);
	}

	console.log('Decoded FIT structure:', Object.keys(messages));
	console.log('Sample properties:', {
		recordMesgs: messages.recordMesgs?.length,
		recordMessages: messages.recordMessages?.length,
		records: messages.records?.length
	});

	// Messages object has properties like recordMesgs, lapMesgs, etc.
	// Convert to our format
	const fitMessages: FitMessages = {
		fileIdMessages: messages.fileIdMesgs || [],
		deviceInfoMessages: messages.deviceInfoMesgs || [],
		recordMessages: messages.recordMesgs || [],
		lapMessages: messages.lapMesgs || [],
		sessionMessages: messages.sessionMesgs || [],
		activityMessages: messages.activityMesgs || [],
		eventMessages: messages.eventMesgs || []
	};

	console.log('Extracted messages:', {
		records: fitMessages.recordMessages.length,
		laps: fitMessages.lapMessages.length,
		sessions: fitMessages.sessionMessages.length,
		intervals: intervals.length,
		intervalRanges: intervals.map((i) => ({
			start: i.startTime,
			end: i.endTime,
			startIndex: i.startIndex,
			endIndex: i.endIndex
		}))
	});

	// Step 3: Filter records and split into laps
	const laps = splitIntoLaps(fitMessages.recordMessages, intervals);

	if (laps.length === 0) {
		throw new Error(
			'No activity data remains after removing intervals. All records were filtered out.'
		);
	}

	// Step 4: Calculate stats for each lap
	const lapStats = laps.map((lap) => calculateLapStats(lap));

	console.log('Lap stats calculated:', {
		numLaps: lapStats.length,
		lapSummary: lapStats.map((lap, i) => ({
			lapNum: i + 1,
			records: lap.records.length,
			distance: lap.totalDistance,
			time: lap.totalElapsedTime
		}))
	});

	// Step 5: Calculate session stats from all laps
	const sessionStats = calculateSessionStats(lapStats);

	// Step 5.5: Count significant laps (laps with meaningful descent)
	const SIGNIFICANT_DESCENT_THRESHOLD = 50; // meters
	const numSignificantLaps = lapStats.filter(
		(lap) => lap.totalDescent > SIGNIFICANT_DESCENT_THRESHOLD
	).length;

	console.log('Significant laps:', {
		total: lapStats.length,
		significant: numSignificantLaps,
		lapDescents: lapStats.map((lap, i) => ({
			lapNum: i + 1,
			descent: lap.totalDescent,
			significant: lap.totalDescent > SIGNIFICANT_DESCENT_THRESHOLD
		}))
	});

	// Step 6: Re-encode FIT file
	const fitFile = encodeFitFile(fitMessages, lapStats, sessionStats, sport, subSport);

	// Step 7: Return both FIT file and stats
	return {
		fitFile,
		stats: {
			numLaps: lapStats.length,
			numSignificantLaps,
			totalDistance: sessionStats.totalDistance,
			totalAscent: sessionStats.totalAscent,
			totalDescent: sessionStats.totalDescent,
			totalElapsedTime: sessionStats.totalElapsedTime,
			totalTimerTime: sessionStats.totalTimerTime
		}
	};
}

/**
 * Split records into laps, excluding intervals
 */
function splitIntoLaps(records: any[], intervals: TimeInterval[]): any[][] {
	const laps: any[][] = [];
	let currentLap: any[] = [];

	for (let i = 0; i < records.length; i++) {
		const record = records[i];

		// Check if this record index is in any interval to remove
		const inInterval = intervals.some(
			(interval) => i >= interval.startIndex && i <= interval.endIndex
		);

		if (inInterval) {
			// If we have accumulated records, save them as a lap
			if (currentLap.length > 0) {
				laps.push(currentLap);
				currentLap = [];
			}
		} else {
			// Add record to current lap
			currentLap.push(record);
		}
	}

	// Add final lap if any records remain
	if (currentLap.length > 0) {
		laps.push(currentLap);
	}

	console.log('Split into laps:', {
		totalRecords: records.length,
		lapsCreated: laps.length,
		lapSizes: laps.map((l) => l.length),
		intervalsRemoved: intervals.length
	});

	return laps;
}

/**
 * Calculate statistics for a single lap
 */
function calculateLapStats(records: any[]): LapStats {
	if (records.length === 0) {
		throw new Error('Cannot calculate stats for empty lap');
	}

	const startTime = records[0].timestamp;
	const endTime = records[records.length - 1].timestamp;
	const totalElapsedTime = (endTime.getTime() - startTime.getTime()) / 1000;

	// Distance - calculate delta from first to last record
	const startDistance = records[0].distance || 0;
	const endDistance = records[records.length - 1].distance || 0;
	const totalDistance = endDistance - startDistance;

	// Elevation
	let totalAscent = 0;
	let totalDescent = 0;
	for (let i = 1; i < records.length; i++) {
		const elevDiff = (records[i].altitude || 0) - (records[i - 1].altitude || 0);
		if (elevDiff > 0) {
			totalAscent += elevDiff;
		} else if (elevDiff < 0) {
			totalDescent += Math.abs(elevDiff);
		}
	}

	// Speed
	const speeds = records.map((r) => r.speed).filter((s) => s !== undefined);
	const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
	const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

	// Heart rate
	const heartRates = records.map((r) => r.heartRate).filter((hr) => hr !== undefined);
	const avgHeartRate =
		heartRates.length > 0
			? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length)
			: null;
	const maxHeartRate = heartRates.length > 0 ? Math.max(...heartRates) : null;
	const minHeartRate = heartRates.length > 0 ? Math.min(...heartRates) : null;

	// Cadence
	const cadences = records.map((r) => r.cadence).filter((c) => c !== undefined);
	const avgCadence =
		cadences.length > 0 ? Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length) : null;
	const maxCadence = cadences.length > 0 ? Math.max(...cadences) : null;

	// Power
	const powers = records.map((r) => r.power).filter((p) => p !== undefined);
	const avgPower =
		powers.length > 0 ? Math.round(powers.reduce((a, b) => a + b, 0) / powers.length) : null;
	const maxPower = powers.length > 0 ? Math.max(...powers) : null;

	// Normalized Power (NP) - 4th root of 30-second moving average of power^4
	let normalizedPower: number | null = null;
	if (powers.length > 30) {
		const powersFourth = powers.map((p) => Math.pow(p, 4));
		const avgPowerFourth = powersFourth.reduce((a, b) => a + b, 0) / powersFourth.length;
		normalizedPower = Math.round(Math.pow(avgPowerFourth, 0.25));
	}

	// Total Work (joules) - sum of power * time
	let totalWork: number | null = null;
	if (avgPower !== null && totalElapsedTime > 0) {
		totalWork = Math.round(avgPower * totalElapsedTime);
	}

	// Temperature
	const temps = records.map((r) => r.temperature).filter((t) => t !== undefined);
	const avgTemperature =
		temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;

	// Calories (rough estimate based on power or HR)
	const totalCalories =
		avgPower !== null
			? Math.round(((avgPower * totalElapsedTime) / 1000) * 0.239) // Convert joules to kcal
			: null;

	return {
		startTime,
		endTime,
		totalElapsedTime,
		totalTimerTime: totalElapsedTime, // Same as elapsed for continuous segments
		totalDistance,
		totalAscent,
		totalDescent,
		avgSpeed,
		maxSpeed,
		avgHeartRate,
		maxHeartRate,
		minHeartRate,
		avgCadence,
		maxCadence,
		avgPower,
		maxPower,
		normalizedPower,
		totalWork,
		totalCalories,
		avgTemperature,
		records
	};
}

/**
 * Calculate session-level statistics from all laps
 */
function calculateSessionStats(laps: LapStats[]): Omit<LapStats, 'records'> {
	if (laps.length === 0) {
		throw new Error('Cannot calculate session stats with no laps');
	}

	const startTime = laps[0].startTime;
	const endTime = laps[laps.length - 1].endTime;

	// totalElapsedTime is wall-clock time (includes pauses/uplifts)
	const totalElapsedTime = (endTime.getTime() - startTime.getTime()) / 1000;

	// totalTimerTime is active time (sum of lap times, excludes pauses)
	const totalTimerTime = laps.reduce((sum, lap) => sum + lap.totalTimerTime, 0);

	console.log('Session stats calculation:', {
		lapsCount: laps.length,
		startTime,
		endTime,
		totalElapsedTime,
		totalTimerTime
	});

	const totalDistance = laps.reduce((sum, lap) => sum + lap.totalDistance, 0);
	const totalAscent = laps.reduce((sum, lap) => sum + lap.totalAscent, 0);
	const totalDescent = laps.reduce((sum, lap) => sum + lap.totalDescent, 0);

	const avgSpeed =
		laps.reduce((sum, lap) => sum + lap.avgSpeed * lap.totalTimerTime, 0) / totalTimerTime;

	const maxSpeed = Math.max(...laps.map((lap) => lap.maxSpeed));

	// Average heart rate across all laps (weighted by time)
	const hrLaps = laps.filter((lap) => lap.avgHeartRate !== null);
	const avgHeartRate =
		hrLaps.length > 0
			? Math.round(
					hrLaps.reduce((sum, lap) => sum + lap.avgHeartRate! * lap.totalTimerTime, 0) /
						hrLaps.reduce((sum, lap) => sum + lap.totalTimerTime, 0)
				)
			: null;

	const maxHeartRate =
		hrLaps.length > 0 ? Math.max(...hrLaps.map((lap) => lap.maxHeartRate!)) : null;

	const minHeartRate =
		hrLaps.length > 0 ? Math.min(...hrLaps.map((lap) => lap.minHeartRate!)) : null;

	// Average cadence across all laps (weighted by time)
	const cadLaps = laps.filter((lap) => lap.avgCadence !== null);
	const avgCadence =
		cadLaps.length > 0
			? Math.round(
					cadLaps.reduce((sum, lap) => sum + lap.avgCadence! * lap.totalTimerTime, 0) /
						cadLaps.reduce((sum, lap) => sum + lap.totalTimerTime, 0)
				)
			: null;

	const maxCadence = cadLaps.length > 0 ? Math.max(...cadLaps.map((lap) => lap.maxCadence!)) : null;

	// Average power across all laps (weighted by time)
	const powerLaps = laps.filter((lap) => lap.avgPower !== null);
	const avgPower =
		powerLaps.length > 0
			? Math.round(
					powerLaps.reduce((sum, lap) => sum + lap.avgPower! * lap.totalTimerTime, 0) /
						powerLaps.reduce((sum, lap) => sum + lap.totalTimerTime, 0)
				)
			: null;

	// Normalized Power (weighted average)
	const npLaps = laps.filter((lap) => lap.normalizedPower !== null);
	const normalizedPower =
		npLaps.length > 0
			? Math.round(
					npLaps.reduce((sum, lap) => sum + lap.normalizedPower! * lap.totalTimerTime, 0) /
						npLaps.reduce((sum, lap) => sum + lap.totalTimerTime, 0)
				)
			: null;

	// Total Work (sum of all laps)
	const totalWork = laps.reduce((sum, lap) => sum + (lap.totalWork || 0), 0);

	const maxPower = powerLaps.length > 0 ? Math.max(...powerLaps.map((lap) => lap.maxPower!)) : null;

	// Average temperature across all laps
	const tempLaps = laps.filter((lap) => lap.avgTemperature !== null);
	const avgTemperature =
		tempLaps.length > 0
			? Math.round(tempLaps.reduce((sum, lap) => sum + lap.avgTemperature!, 0) / tempLaps.length)
			: null;

	const totalCalories = laps.reduce((sum, lap) => sum + (lap.totalCalories || 0), 0);

	return {
		startTime,
		endTime,
		totalElapsedTime,
		totalTimerTime,
		totalDistance,
		totalAscent,
		totalDescent,
		avgSpeed,
		maxSpeed,
		avgHeartRate,
		maxHeartRate,
		minHeartRate,
		avgCadence,
		maxCadence,
		avgPower,
		maxPower,
		normalizedPower,
		totalWork,
		totalCalories,
		avgTemperature
	};
}

/**
 * Re-encode FIT file with filtered records and updated stats
 */
function encodeFitFile(
	originalMessages: FitMessages,
	laps: LapStats[],
	sessionStats: Omit<LapStats, 'records'>,
	sport: number,
	subSport: number
): Uint8Array {
	const encoder = new Encoder();

	console.log('Encoding FIT file with:', {
		laps: laps.length,
		sessions: 1, // Should only be 1
		originalLaps: originalMessages.lapMessages.length,
		originalSessions: originalMessages.sessionMessages.length
	});

	// 1. FILE_ID (reuse original)
	if (originalMessages.fileIdMessages.length > 0) {
		encoder.onMesg(Profile.MesgNum.FILE_ID, originalMessages.fileIdMessages[0]);
	}

	// 2. DEVICE_INFO (reuse original)
	if (originalMessages.deviceInfoMessages.length > 0) {
		encoder.onMesg(Profile.MesgNum.DEVICE_INFO, originalMessages.deviceInfoMessages[0]);
	}

	// 3. Write all records with timer start/stop events between laps
	let cumulativeDistance = 0;

	for (let i = 0; i < laps.length; i++) {
		const lap = laps[i];

		// Timer start event at beginning of lap
		encoder.onMesg(Profile.MesgNum.EVENT, {
			timestamp: lap.startTime,
			event: 'timer',
			eventType: 'start',
			eventGroup: 0
		});

		// Recalculate distance to be cumulative across only the kept records
		const lapStartDistance = lap.records[0].distance || 0;
		const lapEndDistance = lap.records[lap.records.length - 1].distance || 0;
		const lapDistance = lapEndDistance - lapStartDistance;

		// Write all records for this lap with recalculated cumulative distance
		for (let j = 0; j < lap.records.length; j++) {
			const record = lap.records[j];
			const originalDistance = record.distance || 0;
			const distanceInLap = originalDistance - lapStartDistance;

			// Create new record with recalculated cumulative distance
			const newRecord = {
				...record,
				distance: cumulativeDistance + distanceInLap
			};

			encoder.onMesg(Profile.MesgNum.RECORD, newRecord);
		}

		// Update cumulative distance for next lap
		cumulativeDistance += lapDistance;

		// Timer stop event at end of lap
		encoder.onMesg(Profile.MesgNum.EVENT, {
			timestamp: lap.endTime,
			event: 'timer',
			eventType: 'stopAll',
			eventGroup: 0
		});

		// If there's a next lap, insert pause between them
		if (i < laps.length - 1) {
			const nextLap = laps[i + 1];
			const gapStart = lap.endTime;
			const gapEnd = nextLap.startTime;

			// Only add pause if there's an actual gap
			if (gapEnd.getTime() - gapStart.getTime() > 1000) {
				// Pause event at start of gap
				encoder.onMesg(Profile.MesgNum.EVENT, {
					timestamp: gapStart,
					event: 'timer',
					eventType: 'stopDisableAll',
					eventGroup: 0
				});
			}
		}
	}

	// 4. LAP messages (one per lap)
	for (const lap of laps) {
		const lapMessage: any = {
			timestamp: lap.endTime,
			startTime: lap.startTime,
			totalElapsedTime: lap.totalElapsedTime,
			totalTimerTime: lap.totalTimerTime,
			totalDistance: lap.totalDistance,
			sport,
			subSport
		};

		// Add optional fields if present
		if (lap.avgHeartRate !== null) lapMessage.avgHeartRate = lap.avgHeartRate;
		if (lap.maxHeartRate !== null) lapMessage.maxHeartRate = lap.maxHeartRate;
		if (lap.minHeartRate !== null) lapMessage.minHeartRate = lap.minHeartRate;
		if (lap.avgCadence !== null) lapMessage.avgCadence = lap.avgCadence;
		if (lap.maxCadence !== null) lapMessage.maxCadence = lap.maxCadence;
		if (lap.avgPower !== null) lapMessage.avgPower = lap.avgPower;
		if (lap.maxPower !== null) lapMessage.maxPower = lap.maxPower;
		if (lap.normalizedPower !== null) lapMessage.normalizedPower = lap.normalizedPower;
		if (lap.totalWork !== null) lapMessage.totalWork = lap.totalWork;
		if (lap.avgSpeed !== null) lapMessage.avgSpeed = lap.avgSpeed;
		if (lap.maxSpeed !== null) lapMessage.maxSpeed = lap.maxSpeed;
		if (lap.totalAscent !== null) lapMessage.totalAscent = lap.totalAscent;
		if (lap.totalDescent !== null) lapMessage.totalDescent = lap.totalDescent;
		if (lap.avgTemperature !== null) lapMessage.avgTemperature = lap.avgTemperature;
		if (lap.totalCalories !== null) lapMessage.totalCalories = lap.totalCalories;

		encoder.onMesg(Profile.MesgNum.LAP, lapMessage);
	}

	// 5. SESSION message (aggregated stats) - ONLY ONE SESSION
	const sessionMessage: any = {
		timestamp: sessionStats.endTime,
		startTime: sessionStats.startTime,
		totalElapsedTime: sessionStats.totalElapsedTime,
		totalTimerTime: sessionStats.totalTimerTime,
		totalDistance: sessionStats.totalDistance,
		sport,
		subSport,
		totalCalories: sessionStats.totalCalories,
		numLaps: laps.length
	};

	console.log('Writing SESSION:', {
		numLaps: laps.length,
		startTime: sessionStats.startTime,
		endTime: sessionStats.endTime,
		totalElapsedTime: sessionStats.totalElapsedTime,
		totalTimerTime: sessionStats.totalTimerTime,
		totalDistance: sessionStats.totalDistance
	});

	// Add optional fields if present
	if (sessionStats.avgHeartRate !== null) sessionMessage.avgHeartRate = sessionStats.avgHeartRate;
	if (sessionStats.maxHeartRate !== null) sessionMessage.maxHeartRate = sessionStats.maxHeartRate;
	if (sessionStats.minHeartRate !== null) sessionMessage.minHeartRate = sessionStats.minHeartRate;
	if (sessionStats.avgCadence !== null) sessionMessage.avgCadence = sessionStats.avgCadence;
	if (sessionStats.maxCadence !== null) sessionMessage.maxCadence = sessionStats.maxCadence;
	if (sessionStats.avgPower !== null) sessionMessage.avgPower = sessionStats.avgPower;
	if (sessionStats.maxPower !== null) sessionMessage.maxPower = sessionStats.maxPower;
	if (sessionStats.normalizedPower !== null)
		sessionMessage.normalizedPower = sessionStats.normalizedPower;
	if (sessionStats.totalWork !== null) sessionMessage.totalWork = sessionStats.totalWork;
	if (sessionStats.avgSpeed !== null) sessionMessage.avgSpeed = sessionStats.avgSpeed;
	if (sessionStats.maxSpeed !== null) sessionMessage.maxSpeed = sessionStats.maxSpeed;
	if (sessionStats.totalAscent !== null) sessionMessage.totalAscent = sessionStats.totalAscent;
	if (sessionStats.totalDescent !== null) sessionMessage.totalDescent = sessionStats.totalDescent;
	if (sessionStats.avgTemperature !== null)
		sessionMessage.avgTemperature = sessionStats.avgTemperature;

	encoder.onMesg(Profile.MesgNum.SESSION, sessionMessage);

	// 6. ACTIVITY message (wrapper)
	encoder.onMesg(Profile.MesgNum.ACTIVITY, {
		timestamp: sessionStats.endTime,
		numSessions: 1
	});

	return encoder.close();
}
