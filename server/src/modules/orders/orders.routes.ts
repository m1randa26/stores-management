import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
    createOrderController,
    getOrderByIdController,
    getMyOrdersController,
    getAllOrdersController,
    getStoreOrdersController,
    updateOrderStatusController,
    syncOfflineOrderController,
    getOrderStatisticsController
} from './orders.controller.js';

const router = Router();

/**
 * GET /api/orders/my-orders
 * Obtener órdenes del repartidor autenticado
 * Requiere: Autenticación (REPARTIDOR)
 * Query params: ?storeId=&status=&startDate=&endDate=
 */
router.get('/my-orders', authenticate, getMyOrdersController);

/**
 * POST /api/orders/sync
 * Sincronizar orden creada en modo offline
 * Requiere: Autenticación (REPARTIDOR)
 */
router.post('/sync', authenticate, syncOfflineOrderController);

/**
 * GET /api/orders/statistics
 * Obtener estadísticas de órdenes
 * Requiere: Autenticación + ADMIN
 * Query params: ?userId=&storeId=&startDate=&endDate=
 */
router.get('/statistics', authenticate, authorize('ADMIN'), getOrderStatisticsController);

/**
 * GET /api/orders/store/:storeId
 * Obtener órdenes de una tienda específica
 * Requiere: Autenticación + ADMIN
 * Query params: ?status=&startDate=&endDate=
 */
router.get('/store/:storeId', authenticate, authorize('ADMIN'), getStoreOrdersController);

/**
 * GET /api/orders
 * Listar todas las órdenes (solo ADMIN)
 * Requiere: Autenticación + ADMIN
 * Query params: ?userId=&storeId=&status=&startDate=&endDate=&synced=
 */
router.get('/', authenticate, authorize('ADMIN'), getAllOrdersController);

/**
 * POST /api/orders
 * Crear nueva orden durante una visita
 * Requiere: Autenticación (REPARTIDOR)
 */
router.post('/', authenticate, createOrderController);

/**
 * GET /api/orders/:id
 * Obtener orden específica por ID
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver sus propias órdenes
 * - ADMIN: puede ver cualquier orden
 */
router.get('/:id', authenticate, getOrderByIdController);

/**
 * PATCH /api/orders/:id/status
 * Actualizar estado de la orden
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede actualizar sus propias órdenes (transiciones limitadas)
 * - ADMIN: puede actualizar cualquier orden
 */
router.patch('/:id/status', authenticate, updateOrderStatusController);

export default router;
