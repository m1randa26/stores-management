import { prisma } from '../../config/prisma.js';
import { CreateVisitInput, SyncVisitInput } from './visits.schema.js';
import { sendFcmNotification } from '../fcm/fcm.service.js';

const MAX_DISTANCE_METERS = 100; // Radio máximo en metros

// Función para calcular distancia usando fórmula Haversine
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
}

export const validateProximity = (
    visitLat: number,
    visitLon: number,
    storeLat: number | null,
    storeLon: number | null
): { isValid: boolean; distance: number | null } => {
    if (storeLat === null || storeLon === null) {
        // Si la tienda no tiene coordenadas, permitir la visita
        return { isValid: true, distance: null };
    }

    const distance = haversineDistance(visitLat, visitLon, storeLat, storeLon);

    return {
        isValid: distance <= MAX_DISTANCE_METERS,
        distance: Math.round(distance * 10) / 10 // Redondear a 1 decimal
    };
};

export const createVisit = async (userId: string, data: CreateVisitInput) => {
    // Verificar que la tienda exista y esté activa
    const store = await prisma.store.findUnique({
        where: { id: data.storeId }
    });

    if (!store) {
        const error = new Error('Store not found');
        error.name = 'NotFoundError';
        throw error;
    }

    if (!store.isActive) {
        const error = new Error('Store is not active');
        error.name = 'ForbiddenError';
        throw error;
    }

    // Verificar que el usuario esté asignado a la tienda
    const assignment = await prisma.storeAssignment.findUnique({
        where: {
            userId_storeId: {
                userId,
                storeId: data.storeId
            }
        }
    });

    if (!assignment) {
        const error = new Error('You are not assigned to this store');
        error.name = 'ForbiddenError';
        throw error;
    }

    // Validar proximidad (opcional)
    const proximity = validateProximity(
        data.latitude,
        data.longitude,
        store.latitude,
        store.longitude
    );

    if (!proximity.isValid && proximity.distance !== null) {
        const error = new Error('You are too far from the store');
        error.name = 'ProximityError';
        (error as any).distance = proximity.distance;
        (error as any).maxDistance = MAX_DISTANCE_METERS;
        throw error;
    }

    // Crear la visita
    const visit = await prisma.visit.create({
        data: {
            userId,
            storeId: data.storeId,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            offlineId: data.offlineId
        },
        include: {
            store: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    latitude: true,
                    longitude: true
                }
            },
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        }
    });

    // Notificar a administradores sobre nueva visita
    try {
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' }
        });

        if (admins.length > 0) {
            await sendFcmNotification({
                title: '📍 Visita registrada',
                body: `${visit.user.name} visitó ${visit.store.name}`,
                userIds: admins.map(admin => admin.id),
                data: {
                    type: 'new_visit',
                    visitId: visit.id,
                    storeId: visit.storeId,
                    storeName: visit.store.name,
                    userName: visit.user.name
                }
            });
            console.log(`✅ Notificación de nueva visita enviada a ${admins.length} administrador(es)`);
        }
    } catch (notificationError) {
        console.error('⚠️ Error al enviar notificación de nueva visita:', notificationError);
    }

    return visit;
};

export const getVisitById = async (id: string, userId?: string) => {
    const visit = await prisma.visit.findUnique({
        where: { id },
        include: {
            store: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    latitude: true,
                    longitude: true
                }
            },
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true
                }
            },
            photos: true,
            order: {
                include: {
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            }
        }
    });

    if (!visit) {
        const error = new Error('Visit not found');
        error.name = 'NotFoundError';
        throw error;
    }

    // Si se proporciona userId, verificar que la visita pertenezca al usuario
    if (userId && visit.userId !== userId) {
        const error = new Error('Visit not found');
        error.name = 'NotFoundError';
        throw error;
    }

    return visit;
};

export const getMyVisits = async (
    userId: string,
    filters?: {
        storeId?: string;
        startDate?: string;
        endDate?: string;
        hasOrder?: boolean;
    }
) => {
    const visits = await prisma.visit.findMany({
        where: {
            userId,
            ...(filters?.storeId && { storeId: filters.storeId }),
            ...(filters?.startDate || filters?.endDate
                ? {
                    visitedAt: {
                        ...(filters?.startDate && { gte: new Date(filters.startDate) }),
                        ...(filters?.endDate && { lte: new Date(filters.endDate) })
                    }
                }
                : {}),
            ...(filters?.hasOrder !== undefined && {
                order: filters.hasOrder ? { isNot: null } : { is: null }
            })
        },
        include: {
            store: {
                select: {
                    id: true,
                    name: true,
                    address: true
                }
            },
            order: {
                select: {
                    id: true,
                    total: true,
                    status: true
                }
            },
            _count: {
                select: {
                    photos: true
                }
            }
        },
        orderBy: {
            visitedAt: 'desc'
        }
    });

    return visits;
};

export const getAllVisits = async (filters?: {
    userId?: string;
    storeId?: string;
    startDate?: string;
    endDate?: string;
    synced?: boolean;
}) => {
    const visits = await prisma.visit.findMany({
        where: {
            ...(filters?.userId && { userId: filters.userId }),
            ...(filters?.storeId && { storeId: filters.storeId }),
            ...(filters?.startDate || filters?.endDate
                ? {
                    visitedAt: {
                        ...(filters?.startDate && { gte: new Date(filters.startDate) }),
                        ...(filters?.endDate && { lte: new Date(filters.endDate) })
                    }
                }
                : {}),
            ...(filters?.synced !== undefined && {
                syncedAt: filters.synced ? { not: null } : null
            })
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            },
            store: {
                select: {
                    id: true,
                    name: true,
                    address: true
                }
            },
            order: {
                select: {
                    id: true,
                    total: true,
                    status: true
                }
            },
            _count: {
                select: {
                    photos: true
                }
            }
        },
        orderBy: {
            visitedAt: 'desc'
        }
    });

    return visits;
};

export const getStoreVisits = async (
    storeId: string,
    filters?: {
        startDate?: string;
        endDate?: string;
    }
) => {
    const store = await prisma.store.findUnique({
        where: { id: storeId }
    });

    if (!store) {
        const error = new Error('Store not found');
        error.name = 'NotFoundError';
        throw error;
    }

    const visits = await prisma.visit.findMany({
        where: {
            storeId,
            ...(filters?.startDate || filters?.endDate
                ? {
                    visitedAt: {
                        ...(filters?.startDate && { gte: new Date(filters.startDate) }),
                        ...(filters?.endDate && { lte: new Date(filters.endDate) })
                    }
                }
                : {})
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            },
            order: {
                select: {
                    id: true,
                    total: true,
                    status: true
                }
            },
            _count: {
                select: {
                    photos: true
                }
            }
        },
        orderBy: {
            visitedAt: 'desc'
        }
    });

    return visits;
};

export const syncOfflineVisit = async (userId: string, data: SyncVisitInput) => {
    // Verificar si ya existe una visita con este offlineId
    if (data.offlineId) {
        const existingVisit = await prisma.visit.findUnique({
            where: { offlineId: data.offlineId }
        });

        if (existingVisit) {
            const error = new Error('Visit with this offline ID already synced');
            error.name = 'ConflictError';
            throw error;
        }
    }

    // Verificar que la tienda exista y esté activa
    const store = await prisma.store.findUnique({
        where: { id: data.storeId }
    });

    if (!store) {
        const error = new Error('Store not found');
        error.name = 'NotFoundError';
        throw error;
    }

    // Verificar asignación
    const assignment = await prisma.storeAssignment.findUnique({
        where: {
            userId_storeId: {
                userId,
                storeId: data.storeId
            }
        }
    });

    if (!assignment) {
        const error = new Error('You are not assigned to this store');
        error.name = 'ForbiddenError';
        throw error;
    }

    // Crear la visita con fecha de sincronización
    const visit = await prisma.visit.create({
        data: {
            userId,
            storeId: data.storeId,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            visitedAt: data.visitedAt ? new Date(data.visitedAt) : new Date(),
            syncedAt: new Date(),
            offlineId: data.offlineId
        },
        include: {
            store: {
                select: {
                    id: true,
                    name: true,
                    address: true
                }
            }
        }
    });

    return visit;
};

export const getVisitStatistics = async (userId?: string, storeId?: string) => {
    const whereClause: any = {};
    if (userId) whereClause.userId = userId;
    if (storeId) whereClause.storeId = storeId;

    const [totalVisits, visitsWithOrders, avgAccuracy] = await Promise.all([
        prisma.visit.count({ where: whereClause }),
        prisma.visit.count({
            where: {
                ...whereClause,
                order: { isNot: null }
            }
        }),
        prisma.visit.aggregate({
            where: {
                ...whereClause,
                accuracy: { not: null }
            },
            _avg: {
                accuracy: true
            }
        })
    ]);

    return {
        totalVisits,
        visitsWithOrders,
        visitsWithoutOrders: totalVisits - visitsWithOrders,
        averageAccuracy: avgAccuracy._avg.accuracy
            ? Math.round(avgAccuracy._avg.accuracy * 10) / 10
            : null,
        orderConversionRate: totalVisits > 0
            ? Math.round((visitsWithOrders / totalVisits) * 100 * 10) / 10
            : 0
    };
};
