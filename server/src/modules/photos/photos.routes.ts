import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { upload } from './photos.service.js';
import {
    uploadPhotoController,
    getPhotoByIdController,
    getVisitPhotosController,
    getAllPhotosController,
    deletePhotoController,
    syncOfflinePhotoController,
    servePhotoController
} from './photos.controller.js';

const router = Router();

/**
 * POST /api/photos/sync
 * Sincronizar foto creada en modo offline
 * Requiere: Autenticación (REPARTIDOR)
 * Body (multipart/form-data): offlineId, visitId, filename, description (opcional), file
 */
router.post('/sync', authenticate, upload.single('photo'), syncOfflinePhotoController);

/**
 * GET /api/photos/visit/:visitId
 * Obtener todas las fotos de una visita específica
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver fotos de sus propias visitas
 * - ADMIN: puede ver fotos de cualquier visita
 */
router.get('/visit/:visitId', authenticate, getVisitPhotosController);

/**
 * GET /api/photos
 * Listar todas las fotos con filtros (solo ADMIN)
 * Requiere: Autenticación + ADMIN
 * Query params: ?visitId=&userId=&storeId=&startDate=&endDate=
 */
router.get('/', authenticate, authorize('ADMIN'), getAllPhotosController);

/**
 * POST /api/photos
 * Subir foto de una visita
 * Requiere: Autenticación (REPARTIDOR)
 * Body (multipart/form-data): visitId, description (opcional), file
 */
router.post('/', authenticate, upload.single('photo'), uploadPhotoController);

/**
 * GET /api/photos/:id/file
 * Servir el archivo de imagen
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver sus propias fotos
 * - ADMIN: puede ver cualquier foto
 */
router.get('/:id/file', authenticate, servePhotoController);

/**
 * GET /api/photos/:id
 * Obtener información de una foto por ID
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver sus propias fotos
 * - ADMIN: puede ver cualquier foto
 */
router.get('/:id', authenticate, getPhotoByIdController);

/**
 * DELETE /api/photos/:id
 * Eliminar una foto
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede eliminar sus propias fotos
 * - ADMIN: puede eliminar cualquier foto
 */
router.delete('/:id', authenticate, deletePhotoController);

export default router;
