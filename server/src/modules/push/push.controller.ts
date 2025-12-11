import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { subscribePushSchema, sendNotificationSchema } from './push.schema.js';
import {
    getVapidPublicKey,
    subscribePush,
    getUserSubscriptions,
    unsubscribePush,
    unsubscribeAll,
    sendNotification
} from './push.service.js';

/**
 * GET /api/push/vapid-public-key
 * Obtener la clave pública VAPID
 * No requiere autenticación (es una clave pública)
 */
export const getVapidPublicKeyController = async (_req: Request, res: Response): Promise<void> => {
    try {
        const publicKey = getVapidPublicKey();

        res.status(200).json({
            success: true,
            data: {
                publicKey
            }
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'ConfigurationError') {
                res.status(500).json({
                    success: false,
                    message: error.message
                });
                return;
            }
        }

        console.error('Error al obtener clave pública VAPID:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * POST /api/push/subscribe
 * Suscribirse a notificaciones push
 * Requiere: Autenticación
 */
export const subscribePushController = async (req: Request, res: Response): Promise<void> => {
    try {
        const validatedData = subscribePushSchema.parse(req.body);
        const subscription = await subscribePush(req.user!.userId, validatedData);

        res.status(201).json({
            success: true,
            message: 'Suscripción registrada correctamente',
            data: {
                id: subscription.id,
                userId: subscription.userId,
                endpoint: subscription.endpoint,
                subscribedAt: subscription.subscribedAt
            }
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: error.issues
            });
            return;
        }

        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({ success: false, message: error.message });
                return;
            }
        }

        console.error('Error al suscribirse a notificaciones push:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/push/my-subscriptions
 * Obtener suscripciones del usuario autenticado
 * Requiere: Autenticación
 */
export const getMySubscriptionsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const subscriptions = await getUserSubscriptions(req.user!.userId);

        res.status(200).json({
            success: true,
            data: subscriptions.map(sub => ({
                id: sub.id,
                userId: sub.userId,
                endpoint: sub.endpoint,
                userAgent: sub.userAgent,
                subscribedAt: sub.subscribedAt
            }))
        });
    } catch (error) {
        console.error('Error al obtener suscripciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * DELETE /api/push/unsubscribe/:id
 * Eliminar una suscripción específica
 * Requiere: Autenticación
 */
export const unsubscribePushController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = await unsubscribePush(id, req.user!.userId, req.user!.role);

        res.status(200).json(result);
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({ success: false, message: error.message });
                return;
            }
            if (error.name === 'ForbiddenError') {
                res.status(403).json({ success: false, message: error.message });
                return;
            }
        }

        console.error('Error al desuscribirse de notificaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * DELETE /api/push/unsubscribe-all
 * Eliminar todas las suscripciones del usuario autenticado
 * Requiere: Autenticación
 */
export const unsubscribeAllController = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await unsubscribeAll(req.user!.userId);

        res.status(200).json(result);
    } catch (error) {
        console.error('Error al eliminar todas las suscripciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * POST /api/push/send
 * Enviar notificación push (solo ADMIN)
 * Requiere: Autenticación + ADMIN
 */
export const sendNotificationController = async (req: Request, res: Response): Promise<void> => {
    try {
        const validatedData = sendNotificationSchema.parse(req.body);
        const result = await sendNotification(validatedData);

        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                sent: result.sent,
                failed: result.failed,
                removed: result.removed
            }
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: error.issues
            });
            return;
        }

        if (error instanceof Error) {
            if (error.name === 'ConfigurationError') {
                res.status(500).json({
                    success: false,
                    message: error.message
                });
                return;
            }
        }

        console.error('Error al enviar notificaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};
