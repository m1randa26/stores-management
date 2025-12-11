import { Router } from 'express';
import { register, login, getProfile } from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

/**
 * POST /api/auth/register
 * Registra un nuevo usuario en el sistema
 * Body: { email, name, password, role }
 */
router.post('/register', register);

/**
 * POST /api/auth/login
 * Inicia sesión y retorna un JWT token
 * Body: { email, password }
 */
router.post('/login', login);

/**
 * GET /api/auth/me
 * Obtiene el perfil del usuario autenticado
 * Requiere: Authorization header con JWT token
 */
router.get('/me', authenticate, getProfile);

export default router;
