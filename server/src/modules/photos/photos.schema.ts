import { z } from 'zod';

/**
 * Schema para subir una foto durante una visita
 * - visitId: CUID de la visita a la que pertenece la foto
 * - description (opcional): Descripción de la foto
 */
export const uploadPhotoSchema = z.object({
    visitId: z.string().trim().min(1, 'visitId es requerido').cuid('visitId debe ser un ID válido'),
    description: z.string().max(500, 'La descripción no puede exceder 500 caracteres').optional().or(z.literal(''))
});

/**
 * Schema para sincronizar foto offline
 * - offlineId: ID generado en modo offline (UUID o CUID)
 * - visitId: CUID de la visita del servidor
 * - filename: Nombre del archivo (opcional, se toma del archivo si no se envía)
 * - description (opcional): Descripción de la foto
 */
export const syncOfflinePhotoSchema = z.object({
    offlineId: z.string().trim().min(1, 'offlineId es requerido').uuid('offlineId debe ser un UUID válido'),
    visitId: z.string().trim().min(1, 'visitId es requerido').cuid('visitId debe ser un ID válido'),
    filename: z.string().trim().min(1, 'El nombre del archivo es requerido').optional(),
    description: z.string().max(500, 'La descripción no puede exceder 500 caracteres').optional().or(z.literal(''))
});

/**
 * Schema para query params de búsqueda de fotos
 */
export const getPhotosQuerySchema = z.object({
    visitId: z.string().cuid('visitId debe ser un ID válido').optional(),
    userId: z.string().cuid('userId debe ser un ID válido').optional(),
    storeId: z.string().cuid('storeId debe ser un ID válido').optional(),
    startDate: z.string().datetime('startDate debe ser una fecha válida').optional(),
    endDate: z.string().datetime('endDate debe ser una fecha válida').optional()
});

export type UploadPhotoInput = z.infer<typeof uploadPhotoSchema>;
export type SyncOfflinePhotoInput = z.infer<typeof syncOfflinePhotoSchema>;
export type GetPhotosQuery = z.infer<typeof getPhotosQuerySchema>;
