/**
 * Upload workflow orchestration
 * Handles the multi-step process of uploading a modified activity to Strava
 */

import { fetchWithTimeout } from './utils/errors';

function formatTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	
	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	} else if (minutes > 0) {
		return `${minutes}m ${secs}s`;
	} else {
		return `${secs}s`;
	}
}

function formatDistance(meters: number, useImperial: boolean): string {
	if (useImperial) {
		const miles = meters * 0.000621371;
		return `${miles.toFixed(2)} mi`;
	}
	const km = meters / 1000;
	return `${km.toFixed(2)} km`;
}

function formatElevation(meters: number, useImperial: boolean): string {
	if (useImperial) {
		const feet = meters * 3.28084;
		return `${Math.round(feet)} ft`;
	}
	return `${Math.round(meters)} m`;
}

function generateActivityDescription(stats: ActivityStats, useImperial: boolean, originalDescription?: string): string {
	const lines = [];
	
	// Add original description if it exists
	if (originalDescription && originalDescription.trim()) {
		lines.push(originalDescription.trim());
		lines.push('');
	}
	
	// Add stats section - all on one line
	const statsLine = `${stats.numLaps} laps, ${formatDistance(stats.totalDistance, useImperial)}, ${formatElevation(stats.totalAscent, useImperial)} ascent, ${formatElevation(stats.totalDescent, useImperial)} descent`;
	lines.push(statsLine);
	lines.push('');
	lines.push('Processed with Uplift Pruner: https://uplift-pruner.rbritton.dev');
	
	return lines.join('\n');
}

export type UploadStep = 'idle' | 'saving' | 'ready' | 'verifying' | 'uploading' | 'processing' | 'updating' | 'complete' | 'error';

export interface UploadState {
	step: UploadStep;
	progress: number;
	message: string;
	error: { message: string; recoveryUrl?: string } | null;
	newActivityUrl: string | null;
	attemptNumber: number;
	secondsRemaining: number;
}

export interface UploadCallbacks {
	onStateChange: (state: Partial<UploadState>) => void;
	onWaitForConfirmation: () => Promise<void>;
}

export interface ActivityStats {
	numLaps: number;
	totalDistance: number;
	totalAscent: number;
	totalDescent: number;
	totalElapsedTime: number;
	totalTimerTime: number;
}

export interface UploadOptions {
	activityId: string | number;
	selectedSegments: Set<number>;
	fitFile: Uint8Array;
	stats?: ActivityStats;
	useImperial?: boolean;
	metadata: {
		name?: string;
		description?: string;
		gear_id?: string;
		trainer?: boolean;
		commute?: boolean;
		hide_from_home?: boolean;
	};
}

export async function runUploadWorkflow(
	options: UploadOptions,
	callbacks: UploadCallbacks
): Promise<void> {
	const { activityId, selectedSegments, fitFile, metadata, stats, useImperial = false } = options;
	const { onStateChange, onWaitForConfirmation } = callbacks;

	try {
		// Step 1: FIT file already generated on frontend
		const fitData = fitFile;

		// Step 2: Show manual deletion instructions and wait
		onStateChange({
			step: 'ready',
			progress: 15,
			message: 'Please delete the original activity on Strava',
			newActivityUrl: `https://www.strava.com/activities/${activityId}`
		});

		// Wait for user confirmation
		await onWaitForConfirmation();

		// Verify deletion by checking if activity still exists
		onStateChange({
			newActivityUrl: null,
			step: 'verifying',
			progress: 15,
			message: 'Verifying activity deletion...'
		});

		let isDeleted = false;
		for (let i = 0; i < 12; i++) { // Check for up to 60 seconds
			onStateChange({
				message: 'Verifying activity deletion...'
			});
			try {
				const checkResponse = await fetchWithTimeout(`/api/activity?id=${activityId}`);
				if (!checkResponse.ok && checkResponse.status === 404) {
					// Activity is deleted!
					isDeleted = true;
					break;
				}
			} catch (e) {
				// Ignore errors, keep checking
			}
			
			if (i < 11) {
				await new Promise(resolve => setTimeout(resolve, 5000));
			}
		}

		if (!isDeleted) {
			throw new Error('Could not verify activity deletion. Please ensure the activity is deleted on Strava.');
		}

		// Step 3: Upload and process
		let newActivityId: number | null = null;

		// Upload
		onStateChange({
			step: 'uploading',
			progress: 30,
			message: 'Uploading modified activity...'
		});

		const formData = new FormData();
		// Convert Uint8Array to Blob
		const blob = new Blob([new Uint8Array(fitData)], { type: 'application/octet-stream' });
		formData.append('file', blob);

		const uploadResponse = await fetchWithTimeout('/api/upload', {
			method: 'POST',
			body: formData
		}, 25000);

		if (!uploadResponse.ok) {
			const error = await uploadResponse.text();
			throw new Error(`Upload failed: ${error}`);
		}

		const uploadResult: { uploadId: number; activityId?: number } = await uploadResponse.json();

		// Poll for processing
		onStateChange({
			step: 'processing',
			progress: 60,
			message: 'Processing on Strava...'
		});

		newActivityId = uploadResult.activityId || null;
		
		if (!newActivityId) {
			// Poll for completion (40 seconds max, check every 4s)
			for (let i = 0; i < 10; i++) {
				await new Promise(resolve => setTimeout(resolve, 4000));

				const statusResponse = await fetchWithTimeout(`/api/upload/${uploadResult.uploadId}/status`);
				
				if (statusResponse.ok) {
					const status = await statusResponse.json();

					if (status.error) {
						throw new Error(`Upload error: ${status.error}`);
					}

					if (status.activityId) {
						newActivityId = status.activityId;
						break;
					}
				}
			}
		}

		if (!newActivityId) {
			throw new Error('Upload timed out while processing on Strava');
		}

		// Step 4: Update activity metadata
		onStateChange({
			step: 'updating',
			progress: 80,
			message: 'Updating activity details...'
		});

		// Generate enhanced description with stats if available
		const updatedMetadata = { ...metadata };
		if (stats) {
			updatedMetadata.description = generateActivityDescription(stats, useImperial, metadata.description);
		}

		await fetchWithTimeout(`/api/activity/${newActivityId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updatedMetadata)
		});

		// Success!
		onStateChange({
			step: 'complete',
			progress: 100,
			message: 'Upload complete!',
			newActivityUrl: `https://www.strava.com/activities/${newActivityId}`
		});

	} catch (error: any) {
		onStateChange({
			step: 'error',
			progress: 0,
			attemptNumber: 0,
			secondsRemaining: 0,
			error: {
				message: error.message || 'Upload failed',
				recoveryUrl: 'https://www.strava.com/athlete/training/recently_deleted'
			}
		});
		throw error;
	}
}
