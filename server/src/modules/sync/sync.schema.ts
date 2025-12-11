import { z } from 'zod';

/**
 * Schema para crear un log de sincronización
 */
export const createSyncLogSchema = z.object({
    entityType: z.enum(['VISIT', 'ORDER', 'PHOTO'], {
        message: 'entityType debe ser VISIT, ORDER o PHOTO'
    }),
    entityId: z.string().cuid('entityId debe ser un ID válido'),
    action: z.enum(['CREATE', 'UPDATE'], {
        message: 'action debe ser CREATE o UPDATE'
    }),
    deviceInfo: z.string().max(500, 'deviceInfo no puede exceder 500 caracteres').optional()
});

/**
 * Schema para query params de búsqueda de logs
 */
export const getSyncLogsQuerySchema = z.object({
    userId: z.string().cuid('userId debe ser un ID válido').optional(),
    entityType: z.enum(['VISIT', 'ORDER', 'PHOTO']).optional(),
    startDate: z.string().datetime('startDate debe ser una fecha válida').optional(),
    endDate: z.string().datetime('endDate debe ser una fecha válida').optional()
});

/**
 * Schema para query params de estadísticas
 */
export const getSyncStatisticsQuerySchema = z.object({
    userId: z.string().cuid('userId debe ser un ID válido').optional(),
    startDate: z.string().datetime('startDate debe ser una fecha válida').optional(),
    endDate: z.string().datetime('endDate debe ser una fecha válida').optional()
});

export type CreateSyncLogInput = z.infer<typeof createSyncLogSchema>;
export type GetSyncLogsQuery = z.infer<typeof getSyncLogsQuerySchema>;
export type GetSyncStatisticsQuery = z.infer<typeof getSyncStatisticsQuerySchema>;
