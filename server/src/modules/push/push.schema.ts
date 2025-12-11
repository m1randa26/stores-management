import { z } from 'zod';

/**
 * Schema para suscribirse a notificaciones push
 */
export const subscribePushSchema = z.object({
    endpoint: z.string().url('endpoint debe ser una URL válida'),
    keys: z.object({
        p256dh: z.string().min(1, 'p256dh es requerido'),
        auth: z.string().min(1, 'auth es requerido')
    }),
    userAgent: z.string().max(500, 'userAgent no puede exceder 500 caracteres').optional()
});

/**
 * Schema para enviar notificación (solo ADMIN)
 */
export const sendNotificationSchema = z.object({
    title: z.string().min(1, 'title es requerido').max(100, 'title no puede exceder 100 caracteres'),
    body: z.string().min(1, 'body es requerido').max(500, 'body no puede exceder 500 caracteres'),
    userIds: z.array(z.string().cuid('Cada userId debe ser un ID válido')).optional(),
    data: z.record(z.any()).optional()
});

export type SubscribePushInput = z.infer<typeof subscribePushSchema>;
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
