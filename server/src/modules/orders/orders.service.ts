import { prisma } from '../../config/prisma.js';
import { CreateOrderInput, SyncOrderInput, OrderItemInput } from './orders.schema.js';
import { sendFcmNotification } from '../fcm/fcm.service.js';

type OrderStatus = 'PENDING' | 'SYNCED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ['SYNCED', 'PROCESSING', 'CANCELLED'],
    SYNCED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: []
};

export const calculateOrderTotal = (items: OrderItemInput[]): number => {
    const total = items.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
    }, 0);

    return Math.round(total * 100) / 100; // Redondear a 2 decimales
};

export const createOrder = async (userId: string, data: CreateOrderInput) => {
    // Verificar que la visita exista
    const visit = await prisma.visit.findUnique({
        where: { id: data.visitId },
        include: {
            order: true
        }
    });

    if (!visit) {
        const error = new Error('Visit not found');
        error.name = 'NotFoundError';
        throw error;
    }

    // Verificar que la visita pertenezca al usuario
    if (visit.userId !== userId) {
        const error = new Error('You cannot create an order for this visit');
        error.name = 'ForbiddenError';
        throw error;
    }

    // Verificar que la visita no tenga ya una orden
    if (visit.order) {
        const error = new Error('Visit already has an order');
        error.name = 'ConflictError';
        throw error;
    }

    // Verificar que todos los productos existan y estén activos
    const productIds = data.items.map(item => item.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } }
    });

    if (products.length !== productIds.length) {
        const error = new Error('One or more products not found');
        error.name = 'NotFoundError';
        throw error;
    }

    const inactiveProduct = products.find(p => !p.isActive);
    if (inactiveProduct) {
        const error = new Error(`Product '${inactiveProduct.name}' is not active`);
        error.name = 'ConflictError';
        throw error;
    }

    // Calcular total
    const total = calculateOrderTotal(data.items);

    // Crear orden e items en una transacción
    const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
            data: {
                visitId: data.visitId,
                storeId: visit.storeId,
                userId,
                total,
                offlineId: data.offlineId,
                status: 'PENDING'
            }
        });

        await tx.orderItem.createMany({
            data: data.items.map(item => ({
                orderId: newOrder.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice
            }))
        });

        return tx.order.findUnique({
            where: { id: newOrder.id },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                sku: true,
                                name: true,
                                imageUrl: true
                            }
                        }
                    }
                },
                store: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
                visit: {
                    select: {
                        id: true,
                        visitedAt: true
                    }
                }
            }
        });
    });

    // Notificar a administradores sobre nueva orden
    try {
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' }
        });

        if (admins.length > 0) {
            await sendFcmNotification({
                title: '📦 Nueva orden recibida',
                body: `Orden de $${order!.total} en ${order!.store.name}`,
                userIds: admins.map(admin => admin.id),
                data: {
                    type: 'new_order',
                    orderId: order!.id,
                    storeId: order!.storeId,
                    storeName: order!.store.name,
                    total: order!.total.toString()
                }
            });
            console.log(`✅ Notificación de nueva orden enviada a ${admins.length} administrador(es)`);
        }
    } catch (notificationError) {
        console.error('⚠️ Error al enviar notificación de nueva orden:', notificationError);
    }

    return order;
};

export const getOrderById = async (id: string, userId?: string) => {
    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            sku: true,
                            name: true,
                            description: true,
                            imageUrl: true
                        }
                    }
                }
            },
            store: {
                select: {
                    id: true,
                    name: true,
                    address: true
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
            visit: {
                select: {
                    id: true,
                    visitedAt: true,
                    latitude: true,
                    longitude: true
                }
            }
        }
    });

    if (!order) {
        const error = new Error('Order not found');
        error.name = 'NotFoundError';
        throw error;
    }

    // Si se proporciona userId, verificar que la orden pertenezca al usuario
    if (userId && order.userId !== userId) {
        const error = new Error('Order not found');
        error.name = 'NotFoundError';
        throw error;
    }

    return order;
};

export const getMyOrders = async (
    userId: string,
    filters?: {
        storeId?: string;
        status?: OrderStatus;
        startDate?: string;
        endDate?: string;
    }
) => {
    const orders = await prisma.order.findMany({
        where: {
            userId,
            ...(filters?.storeId && { storeId: filters.storeId }),
            ...(filters?.status && { status: filters.status }),
            ...(filters?.startDate || filters?.endDate
                ? {
                    createdAt: {
                        ...(filters?.startDate && { gte: new Date(filters.startDate) }),
                        ...(filters?.endDate && { lte: new Date(filters.endDate) })
                    }
                }
                : {})
        },
        include: {
            store: {
                select: {
                    id: true,
                    name: true,
                    address: true
                }
            },
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            sku: true,
                            name: true
                        }
                    }
                }
            },
            _count: {
                select: {
                    items: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return orders;
};

export const getAllOrders = async (filters?: {
    userId?: string;
    storeId?: string;
    status?: OrderStatus;
    startDate?: string;
    endDate?: string;
    synced?: boolean;
}) => {
    const orders = await prisma.order.findMany({
        where: {
            ...(filters?.userId && { userId: filters.userId }),
            ...(filters?.storeId && { storeId: filters.storeId }),
            ...(filters?.status && { status: filters.status }),
            ...(filters?.startDate || filters?.endDate
                ? {
                    createdAt: {
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
            _count: {
                select: {
                    items: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return orders;
};

export const getStoreOrders = async (
    storeId: string,
    filters?: {
        status?: OrderStatus;
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

    const orders = await prisma.order.findMany({
        where: {
            storeId,
            ...(filters?.status && { status: filters.status }),
            ...(filters?.startDate || filters?.endDate
                ? {
                    createdAt: {
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
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            sku: true,
                            name: true
                        }
                    }
                }
            },
            _count: {
                select: {
                    items: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return orders;
};

export const updateOrderStatus = async (id: string, status: OrderStatus, userId?: string) => {
    const order = await prisma.order.findUnique({
        where: { id }
    });

    if (!order) {
        const error = new Error('Order not found');
        error.name = 'NotFoundError';
        throw error;
    }

    // Si es REPARTIDOR, verificar que la orden le pertenezca
    if (userId && order.userId !== userId) {
        const error = new Error('Order not found');
        error.name = 'NotFoundError';
        throw error;
    }

    // Validar transición de estado
    const validTransitions = VALID_TRANSITIONS[order.status as OrderStatus];
    if (!validTransitions.includes(status)) {
        const error = new Error(`Cannot change status from ${order.status} to ${status}`);
        error.name = 'ConflictError';
        throw error;
    }

    const updatedOrder = await prisma.order.update({
        where: { id },
        data: { status }
    });

    return updatedOrder;
};

export const syncOfflineOrder = async (userId: string, data: SyncOrderInput) => {
    // Verificar que no exista orden con ese offlineId
    if (data.offlineId) {
        const existingOrder = await prisma.order.findUnique({
            where: { offlineId: data.offlineId }
        });

        if (existingOrder) {
            const error = new Error('Order with this offline ID already synced');
            error.name = 'ConflictError';
            throw error;
        }
    }

    // Verificar que la visita exista
    const visit = await prisma.visit.findUnique({
        where: { id: data.visitId },
        include: { order: true }
    });

    if (!visit) {
        const error = new Error('Visit not found');
        error.name = 'NotFoundError';
        throw error;
    }

    // Verificar que la visita pertenezca al usuario
    if (visit.userId !== userId) {
        const error = new Error('You cannot create an order for this visit');
        error.name = 'ForbiddenError';
        throw error;
    }

    // Verificar que la visita no tenga ya una orden
    if (visit.order) {
        const error = new Error('Visit already has an order');
        error.name = 'ConflictError';
        throw error;
    }

    // Verificar productos
    const productIds = data.items.map(item => item.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } }
    });

    if (products.length !== productIds.length) {
        const error = new Error('One or more products not found');
        error.name = 'NotFoundError';
        throw error;
    }

    // Calcular total
    const total = calculateOrderTotal(data.items);

    // Crear orden en transacción
    const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
            data: {
                visitId: data.visitId,
                storeId: visit.storeId,
                userId,
                total,
                status: 'SYNCED',
                createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                syncedAt: new Date(),
                offlineId: data.offlineId
            }
        });

        await tx.orderItem.createMany({
            data: data.items.map(item => ({
                orderId: newOrder.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice
            }))
        });

        return tx.order.findUnique({
            where: { id: newOrder.id },
            include: {
                items: {
                    include: {
                        product: true
                    }
                },
                store: true
            }
        });
    });

    return order;
};

export const getOrderStatistics = async (
    userId?: string,
    storeId?: string,
    filters?: {
        startDate?: string;
        endDate?: string;
    }
) => {
    const whereClause: any = {};
    if (userId) whereClause.userId = userId;
    if (storeId) whereClause.storeId = storeId;
    if (filters?.startDate || filters?.endDate) {
        whereClause.createdAt = {
            ...(filters?.startDate && { gte: new Date(filters.startDate) }),
            ...(filters?.endDate && { lte: new Date(filters.endDate) })
        };
    }

    const [totalOrders, ordersByStatus, totalSales, avgTicket] = await Promise.all([
        prisma.order.count({ where: whereClause }),
        prisma.order.groupBy({
            by: ['status'],
            where: whereClause,
            _count: true
        }),
        prisma.order.aggregate({
            where: whereClause,
            _sum: {
                total: true
            }
        }),
        prisma.order.aggregate({
            where: whereClause,
            _avg: {
                total: true
            }
        })
    ]);

    const statusCounts = ordersByStatus.reduce((acc, curr) => {
        acc[curr.status] = curr._count;
        return acc;
    }, {} as Record<string, number>);

    return {
        totalOrders,
        ordersByStatus: statusCounts,
        totalSales: totalSales._sum.total ? parseFloat(totalSales._sum.total.toString()) : 0,
        averageTicket: avgTicket._avg.total ? parseFloat(avgTicket._avg.total.toString()) : 0
    };
};
