import { prisma } from '../../config/prisma.js';
import { CreateStoreInput, UpdateStoreInput } from './stores.schema.js';
import { randomUUID } from 'crypto';
import { sendFcmNotification } from '../fcm/fcm.service.js';

export const createStore = async (data: CreateStoreInput) => {
    const qrCode = randomUUID();

    const store = await prisma.store.create({
        data: {
            name: data.name,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            qrCode
        }
    });

    return store;
};

export const getAllStores = async (isActive?: boolean) => {
    const stores = await prisma.store.findMany({
        where: isActive !== undefined ? { isActive } : undefined,
        include: {
            assignments: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            },
            _count: {
                select: {
                    visits: true,
                    orders: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return stores;
};

export const getStoreById = async (id: string) => {
    const store = await prisma.store.findUnique({
        where: { id },
        include: {
            assignments: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                },
                orderBy: {
                    assignedAt: 'desc'
                }
            },
            _count: {
                select: {
                    visits: true,
                    orders: true
                }
            }
        }
    });

    if (!store) {
        const error = new Error('Store not found');
        error.name = 'NotFoundError';
        throw error;
    }

    return store;
};

export const updateStore = async (id: string, data: UpdateStoreInput) => {
    const storeExists = await prisma.store.findUnique({
        where: { id }
    });

    if (!storeExists) {
        const error = new Error('Store not found');
        error.name = 'NotFoundError';
        throw error;
    }

    const updatedStore = await prisma.store.update({
        where: { id },
        data: {
            name: data.name,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude
        }
    });

    return updatedStore;
};

export const toggleStoreStatus = async (id: string) => {
    const store = await prisma.store.findUnique({
        where: { id }
    });

    if (!store) {
        const error = new Error('Store not found');
        error.name = 'NotFoundError';
        throw error;
    }

    const updatedStore = await prisma.store.update({
        where: { id },
        data: {
            isActive: !store.isActive
        }
    });

    return updatedStore;
};

export const getStoreByQR = async (qrCode: string) => {
    const store = await prisma.store.findUnique({
        where: { qrCode },
        select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            isActive: true,
            createdAt: true
        }
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

    return store;
};

export const assignUserToStore = async (storeId: string, userId: string) => {
    const store = await prisma.store.findUnique({
        where: { id: storeId }
    });

    if (!store) {
        const error = new Error('Store not found');
        error.name = 'NotFoundError';
        throw error;
    }

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        const error = new Error('User not found');
        error.name = 'NotFoundError';
        throw error;
    }

    if (user.role !== 'REPARTIDOR') {
        const error = new Error('User must have REPARTIDOR role');
        error.name = 'BadRequestError';
        throw error;
    }

    const existingAssignment = await prisma.storeAssignment.findUnique({
        where: {
            userId_storeId: {
                userId,
                storeId
            }
        }
    });

    if (existingAssignment) {
        const error = new Error('User already assigned to this store');
        error.name = 'ConflictError';
        throw error;
    }

    const assignment = await prisma.storeAssignment.create({
        data: {
            userId,
            storeId
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true
                }
            },
            store: {
                select: {
                    id: true,
                    name: true,
                    address: true
                }
            }
        }
    });

    // Enviar notificación push al repartidor asignado
    try {
        await sendFcmNotification({
            title: '🏪 Nueva tienda asignada',
            body: `Te han asignado la tienda "${store.name}" en ${store.address}`,
            userIds: [userId],
            data: {
                type: 'STORE_ASSIGNMENT',
                storeId: store.id,
                storeName: store.name
            }
        });
        console.log(`✅ Notificación FCM enviada a ${user.name}`);
    } catch (error) {
        console.error('❌ Error al enviar notificación FCM:', error);
        // No lanzamos el error para no afectar la asignación
    }

    return assignment;
};

export const unassignUserFromStore = async (storeId: string, userId: string) => {
    const assignment = await prisma.storeAssignment.findUnique({
        where: {
            userId_storeId: {
                userId,
                storeId
            }
        }
    });

    if (!assignment) {
        const error = new Error('Assignment not found');
        error.name = 'NotFoundError';
        throw error;
    }

    await prisma.storeAssignment.delete({
        where: {
            userId_storeId: {
                userId,
                storeId
            }
        }
    });

    return { message: 'User unassigned successfully' };
};

export const getStoreAssignments = async (storeId: string) => {
    const store = await prisma.store.findUnique({
        where: { id: storeId }
    });

    if (!store) {
        const error = new Error('Store not found');
        error.name = 'NotFoundError';
        throw error;
    }

    const assignments = await prisma.storeAssignment.findMany({
        where: { storeId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true
                }
            }
        },
        orderBy: {
            assignedAt: 'desc'
        }
    });

    return assignments;
};

export const getMyAssignedStores = async (userId: string) => {
    const assignments = await prisma.storeAssignment.findMany({
        where: { userId },
        include: {
            store: {
                include: {
                    _count: {
                        select: {
                            visits: true,
                            orders: true
                        }
                    }
                }
            }
        },
        orderBy: {
            assignedAt: 'desc'
        }
    });

    const stores = assignments.map(assignment => ({
        ...assignment.store,
        assignedAt: assignment.assignedAt
    }));

    return stores;
};
