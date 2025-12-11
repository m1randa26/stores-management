import webpush from 'web-push';
import { prisma } from '../../config/prisma.js';
import type { SubscribePushInput, SendNotificationInput } from './push.schema.js';

// Configurar VAPID keys desde variables de entorno
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
}

/**
 * Obtener la clave pública VAPID
 */
export const getVapidPublicKey = () => {
    if (!VAPID_PUBLIC_KEY) {
        const error = new Error('VAPID public key no configurada') as Error & { name: string };
        error.name = 'ConfigurationError';
        throw error;
    }
    return VAPID_PUBLIC_KEY;
};

/**
 * Suscribirse a notificaciones push
 */
export const subscribePush = async (userId: string, data: SubscribePushInput) => {
    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        const error = new Error('Usuario no encontrado') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    // Verificar si ya existe una suscripción con este endpoint
    const existingSubscription = await prisma.pushSubscription.findUnique({
        where: { endpoint: data.endpoint }
    });

    if (existingSubscription) {
        // Si el endpoint ya existe, actualizar el userId (puede ser un dispositivo que cambió de usuario)
        if (existingSubscription.userId !== userId) {
            const updatedSubscription = await prisma.pushSubscription.update({
                where: { endpoint: data.endpoint },
                data: {
                    userId,
                    p256dh: data.keys.p256dh,
                    auth: data.keys.auth,
                    userAgent: data.userAgent
                }
            });
            return updatedSubscription;
        }
        return existingSubscription;
    }

    // Crear nueva suscripción
    const subscription = await prisma.pushSubscription.create({
        data: {
            userId,
            endpoint: data.endpoint,
            p256dh: data.keys.p256dh,
            auth: data.keys.auth,
            userAgent: data.userAgent
        }
    });

    return subscription;
};

/**
 * Obtener suscripciones de un usuario
 */
export const getUserSubscriptions = async (userId: string) => {
    const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
        orderBy: { subscribedAt: 'desc' }
    });

    return subscriptions;
};

/**
 * Desuscribirse (eliminar una suscripción específica)
 */
export const unsubscribePush = async (subscriptionId: string, userId: string, userRole: string) => {
    const subscription = await prisma.pushSubscription.findUnique({
        where: { id: subscriptionId }
    });

    if (!subscription) {
        const error = new Error('Suscripción no encontrada') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    // Usuario solo puede eliminar sus propias suscripciones (excepto ADMIN)
    if (userRole !== 'ADMIN' && subscription.userId !== userId) {
        const error = new Error('No tienes permiso para eliminar esta suscripción') as Error & { name: string };
        error.name = 'ForbiddenError';
        throw error;
    }

    await prisma.pushSubscription.delete({
        where: { id: subscriptionId }
    });

    return { success: true, message: 'Suscripción eliminada correctamente' };
};

/**
 * Desuscribir todas las suscripciones de un usuario
 */
export const unsubscribeAll = async (userId: string) => {
    const result = await prisma.pushSubscription.deleteMany({
        where: { userId }
    });

    return {
        success: true,
        message: 'Todas las suscripciones eliminadas',
        count: result.count
    };
};

/**
 * Enviar notificación push (solo ADMIN)
 */
export const sendNotification = async (data: SendNotificationInput) => {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        const error = new Error('VAPID keys no configuradas') as Error & { name: string };
        error.name = 'ConfigurationError';
        throw error;
    }

    // Obtener suscripciones de los usuarios destino
    const where: any = {};
    if (data.userIds && data.userIds.length > 0) {
        where.userId = { in: data.userIds };
    }

    const subscriptions = await prisma.pushSubscription.findMany({
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

    if (subscriptions.length === 0) {
        return {
            sent: 0,
            failed: 0,
            removed: 0,
            message: 'No hay suscripciones para los usuarios especificados'
        };
    }

    // Payload de la notificación
    const payload = JSON.stringify({
        title: data.title,
        body: data.body,
        data: data.data || {}
    });

    // Enviar notificación a cada suscripción
    let sent = 0;
    let failed = 0;
    let removed = 0;

    console.log(`📤 Intentando enviar notificación a ${subscriptions.length} suscripción(es)...`);

    for (const subscription of subscriptions) {
        try {
            const pushSubscription = {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth
                }
            };

            console.log(`📨 Enviando a ${subscription.user.email} (${subscription.user.name})...`);
            console.log(`   Endpoint: ${subscription.endpoint.substring(0, 50)}...`);

            const result = await webpush.sendNotification(pushSubscription, payload);
            console.log(`✅ Notificación enviada exitosamente a ${subscription.user.email}`, result.statusCode);
            sent++;
        } catch (error: any) {
            failed++;
            console.error(`❌ Error al enviar notificación a ${subscription.user.email}:`);
            console.error(`   Status: ${error.statusCode}`);
            console.error(`   Mensaje: ${error.message}`);
            console.error(`   Body: ${error.body}`);

            // Si el error es 410 (Gone), eliminar la suscripción porque expiró o es inválida
            if (error.statusCode === 410 || error.statusCode === 404) {
                try {
                    await prisma.pushSubscription.delete({
                        where: { id: subscription.id }
                    });
                    removed++;
                    console.log(`🗑️  Suscripción inválida eliminada para ${subscription.user.email}`);
                } catch (deleteError) {
                    console.error('Error al eliminar suscripción inválida:', deleteError);
                }
            }
        }
    }

    console.log(`📊 Resultado: ${sent} enviadas, ${failed} fallidas, ${removed} eliminadas`);

    return {
        sent,
        failed,
        removed,
        message: `Notificaciones enviadas: ${sent}, fallidas: ${failed}, suscripciones eliminadas: ${removed}`
    };
};
