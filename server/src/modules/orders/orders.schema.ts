import { z } from 'zod';

const orderItemSchema = z.object({
    productId: z.string()
        .min(1, 'Product ID is required'),
    quantity: z.number()
        .int('Quantity must be an integer')
        .positive('Quantity must be greater than 0'),
    unitPrice: z.number()
        .positive('Unit price must be greater than 0')
        .refine(
            (val) => /^\d+(\.\d{1,2})?$/.test(val.toString()),
            'Unit price must have maximum 2 decimal places'
        )
});

export const createOrderSchema = z.object({
    visitId: z.string()
        .min(1, 'Visit ID is required'),
    items: z.array(orderItemSchema)
        .min(1, 'Order must have at least one item'),
    offlineId: z.string()
        .optional()
});

export const updateOrderStatusSchema = z.object({
    status: z.enum(['PENDING', 'SYNCED', 'PROCESSING', 'COMPLETED', 'CANCELLED'], {
        errorMap: () => ({ message: 'Invalid status' })
    })
});

export const syncOrderSchema = createOrderSchema.extend({
    createdAt: z.string()
        .datetime('Invalid datetime format')
        .optional()
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type SyncOrderInput = z.infer<typeof syncOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
