import { Request, Response } from 'express';
import { ZodError } from 'zod';
import {
    createOrder,
    getOrderById,
    getMyOrders,
    getAllOrders,
    getStoreOrders,
    updateOrderStatus,
    syncOfflineOrder,
    getOrderStatistics
} from './orders.service.js';
import { createOrderSchema, updateOrderStatusSchema, syncOrderSchema } from './orders.schema.js';

export const createOrderController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const validatedData = createOrderSchema.parse(req.body);
        const order = await createOrder(req.user.userId, validatedData);

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: order
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.issues.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
            return;
        }

        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({
                    success: false,
                    message: error.message
                });
                return;
            }

            if (error.name === 'ForbiddenError') {
                res.status(403).json({
                    success: false,
                    message: error.message
                });
                return;
            }

            if (error.name === 'ConflictError') {
                res.status(409).json({
                    success: false,
                    message: error.message
                });
                return;
            }
        }

        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getOrderByIdController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.role === 'REPARTIDOR' ? req.user.userId : undefined;

        const order = await getOrderById(id, userId);

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Get order by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getMyOrdersController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const { storeId, status, startDate, endDate } = req.query;

        const orders = await getMyOrders(req.user.userId, {
            storeId: typeof storeId === 'string' ? storeId : undefined,
            status: typeof status === 'string' ? status as any : undefined,
            startDate: typeof startDate === 'string' ? startDate : undefined,
            endDate: typeof endDate === 'string' ? endDate : undefined
        });

        res.status(200).json({
            success: true,
            data: orders,
            total: orders.length
        });
    } catch (error) {
        console.error('Get my orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getAllOrdersController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, storeId, status, startDate, endDate, synced } = req.query;

        const orders = await getAllOrders({
            userId: typeof userId === 'string' ? userId : undefined,
            storeId: typeof storeId === 'string' ? storeId : undefined,
            status: typeof status === 'string' ? status as any : undefined,
            startDate: typeof startDate === 'string' ? startDate : undefined,
            endDate: typeof endDate === 'string' ? endDate : undefined,
            synced: synced === 'true' ? true : synced === 'false' ? false : undefined
        });

        res.status(200).json({
            success: true,
            data: orders,
            total: orders.length
        });
    } catch (error) {
        console.error('Get all orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getStoreOrdersController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { storeId } = req.params;
        const { status, startDate, endDate } = req.query;

        const orders = await getStoreOrders(storeId, {
            status: typeof status === 'string' ? status as any : undefined,
            startDate: typeof startDate === 'string' ? startDate : undefined,
            endDate: typeof endDate === 'string' ? endDate : undefined
        });

        res.status(200).json({
            success: true,
            data: orders,
            total: orders.length
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Get store orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const updateOrderStatusController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const validatedData = updateOrderStatusSchema.parse(req.body);
        const userId = req.user?.role === 'REPARTIDOR' ? req.user.userId : undefined;

        const order = await updateOrderStatus(id, validatedData.status, userId);

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            data: order
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.issues.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
            return;
        }

        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({
                    success: false,
                    message: error.message
                });
                return;
            }

            if (error.name === 'ConflictError') {
                res.status(409).json({
                    success: false,
                    message: error.message
                });
                return;
            }
        }

        console.error('Update order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const syncOfflineOrderController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const validatedData = syncOrderSchema.parse(req.body);
        const order = await syncOfflineOrder(req.user.userId, validatedData);

        res.status(201).json({
            success: true,
            message: 'Order synced successfully',
            data: order
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.issues.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
            return;
        }

        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({
                    success: false,
                    message: error.message
                });
                return;
            }

            if (error.name === 'ForbiddenError') {
                res.status(403).json({
                    success: false,
                    message: error.message
                });
                return;
            }

            if (error.name === 'ConflictError') {
                res.status(409).json({
                    success: false,
                    message: error.message
                });
                return;
            }
        }

        console.error('Sync offline order error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getOrderStatisticsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, storeId, startDate, endDate } = req.query;

        const statistics = await getOrderStatistics(
            typeof userId === 'string' ? userId : undefined,
            typeof storeId === 'string' ? storeId : undefined,
            {
                startDate: typeof startDate === 'string' ? startDate : undefined,
                endDate: typeof endDate === 'string' ? endDate : undefined
            }
        );

        res.status(200).json({
            success: true,
            data: statistics
        });
    } catch (error) {
        console.error('Get order statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
