import { Router } from 'express';
import { getAllUsers, deleteUser } from './users.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

/**
 * GET /api/users
 * Obtiene todos los usuarios (solo ADMIN)
 * Requiere: Authentication + ADMIN role
 */
router.get('/', authenticate, authorize('ADMIN'), getAllUsers);

/**
 * DELETE /api/users/:id
 * Elimina un usuario (solo ADMIN)
 * Requiere: Authentication + ADMIN role
 */
router.delete('/:id', authenticate, authorize('ADMIN'), deleteUser);

export default router;
