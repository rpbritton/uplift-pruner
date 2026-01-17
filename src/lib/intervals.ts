/**
 * Interval extraction
 * Extracts time intervals from segment efforts for removal
 */

import type { SegmentEffort } from './strava';

export interface FitRecord {
	timestamp: Date;
	[key: string]: any;
}

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

/**
 * Convert FIT record indices to time intervals
 */
export function recordIndicesToTimeIntervals(
	records: FitRecord[],
	intervals: TimeInterval[]
): TimeInterval[] {
	return intervals.map((interval) => {
		const startRecord = records[interval.startIndex];
		const endRecord = records[interval.endIndex];

		return {
			...interval,
			startTime: startRecord.timestamp,
			endTime: endRecord.timestamp
		};
	});
}

/**
 * Merge overlapping intervals
 */
export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
	if (intervals.length === 0) return [];

	// Sort by start time
	const sorted = intervals.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

	const merged: TimeInterval[] = [sorted[0]];

	for (let i = 1; i < sorted.length; i++) {
		const current = sorted[i];
		const last = merged[merged.length - 1];

		if (current.startTime <= last.endTime) {
			// Overlapping - merge
			last.endTime = new Date(Math.max(last.endTime.getTime(), current.endTime.getTime()));
			last.endIndex = Math.max(last.endIndex, current.endIndex);
		} else {
			// Not overlapping - add new
			merged.push(current);
		}
	}

	return merged;
}
