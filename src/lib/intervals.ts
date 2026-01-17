/**
 * Interval extraction
 * Extracts time intervals from segment efforts for removal
 */

import type { SegmentEffort } from './strava';

export interface TimeInterval {
	startTime: Date;
	endTime: Date;
	startIndex: number;
	endIndex: number;
}

/**
 * Extract time intervals from selected segment efforts
 */
export function extractIntervals(
	segmentEfforts: SegmentEffort[],
	selectedIndices: number[]
): TimeInterval[] {
	const intervals: TimeInterval[] = [];

	for (const index of selectedIndices) {
		const effort = segmentEfforts[index];
		if (!effort) continue;

		intervals.push({
			startTime: new Date(), // Will be filled from FIT records
			endTime: new Date(),
			startIndex: effort.start_index,
			endIndex: effort.end_index
		});
	}

	return intervals;
}
