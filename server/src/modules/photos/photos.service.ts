import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../../config/prisma.js';
import type { UploadPhotoInput, SyncOfflinePhotoInput, GetPhotosQuery } from './photos.schema.js';

/**
 * Configuración de almacenamiento de Multer
 * Organiza las fotos por año/mes para mejor gestión
 */
const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const uploadPath = path.join('uploads', 'photos', String(year), month);

        try {
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (error) {
            cb(error as Error, uploadPath);
        }
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `photo-${uniqueSuffix}${ext}`);
    }
});

/**
 * Filtro de archivos: solo permite imágenes
 */
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WEBP)'));
    }
};

/**
 * Configuración de Multer
 * - Límite de 5MB por archivo
 * - Solo acepta imágenes
 */
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

/**
 * Subir foto de una visita
 */
export const uploadPhoto = async (
    userId: string,
    data: UploadPhotoInput,
    file: Express.Multer.File
) => {
    // Verificar que la visita existe y pertenece al usuario
    const visit = await prisma.visit.findUnique({
        where: { id: data.visitId },
        include: { store: true }
    });

    if (!visit) {
        const error = new Error('Visita no encontrada') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    if (visit.userId !== userId) {
        const error = new Error('No tienes permiso para subir fotos a esta visita') as Error & { name: string };
        error.name = 'ForbiddenError';
        throw error;
    }

    // Verificar límite de 3 fotos por visita
    const photoCount = await prisma.photo.count({
        where: { visitId: data.visitId }
    });

    if (photoCount >= 3) {
        const error = new Error('Ya se alcanzó el límite máximo de 3 fotos por visita') as Error & { name: string };
        error.name = 'LimitExceededError';
        throw error;
    }

    // Crear registro de la foto
    const photo = await prisma.photo.create({
        data: {
            visitId: data.visitId,
            storeId: visit.storeId,
            userId,
            filename: file.filename,
            filepath: file.path,
            mimetype: file.mimetype,
            size: file.size,
            description: data.description
        },
        include: {
            visit: { select: { id: true, visitedAt: true } },
            store: { select: { id: true, name: true } }
        }
    });

    return photo;
};

/**
 * Obtener foto por ID
 */
export const getPhotoById = async (photoId: string, userId: string, userRole: string) => {
    const photo = await prisma.photo.findUnique({
        where: { id: photoId },
        include: {
            visit: { select: { id: true, visitedAt: true } },
            store: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true } }
        }
    });

    if (!photo) {
        const error = new Error('Foto no encontrada') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    // REPARTIDOR solo puede ver sus propias fotos
    if (userRole !== 'ADMIN' && photo.userId !== userId) {
        const error = new Error('No tienes permiso para ver esta foto') as Error & { name: string };
        error.name = 'ForbiddenError';
        throw error;
    }

    return photo;
};

/**
 * Obtener todas las fotos de una visita
 */
export const getVisitPhotos = async (visitId: string, userId: string, userRole: string) => {
    // Verificar que la visita existe
    const visit = await prisma.visit.findUnique({
        where: { id: visitId }
    });

    if (!visit) {
        const error = new Error('Visita no encontrada') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    // REPARTIDOR solo puede ver fotos de sus propias visitas
    if (userRole !== 'ADMIN' && visit.userId !== userId) {
        const error = new Error('No tienes permiso para ver las fotos de esta visita') as Error & { name: string };
        error.name = 'ForbiddenError';
        throw error;
    }

    const photos = await prisma.photo.findMany({
        where: { visitId },
        include: {
            visit: { select: { id: true, visitedAt: true } },
            store: { select: { id: true, name: true } }
        },
        orderBy: { uploadedAt: 'desc' }
    });

    return photos;
};

/**
 * Obtener fotos con filtros (solo ADMIN)
 */
export const getAllPhotos = async (filters: GetPhotosQuery) => {
    const where: any = {};

    if (filters.visitId) {
        where.visitId = filters.visitId;
    }

    if (filters.userId) {
        where.userId = filters.userId;
    }

    if (filters.storeId) {
        where.storeId = filters.storeId;
    }

    if (filters.startDate || filters.endDate) {
        where.uploadedAt = {};
        if (filters.startDate) {
            where.uploadedAt.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
            where.uploadedAt.lte = new Date(filters.endDate);
        }
    }

    const photos = await prisma.photo.findMany({
        where,
        include: {
            visit: { select: { id: true, visitedAt: true } },
            store: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true } }
        },
        orderBy: { uploadedAt: 'desc' }
    });

    return photos;
};

/**
 * Eliminar foto
 */
export const deletePhoto = async (photoId: string, userId: string, userRole: string) => {
    const photo = await prisma.photo.findUnique({
        where: { id: photoId }
    });

    if (!photo) {
        const error = new Error('Foto no encontrada') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    // REPARTIDOR solo puede eliminar sus propias fotos
    if (userRole !== 'ADMIN' && photo.userId !== userId) {
        const error = new Error('No tienes permiso para eliminar esta foto') as Error & { name: string };
        error.name = 'ForbiddenError';
        throw error;
    }

    // Eliminar archivo físico
    try {
        await fs.unlink(photo.filepath);
    } catch (error) {
        console.error('Error al eliminar archivo físico:', error);
        // Continuar con la eliminación del registro aunque falle el archivo
    }

    // Eliminar registro de la base de datos
    await prisma.photo.delete({
        where: { id: photoId }
    });

    return { success: true, message: 'Foto eliminada correctamente' };
};

/**
 * Sincronizar foto creada en modo offline
 */
export const syncOfflinePhoto = async (
    userId: string,
    data: SyncOfflinePhotoInput,
    file: Express.Multer.File
) => {
    // Verificar si ya existe una foto con ese offlineId
    const existingPhoto = await prisma.photo.findUnique({
        where: { offlineId: data.offlineId }
    });

    if (existingPhoto) {
        return existingPhoto;
    }

    // Verificar que la visita existe y pertenece al usuario
    const visit = await prisma.visit.findUnique({
        where: { id: data.visitId },
        include: { store: true }
    });

    if (!visit) {
        const error = new Error('Visita no encontrada') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    if (visit.userId !== userId) {
        const error = new Error('No tienes permiso para sincronizar fotos a esta visita') as Error & { name: string };
        error.name = 'ForbiddenError';
        throw error;
    }

    // Crear registro de la foto con offlineId
    const photo = await prisma.photo.create({
        data: {
            offlineId: data.offlineId,
            visitId: data.visitId,
            storeId: visit.storeId,
            userId,
            filename: file.filename,
            filepath: file.path,
            mimetype: file.mimetype,
            size: file.size,
            description: data.description
        },
        include: {
            visit: { select: { id: true, visitedAt: true } },
            store: { select: { id: true, name: true } }
        }
    });

    return photo;
};

/**
 * Servir archivo de foto
 */
export const servePhoto = async (photoId: string, userId: string, userRole: string) => {
    const photo = await prisma.photo.findUnique({
        where: { id: photoId }
    });

    if (!photo) {
        const error = new Error('Foto no encontrada') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    // REPARTIDOR solo puede ver sus propias fotos
    if (userRole !== 'ADMIN' && photo.userId !== userId) {
        const error = new Error('No tienes permiso para ver esta foto') as Error & { name: string };
        error.name = 'ForbiddenError';
        throw error;
    }

    // Verificar que el archivo existe
    try {
        await fs.access(photo.filepath);
    } catch {
        const error = new Error('Archivo no encontrado en el servidor') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    return {
        filepath: photo.filepath,
        mimetype: photo.mimetype,
        filename: photo.filename
    };
};
