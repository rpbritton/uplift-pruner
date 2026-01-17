/**
 * Validation schemas using Zod
 * Validates API request payloads
 */

import { z } from 'zod';

/**
 * Activity ID validation
 */
export const activityIdSchema = z.string().regex(/^\d+$/, 'Activity ID must be numeric');

/**
 * Process request validation
 */
export const processRequestSchema = z.object({
	activityId: activityIdSchema,
	selectedSegments: z
		.array(z.number().int().nonnegative())
		.min(1, 'At least one segment must be selected')
		.max(100, 'Too many segments selected'),
	action: z.enum(['download', 'upload']),
	format: z.enum(['fit', 'gpx', 'tcx']).optional().default('fit')
});

export type ProcessRequest = z.infer<typeof processRequestSchema>;

/**
 * Recent activities query validation
 */
export const recentActivitiesQuerySchema = z.object({
	limit: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val, 10) : 10))
		.pipe(z.number().int().min(1).max(50))
});

/**
 * Validate request body against schema
 */
export function validateRequest<T>(
	schema: z.ZodSchema<T>,
	data: unknown
):
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			error: string;
			details?: z.ZodError;
	  } {
	try {
		const validated = schema.parse(data);
		return { success: true, data: validated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const firstError = error.issues?.[0];
			return {
				success: false,
				error: firstError?.message || 'Validation failed',
				details: error
			};
		}
		return {
			success: false,
			error: 'Invalid request data'
		};
	}
}
