import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
    createVisitController,
    getVisitByIdController,
    getMyVisitsController,
    getAllVisitsController,
    getStoreVisitsController,
    syncOfflineVisitController,
    getVisitStatisticsController
} from './visits.controller.js';

const router = Router();

/**
 * GET /api/visits/my-visits
 * Obtener visitas del repartidor autenticado
 * Requiere: Autenticación (REPARTIDOR)
 * Query params: ?storeId=&startDate=&endDate=&hasOrder=
 */
router.get('/my-visits', authenticate, getMyVisitsController);

/**
 * POST /api/visits/sync
 * Sincronizar visita creada en modo offline
 * Requiere: Autenticación (REPARTIDOR)
 */
router.post('/sync', authenticate, syncOfflineVisitController);

/**
 * GET /api/visits/statistics
 * Obtener estadísticas de visitas
 * Requiere: Autenticación + ADMIN
 * Query params: ?userId=&storeId=
 */
router.get('/statistics', authenticate, authorize('ADMIN'), getVisitStatisticsController);

/**
 * GET /api/visits/store/:storeId
 * Obtener visitas de una tienda específica
 * Requiere: Autenticación + ADMIN
 * Query params: ?startDate=&endDate=
 */
router.get('/store/:storeId', authenticate, authorize('ADMIN'), getStoreVisitsController);

/**
 * GET /api/visits
 * Listar todas las visitas (solo ADMIN)
 * Requiere: Autenticación + ADMIN
 * Query params: ?userId=&storeId=&startDate=&endDate=&synced=
 */
router.get('/', authenticate, authorize('ADMIN'), getAllVisitsController);

/**
 * POST /api/visits
 * Registrar nueva visita
 * Requiere: Autenticación (REPARTIDOR)
 */
router.post('/', authenticate, createVisitController);

/**
 * GET /api/visits/:id
 * Obtener visita específica por ID
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver sus propias visitas
 * - ADMIN: puede ver cualquier visita
 */
router.get('/:id', authenticate, getVisitByIdController);

export default router;
