import { Request, Response } from 'express';
import {
    saveFcmToken,
    getUserTokens,
    deleteFcmToken,
    deleteAllUserTokens,
    sendFcmNotification
} from './fcm.service.js';
import {
    saveFcmTokenSchema,
    sendFcmNotificationSchema
} from './fcm.schema.js';
import { ZodError } from 'zod';

/**
 * POST /api/fcm/token - Guardar token FCM del usuario autenticado
 */
export const saveToken = async (req: Request, res: Response) => {
    try {
        const validatedData = saveFcmTokenSchema.parse(req.body);
        const userId = req.user?.userId as string;

        const result = await saveFcmToken(userId, validatedData);

        res.status(201).json({
            success: true,
            data: result,
            message: 'Token FCM guardado correctamente'
        });
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Datos de validación incorrectos',
                errors: error.issues
            });
        }

        if (error instanceof Error && 'name' in error && error.name === 'NotFoundError') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        console.error('Error al guardar token FCM:', error);
        res.status(500).json({
            success: false,
            message: 'Error al guardar token FCM'
        });
    }
};

/**
 * GET /api/fcm/tokens - Obtener todos los tokens del usuario autenticado
 */
export const getMyTokens = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId as string;

        const tokens = await getUserTokens(userId);

        res.json({
            success: true,
            data: tokens
        });
    } catch (error: unknown) {
        console.error('Error al obtener tokens FCM:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tokens FCM'
        });
    }
};

/**
 * DELETE /api/fcm/token/:tokenId - Eliminar un token específico
 */
export const deleteToken = async (req: Request, res: Response) => {
    try {
        const { tokenId } = req.params;
        const userId = req.user?.userId as string;
        const userRole = req.user?.role as string;

        if (!tokenId) {
            return res.status(400).json({
                success: false,
                message: 'Token ID es requerido'
            });
        }

        const result = await deleteFcmToken(tokenId, userId, userRole);

        res.json({
            success: true,
            message: result.message
        });
    } catch (error: unknown) {
        if (error instanceof Error && 'name' in error) {
            if (error.name === 'NotFoundError') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            if (error.name === 'ForbiddenError') {
                return res.status(403).json({
                    success: false,
                    message: error.message
                });
            }
        }

        console.error('Error al eliminar token FCM:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar token FCM'
        });
    }
};

/**
 * DELETE /api/fcm/tokens - Eliminar todos los tokens del usuario autenticado
 */
export const deleteAllTokens = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId as string;

        const result = await deleteAllUserTokens(userId);

        res.json({
            success: true,
            message: result.message,
            count: result.count
        });
    } catch (error: unknown) {
        console.error('Error al eliminar tokens FCM:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar tokens FCM'
        });
    }
};

/**
 * POST /api/fcm/send - Enviar notificación FCM (solo ADMIN)
 */
export const sendNotification = async (req: Request, res: Response) => {
    try {
        const validatedData = sendFcmNotificationSchema.parse(req.body);

        const result = await sendFcmNotification(validatedData);

        res.json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Datos de validación incorrectos',
                errors: error.issues
            });
        }

        console.error('Error al enviar notificación FCM:', error);
        res.status(500).json({
            success: false,
            message: 'Error al enviar notificación FCM'
        });
    }
};
