import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
    createStoreController,
    getStoresController,
    getStoreByIdController,
    updateStoreController,
    toggleStoreStatusController,
    getStoreByQRController,
    assignUserController,
    unassignUserController,
    getStoreAssignmentsController,
    getMyStoresController
} from './stores.controller.js';

const router = Router();

/**
 * GET /api/stores/qr/:qrCode
 * Buscar tienda por código QR
 * Público - usado por repartidores al escanear
 */
router.get('/qr/:qrCode', getStoreByQRController);

/**
 * GET /api/stores/my-stores
 * Obtener tiendas asignadas al repartidor autenticado
 * Requiere: Autenticación (REPARTIDOR)
 */
router.get('/my-stores', authenticate, getMyStoresController);

/**
 * GET /api/stores
 * Listar todas las tiendas
 * Requiere: Autenticación (REPARTIDOR o ADMIN)
 */
router.get('/', authenticate, getStoresController);

/**
 * GET /api/stores/:id
 * Obtener tienda específica por ID
 * Requiere: Autenticación (REPARTIDOR o ADMIN)
 */
router.get('/:id', authenticate, getStoreByIdController);

/**
 * POST /api/stores
 * Crear nueva tienda
 * Requiere: Autenticación + ADMIN
 */
router.post('/', authenticate, authorize('ADMIN'), createStoreController);

/**
 * PUT /api/stores/:id
 * Actualizar información de tienda
 * Requiere: Autenticación + ADMIN
 */
router.put('/:id', authenticate, authorize('ADMIN'), updateStoreController);

/**
 * PATCH /api/stores/:id/status
 * Activar/Desactivar tienda
 * Requiere: Autenticación + ADMIN
 */
router.patch('/:id/status', authenticate, authorize('ADMIN'), toggleStoreStatusController);

/**
 * POST /api/stores/:id/assign
 * Asignar repartidor a tienda
 * Requiere: Autenticación + ADMIN
 * Body: { userId: string }
 */
router.post('/:id/assign', authenticate, authorize('ADMIN'), assignUserController);

/**
 * DELETE /api/stores/:id/unassign/:userId
 * Desasignar repartidor de tienda
 * Requiere: Autenticación + ADMIN
 */
router.delete('/:id/unassign/:userId', authenticate, authorize('ADMIN'), unassignUserController);

/**
 * GET /api/stores/:id/assignments
 * Obtener lista de repartidores asignados a tienda
 * Requiere: Autenticación + ADMIN
 */
router.get('/:id/assignments', authenticate, authorize('ADMIN'), getStoreAssignmentsController);

export default router;
