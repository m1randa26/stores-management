import { Request, Response } from 'express';
import { ZodError } from 'zod';
import {
    createVisit,
    getVisitById,
    getMyVisits,
    getAllVisits,
    getStoreVisits,
    syncOfflineVisit,
    getVisitStatistics
} from './visits.service.js';
import { createVisitSchema, syncVisitSchema } from './visits.schema.js';

export const createVisitController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const validatedData = createVisitSchema.parse(req.body);
        const visit = await createVisit(req.user.userId, validatedData);

        res.status(201).json({
            success: true,
            message: 'Visit registered successfully',
            data: visit
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

            if (error.name === 'ProximityError') {
                res.status(403).json({
                    success: false,
                    message: error.message,
                    distance: (error as any).distance,
                    maxDistance: (error as any).maxDistance
                });
                return;
            }
        }

        console.error('Create visit error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getVisitByIdController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.role === 'REPARTIDOR' ? req.user.userId : undefined;

        const visit = await getVisitById(id, userId);

        res.status(200).json({
            success: true,
            data: visit
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Get visit by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getMyVisitsController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const { storeId, startDate, endDate, hasOrder } = req.query;

        const visits = await getMyVisits(req.user.userId, {
            storeId: typeof storeId === 'string' ? storeId : undefined,
            startDate: typeof startDate === 'string' ? startDate : undefined,
            endDate: typeof endDate === 'string' ? endDate : undefined,
            hasOrder: hasOrder === 'true' ? true : hasOrder === 'false' ? false : undefined
        });

        res.status(200).json({
            success: true,
            data: visits,
            total: visits.length
        });
    } catch (error) {
        console.error('Get my visits error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getAllVisitsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, storeId, startDate, endDate, synced } = req.query;

        const visits = await getAllVisits({
            userId: typeof userId === 'string' ? userId : undefined,
            storeId: typeof storeId === 'string' ? storeId : undefined,
            startDate: typeof startDate === 'string' ? startDate : undefined,
            endDate: typeof endDate === 'string' ? endDate : undefined,
            synced: synced === 'true' ? true : synced === 'false' ? false : undefined
        });

        res.status(200).json({
            success: true,
            data: visits,
            total: visits.length
        });
    } catch (error) {
        console.error('Get all visits error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getStoreVisitsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { storeId } = req.params;
        const { startDate, endDate } = req.query;

        const visits = await getStoreVisits(storeId, {
            startDate: typeof startDate === 'string' ? startDate : undefined,
            endDate: typeof endDate === 'string' ? endDate : undefined
        });

        res.status(200).json({
            success: true,
            data: visits,
            total: visits.length
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Get store visits error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const syncOfflineVisitController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const validatedData = syncVisitSchema.parse(req.body);
        const visit = await syncOfflineVisit(req.user.userId, validatedData);

        res.status(201).json({
            success: true,
            message: 'Visit synced successfully',
            data: visit
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

        console.error('Sync offline visit error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getVisitStatisticsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, storeId } = req.query;

        const statistics = await getVisitStatistics(
            typeof userId === 'string' ? userId : undefined,
            typeof storeId === 'string' ? storeId : undefined
        );

        res.status(200).json({
            success: true,
            data: statistics
        });
    } catch (error) {
        console.error('Get visit statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
