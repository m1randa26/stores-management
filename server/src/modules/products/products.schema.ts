import { z } from 'zod';

export const createProductSchema = z.object({
    sku: z.string()
        .min(3, 'SKU must be at least 3 characters')
        .max(50, 'SKU must not exceed 50 characters')
        .regex(/^[A-Z0-9\-]+$/, 'SKU must contain only uppercase letters, numbers, and hyphens')
        .trim()
        .transform(val => val.toUpperCase()),
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(200, 'Name must not exceed 200 characters')
        .trim(),
    description: z.string()
        .max(1000, 'Description must not exceed 1000 characters')
        .trim()
        .optional(),
    price: z.number()
        .positive('Price must be greater than 0')
        .max(99999999.99, 'Price is too large')
        .refine(
            (val) => /^\d+(\.\d{1,2})?$/.test(val.toString()),
            'Price must have maximum 2 decimal places'
        ),
    imageUrl: z.string()
        .url('Invalid URL format')
        .optional()
        .or(z.literal(''))
});

export const updateProductSchema = createProductSchema.partial().omit({ sku: true });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
