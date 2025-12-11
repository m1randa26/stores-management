import { z } from 'zod';

export const createVisitSchema = z.object({
    storeId: z.string()
        .min(1, 'Store ID is required'),
    latitude: z.number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90'),
    longitude: z.number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180'),
    accuracy: z.number()
        .positive('Accuracy must be greater than 0')
        .optional(),
    offlineId: z.string()
        .optional()
});

export const syncVisitSchema = createVisitSchema.extend({
    visitedAt: z.string()
        .datetime('Invalid datetime format')
        .optional()
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type SyncVisitInput = z.infer<typeof syncVisitSchema>;
