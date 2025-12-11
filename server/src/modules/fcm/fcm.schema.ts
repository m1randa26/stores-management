import { z } from 'zod';

export const saveFcmTokenSchema = z.object({
    token: z.string().min(1, 'Token de FCM requerido'),
    deviceInfo: z.string().optional()
});

export const sendFcmNotificationSchema = z.object({
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(500),
    userIds: z.array(z.string().cuid()).optional(),
    data: z.record(z.string(), z.string()).optional(),
    imageUrl: z.string().url().optional()
});

export type SaveFcmTokenInput = z.infer<typeof saveFcmTokenSchema>;
export type SendFcmNotificationInput = z.infer<typeof sendFcmNotificationSchema>;
