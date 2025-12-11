import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
    createProductController,
    getProductsController,
    getProductByIdController,
    getProductBySkuController,
    updateProductController,
    toggleProductStatusController,
    deleteProductController,
    getActiveProductsController
} from './products.controller.js';

const router = Router();

/**
 * GET /api/products/active
 * Obtener catálogo de productos activos
 * Requiere: Autenticación (REPARTIDOR o ADMIN)
 */
router.get('/active', authenticate, getActiveProductsController);

/**
 * GET /api/products/sku/:sku
 * Buscar producto por SKU (código de barras)
 * Requiere: Autenticación (REPARTIDOR o ADMIN)
 */
router.get('/sku/:sku', authenticate, getProductBySkuController);

/**
 * GET /api/products
 * Listar todos los productos
 * Requiere: Autenticación (REPARTIDOR o ADMIN)
 * Query params: ?isActive=true&search=coca
 */
router.get('/', authenticate, getProductsController);

/**
 * GET /api/products/:id
 * Obtener producto específico por ID
 * Requiere: Autenticación (REPARTIDOR o ADMIN)
 */
router.get('/:id', authenticate, getProductByIdController);

/**
 * POST /api/products
 * Crear nuevo producto
 * Requiere: Autenticación + ADMIN
 */
router.post('/', authenticate, authorize('ADMIN'), createProductController);

/**
 * PUT /api/products/:id
 * Actualizar información de producto
 * Requiere: Autenticación + ADMIN
 */
router.put('/:id', authenticate, authorize('ADMIN'), updateProductController);

/**
 * PATCH /api/products/:id/status
 * Activar/Desactivar producto
 * Requiere: Autenticación + ADMIN
 */
router.patch('/:id/status', authenticate, authorize('ADMIN'), toggleProductStatusController);

/**
 * DELETE /api/products/:id
 * Eliminar producto (o desactivar si tiene órdenes)
 * Requiere: Autenticación + ADMIN
 */
router.delete('/:id', authenticate, authorize('ADMIN'), deleteProductController);

export default router;
