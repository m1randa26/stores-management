import { z } from 'zod';

export const createStoreSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must not exceed 100 characters')
        .trim(),
    address: z.string()
        .min(5, 'Address must be at least 5 characters')
        .trim(),
    latitude: z.number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
        .optional(),
    longitude: z.number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
        .optional()
});

export const updateStoreSchema = createStoreSchema.partial();

export const assignUserSchema = z.object({
    userId: z.string()
        .min(1, 'User ID is required')
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
export type AssignUserInput = z.infer<typeof assignUserSchema>;
