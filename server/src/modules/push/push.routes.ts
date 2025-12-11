import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
    getVapidPublicKeyController,
    subscribePushController,
    getMySubscriptionsController,
    unsubscribePushController,
    unsubscribeAllController,
    sendNotificationController
} from './push.controller.js';

const router = Router();

/**
 * GET /api/push/vapid-public-key
 * Obtener la clave pública VAPID
 * No requiere autenticación (es una clave pública)
 */
router.get('/vapid-public-key', getVapidPublicKeyController);

/**
 * GET /api/push/my-subscriptions
 * Obtener suscripciones del usuario autenticado
 * Requiere: Autenticación
 */
router.get('/my-subscriptions', authenticate, getMySubscriptionsController);

/**
 * DELETE /api/push/unsubscribe-all
 * Eliminar todas las suscripciones del usuario autenticado
 * Requiere: Autenticación
 */
router.delete('/unsubscribe-all', authenticate, unsubscribeAllController);

/**
 * POST /api/push/subscribe
 * Suscribirse a notificaciones push
 * Requiere: Autenticación
 */
router.post('/subscribe', authenticate, subscribePushController);

/**
 * POST /api/push/send
 * Enviar notificación push (solo ADMIN)
 * Requiere: Autenticación + ADMIN
 */
router.post('/send', authenticate, authorize('ADMIN'), sendNotificationController);

/**
 * DELETE /api/push/unsubscribe/:id
 * Eliminar una suscripción específica
 * Requiere: Autenticación
 */
router.delete('/unsubscribe/:id', authenticate, unsubscribePushController);

export default router;
