import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
    createSyncLogController,
    getMyLogsController,
    getAllSyncLogsController,
    getSyncStatisticsController,
    getSyncLogByIdController
} from './sync.controller.js';

const router = Router();

/**
 * GET /api/sync/my-logs
 * Obtener logs de sincronización del usuario autenticado
 * Requiere: Autenticación
 * Query params: ?entityType=&startDate=&endDate=
 */
router.get('/my-logs', authenticate, getMyLogsController);

/**
 * GET /api/sync/statistics
 * Obtener estadísticas de sincronización
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver sus propias estadísticas
 * - ADMIN: puede ver estadísticas de cualquier usuario
 * Query params: ?userId=&startDate=&endDate=
 */
router.get('/statistics', authenticate, getSyncStatisticsController);

/**
 * GET /api/sync
 * Listar todos los logs de sincronización (solo ADMIN)
 * Requiere: Autenticación + ADMIN
 * Query params: ?userId=&entityType=&startDate=&endDate=
 */
router.get('/', authenticate, authorize('ADMIN'), getAllSyncLogsController);

/**
 * POST /api/sync
 * Crear un log de sincronización
 * Requiere: Autenticación
 */
router.post('/', authenticate, createSyncLogController);

/**
 * GET /api/sync/:id
 * Obtener un log específico por ID
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver sus propios logs
 * - ADMIN: puede ver cualquier log
 */
router.get('/:id', authenticate, getSyncLogByIdController);

export default router;
