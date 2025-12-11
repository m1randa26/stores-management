import { prisma } from '../../config/prisma.js';
import type { CreateSyncLogInput, GetSyncLogsQuery, GetSyncStatisticsQuery } from './sync.schema.js';

/**
 * Crear un log de sincronización
 */
export const createSyncLog = async (userId: string, data: CreateSyncLogInput) => {
    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        const error = new Error('Usuario no encontrado') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    // Crear el log de sincronización
    const syncLog = await prisma.syncLog.create({
        data: {
            userId,
            entityType: data.entityType,
            entityId: data.entityId,
            action: data.action,
            status: 'success',
            details: data.deviceInfo ? { deviceInfo: data.deviceInfo } : undefined
        },
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

    return syncLog;
};

/**
 * Obtener logs de sincronización de un usuario
 */
export const getUserSyncLogs = async (userId: string, filters: Omit<GetSyncLogsQuery, 'userId'>) => {
    const where: any = { userId };

    if (filters.entityType) {
        where.entityType = filters.entityType;
    }

    if (filters.startDate || filters.endDate) {
        where.syncedAt = {};
        if (filters.startDate) {
            where.syncedAt.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
            where.syncedAt.lte = new Date(filters.endDate);
        }
    }

    const syncLogs = await prisma.syncLog.findMany({
        where,
        orderBy: { syncedAt: 'desc' }
    });

    return syncLogs;
};

/**
 * Obtener todos los logs de sincronización (solo ADMIN)
 */
export const getAllSyncLogs = async (filters: GetSyncLogsQuery) => {
    const where: any = {};

    if (filters.userId) {
        where.userId = filters.userId;
    }

    if (filters.entityType) {
        where.entityType = filters.entityType;
    }

    if (filters.startDate || filters.endDate) {
        where.syncedAt = {};
        if (filters.startDate) {
            where.syncedAt.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
            where.syncedAt.lte = new Date(filters.endDate);
        }
    }

    const syncLogs = await prisma.syncLog.findMany({
        where,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        },
        orderBy: { syncedAt: 'desc' }
    });

    return syncLogs;
};

/**
 * Obtener un log específico por ID
 */
export const getSyncLogById = async (logId: string, userId: string, userRole: string) => {
    const syncLog = await prisma.syncLog.findUnique({
        where: { id: logId },
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

    if (!syncLog) {
        const error = new Error('Log de sincronización no encontrado') as Error & { name: string };
        error.name = 'NotFoundError';
        throw error;
    }

    // REPARTIDOR solo puede ver sus propios logs
    if (userRole !== 'ADMIN' && syncLog.userId !== userId) {
        const error = new Error('No tienes permiso para ver este log') as Error & { name: string };
        error.name = 'ForbiddenError';
        throw error;
    }

    return syncLog;
};

/**
 * Obtener estadísticas de sincronización
 */
export const getSyncStatistics = async (
    userId: string,
    userRole: string,
    filters: GetSyncStatisticsQuery
) => {
    const where: any = {};

    // REPARTIDOR solo puede ver sus propias estadísticas
    if (userRole !== 'ADMIN') {
        where.userId = userId;
    } else if (filters.userId) {
        where.userId = filters.userId;
    }

    if (filters.startDate || filters.endDate) {
        where.syncedAt = {};
        if (filters.startDate) {
            where.syncedAt.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
            where.syncedAt.lte = new Date(filters.endDate);
        }
    }

    // Total de sincronizaciones
    const totalSyncs = await prisma.syncLog.count({ where });

    // Sincronizaciones por tipo de entidad
    const byEntityType = await prisma.syncLog.groupBy({
        by: ['entityType'],
        where,
        _count: true
    });

    // Sincronizaciones por acción
    const byAction = await prisma.syncLog.groupBy({
        by: ['action'],
        where,
        _count: true
    });

    // Calcular promedio de sincronizaciones por día
    let avgSyncsPerDay = 0;
    if (totalSyncs > 0) {
        const firstSync = await prisma.syncLog.findFirst({
            where,
            orderBy: { syncedAt: 'asc' }
        });
        const lastSync = await prisma.syncLog.findFirst({
            where,
            orderBy: { syncedAt: 'desc' }
        });

        if (firstSync && lastSync) {
            const daysDiff = Math.ceil(
                (lastSync.syncedAt.getTime() - firstSync.syncedAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            avgSyncsPerDay = daysDiff > 0 ? totalSyncs / daysDiff : totalSyncs;
        }
    }

    return {
        totalSyncs,
        byEntityType: byEntityType.reduce((acc, item) => {
            acc[item.entityType] = item._count;
            return acc;
        }, {} as Record<string, number>),
        byAction: byAction.reduce((acc, item) => {
            acc[item.action] = item._count;
            return acc;
        }, {} as Record<string, number>),
        avgSyncsPerDay: Math.round(avgSyncsPerDay * 10) / 10
    };
};
