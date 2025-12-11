import { messaging } from '../../config/firebase.js';
import { prisma } from '../../config/prisma.js';
import type { SaveFcmTokenInput, SendFcmNotificationInput } from './fcm.schema.js';

/**
 * Guardar token FCM de un usuario
 */
export const saveFcmToken = async (userId: string, data: SaveFcmTokenInput) => {
    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        const error = new Error('Usuario no encontrado') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    // Verificar si el token ya existe
    const existingToken = await prisma.fcmToken.findUnique({
        where: { token: data.token }
    });

    if (existingToken) {
        // Si existe pero es de otro usuario, actualizar
        if (existingToken.userId !== userId) {
            const updated = await prisma.fcmToken.update({
                where: { token: data.token },
                data: {
                    userId,
                    deviceInfo: data.deviceInfo,
                    updatedAt: new Date()
                }
            });
            return updated;
        }
        // Si es del mismo usuario, solo actualizar la fecha
        const updated = await prisma.fcmToken.update({
            where: { token: data.token },
            data: {
                deviceInfo: data.deviceInfo,
                updatedAt: new Date()
            }
        });
        return updated;
    }

    // Crear nuevo token
    const fcmToken = await prisma.fcmToken.create({
        data: {
            userId,
            token: data.token,
            deviceInfo: data.deviceInfo
        }
    });

    console.log(`✅ Token FCM guardado para usuario ${user.name}`);
    return fcmToken;
};

/**
 * Obtener todos los tokens de un usuario
 */
export const getUserTokens = async (userId: string) => {
    return await prisma.fcmToken.findMany({
        where: { userId }
    });
};

/**
 * Eliminar token FCM
 */
export const deleteFcmToken = async (tokenId: string, userId: string, userRole: string) => {
    const token = await prisma.fcmToken.findUnique({
        where: { id: tokenId }
    });

    if (!token) {
        const error = new Error('Token no encontrado') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    // Solo el dueño o admin puede eliminar
    if (userRole !== 'ADMIN' && token.userId !== userId) {
        const error = new Error('No tienes permiso para eliminar este token') as Error & { name: string };
        error.name = 'ForbiddenError';
        throw error;
    }

    await prisma.fcmToken.delete({
        where: { id: tokenId }
    });

    return { success: true, message: 'Token eliminado correctamente' };
};

/**
 * Eliminar todos los tokens de un usuario
 */
export const deleteAllUserTokens = async (userId: string) => {
    const result = await prisma.fcmToken.deleteMany({
        where: { userId }
    });

    return {
        success: true,
        message: 'Todos los tokens eliminados',
        count: result.count
    };
};

/**
 * Enviar notificación FCM
 */
export const sendFcmNotification = async (data: SendFcmNotificationInput) => {
    // Obtener tokens de los usuarios destino
    const where: any = {};
    if (data.userIds && data.userIds.length > 0) {
        where.userId = { in: data.userIds };
    }

    const fcmTokens = await prisma.fcmToken.findMany({
        where,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        }
    });

    if (fcmTokens.length === 0) {
        return {
            success: 0,
            failure: 0,
            removed: 0,
            message: 'No hay tokens FCM para los usuarios especificados'
        };
    }

    console.log(`📤 Enviando notificación FCM a ${fcmTokens.length} dispositivo(s)...`);

    let successCount = 0;
    let failureCount = 0;
    let removedCount = 0;

    // Preparar mensaje
    const message: any = {
        notification: {
            title: data.title,
            body: data.body
        },
        data: data.data || {}
    };

    if (data.imageUrl) {
        message.notification.imageUrl = data.imageUrl;
    }

    // Enviar a cada token
    for (const fcmToken of fcmTokens) {
        try {
            message.token = fcmToken.token;
            
            console.log(`📨 Enviando a ${fcmToken.user.name} (${fcmToken.user.email})...`);
            
            const response = await messaging.send(message);
            console.log(`✅ Notificación enviada exitosamente:`, response);
            successCount++;
        } catch (error: any) {
            failureCount++;
            console.error(`❌ Error al enviar notificación a ${fcmToken.user.email}:`);
            console.error(`   Error:`, error.message);

            // Si el token es inválido, eliminarlo
            if (
                error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered'
            ) {
                try {
                    await prisma.fcmToken.delete({
                        where: { id: fcmToken.id }
                    });
                    removedCount++;
                    console.log(`🗑️  Token inválido eliminado para ${fcmToken.user.email}`);
                } catch (deleteError) {
                    console.error('Error al eliminar token inválido:', deleteError);
                }
            }
        }
    }

    console.log(`📊 Resultado: ${successCount} enviadas, ${failureCount} fallidas, ${removedCount} tokens eliminados`);

    return {
        success: successCount,
        failure: failureCount,
        removed: removedCount,
        message: `Notificaciones: ${successCount} enviadas, ${failureCount} fallidas, ${removedCount} tokens eliminados`
    };
};
