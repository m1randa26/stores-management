import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import path from 'path';
import {
    uploadPhotoSchema,
    syncOfflinePhotoSchema,
    getPhotosQuerySchema
} from './photos.schema.js';
import {
    uploadPhoto,
    getPhotoById,
    getVisitPhotos,
    getAllPhotos,
    deletePhoto,
    syncOfflinePhoto,
    servePhoto
} from './photos.service.js';

/**
 * POST /api/photos
 * Subir foto de una visita
 * Requiere: Autenticación (REPARTIDOR)
 * Body (multipart/form-data): visitId, description (opcional), file
 */
export const uploadPhotoController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'No se proporcionó ningún archivo'
            });
            return;
        }

        // Debug: ver qué llega en req.body
        console.log('req.body:', req.body);
        console.log('req.file:', req.file);

        const validatedData = uploadPhotoSchema.parse(req.body);
        const photo = await uploadPhoto(req.user!.userId, validatedData, req.file);

        res.status(201).json({
            success: true,
            message: 'Foto subida correctamente',
            data: photo
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: error.issues
            });
            return;
        }

        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({ success: false, message: error.message });
                return;
            }
            if (error.name === 'ForbiddenError') {
                res.status(403).json({ success: false, message: error.message });
                return;
            }
            if (error.name === 'LimitExceededError') {
                res.status(400).json({ success: false, message: error.message });
                return;
            }
            if (error.message.includes('Tipo de archivo no permitido')) {
                res.status(400).json({ success: false, message: error.message });
                return;
            }
            if (error.message.includes('File too large')) {
                res.status(400).json({
                    success: false,
                    message: 'El archivo es demasiado grande. Tamaño máximo: 5MB'
                });
                return;
            }
        }

        console.error('Error al subir foto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/photos/:id
 * Obtener información de una foto por ID
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver sus propias fotos
 * - ADMIN: puede ver cualquier foto
 */
export const getPhotoByIdController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const photo = await getPhotoById(id, req.user!.userId, req.user!.role);

        res.status(200).json({
            success: true,
            data: photo
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({ success: false, message: error.message });
                return;
            }
            if (error.name === 'ForbiddenError') {
                res.status(403).json({ success: false, message: error.message });
                return;
            }
        }

        console.error('Error al obtener foto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/photos/visit/:visitId
 * Obtener todas las fotos de una visita
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver fotos de sus propias visitas
 * - ADMIN: puede ver fotos de cualquier visita
 */
export const getVisitPhotosController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { visitId } = req.params;
        const photos = await getVisitPhotos(visitId, req.user!.userId, req.user!.role);

        res.status(200).json({
            success: true,
            data: photos
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({ success: false, message: error.message });
                return;
            }
            if (error.name === 'ForbiddenError') {
                res.status(403).json({ success: false, message: error.message });
                return;
            }
        }

        console.error('Error al obtener fotos de visita:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/photos
 * Listar todas las fotos con filtros (solo ADMIN)
 * Requiere: Autenticación + ADMIN
 * Query params: ?visitId=&userId=&storeId=&startDate=&endDate=
 */
export const getAllPhotosController = async (req: Request, res: Response): Promise<void> => {
    try {
        const filters = getPhotosQuerySchema.parse(req.query);
        const photos = await getAllPhotos(filters);

        res.status(200).json({
            success: true,
            data: photos
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Parámetros de búsqueda inválidos',
                errors: error.issues
            });
            return;
        }

        console.error('Error al listar fotos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * DELETE /api/photos/:id
 * Eliminar una foto
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede eliminar sus propias fotos
 * - ADMIN: puede eliminar cualquier foto
 */
export const deletePhotoController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = await deletePhoto(id, req.user!.userId, req.user!.role);

        res.status(200).json(result);
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({ success: false, message: error.message });
                return;
            }
            if (error.name === 'ForbiddenError') {
                res.status(403).json({ success: false, message: error.message });
                return;
            }
        }

        console.error('Error al eliminar foto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * POST /api/photos/sync
 * Sincronizar foto creada en modo offline
 * Requiere: Autenticación (REPARTIDOR)
 * Body (multipart/form-data): offlineId, visitId, filename, description (opcional), file
 */
export const syncOfflinePhotoController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'No se proporcionó ningún archivo'
            });
            return;
        }

        // Debug: ver qué llega en req.body
        console.log('req.body (sync):', req.body);
        console.log('req.file (sync):', req.file);

        const validatedData = syncOfflinePhotoSchema.parse(req.body);
        const photo = await syncOfflinePhoto(req.user!.userId, validatedData, req.file);

        res.status(201).json({
            success: true,
            message: 'Foto sincronizada correctamente',
            data: photo
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: error.issues
            });
            return;
        }

        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({ success: false, message: error.message });
                return;
            }
            if (error.name === 'ForbiddenError') {
                res.status(403).json({ success: false, message: error.message });
                return;
            }
        }

        console.error('Error al sincronizar foto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/photos/:id/file
 * Servir el archivo de imagen
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver sus propias fotos
 * - ADMIN: puede ver cualquier foto
 */
export const servePhotoController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const fileInfo = await servePhoto(id, req.user!.userId, req.user!.role);

        // Convertir a ruta absoluta
        const absolutePath = path.resolve(fileInfo.filepath);

        res.setHeader('Content-Type', fileInfo.mimetype);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache por 1 año
        res.sendFile(absolutePath);
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({ success: false, message: error.message });
                return;
            }
            if (error.name === 'ForbiddenError') {
                res.status(403).json({ success: false, message: error.message });
                return;
            }
        }

        console.error('Error al servir foto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};
