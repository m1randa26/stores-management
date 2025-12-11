import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
    saveToken,
    getMyTokens,
    deleteToken,
    deleteAllTokens,
    sendNotification
} from './fcm.controller.js';

const router = Router();

// Rutas para todos los usuarios autenticados
router.post('/token', authenticate, saveToken);
router.get('/tokens', authenticate, getMyTokens);
router.delete('/token/:tokenId', authenticate, deleteToken);
router.delete('/tokens', authenticate, deleteAllTokens);

// Rutas solo para ADMIN
router.post('/send', authenticate, authorize('ADMIN'), sendNotification);

export default router;
