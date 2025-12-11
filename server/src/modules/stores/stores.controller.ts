import { Request, Response } from 'express';
import { ZodError } from 'zod';
import {
    createStore,
    getAllStores,
    getStoreById,
    updateStore,
    toggleStoreStatus,
    getStoreByQR,
    assignUserToStore,
    unassignUserFromStore,
    getStoreAssignments,
    getMyAssignedStores
} from './stores.service.js';
import { createStoreSchema, updateStoreSchema, assignUserSchema } from './stores.schema.js';

export const createStoreController = async (req: Request, res: Response): Promise<void> => {
    try {
        const validatedData = createStoreSchema.parse(req.body);
        const store = await createStore(validatedData);

        res.status(201).json({
            success: true,
            message: 'Store created successfully',
            data: store
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

        console.error('Create store error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getStoresController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { isActive } = req.query;
        const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;

        const stores = await getAllStores(activeFilter);

        res.status(200).json({
            success: true,
            data: stores,
            total: stores.length
        });
    } catch (error) {
        console.error('Get stores error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getStoreByIdController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const store = await getStoreById(id);

        res.status(200).json({
            success: true,
            data: store
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Get store by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const updateStoreController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const validatedData = updateStoreSchema.parse(req.body);
        const store = await updateStore(id, validatedData);

        res.status(200).json({
            success: true,
            message: 'Store updated successfully',
            data: store
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

        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Update store error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const toggleStoreStatusController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const store = await toggleStoreStatus(id);

        res.status(200).json({
            success: true,
            message: `Store ${store.isActive ? 'activated' : 'deactivated'} successfully`,
            data: store
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Toggle store status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getStoreByQRController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { qrCode } = req.params;
        const store = await getStoreByQR(qrCode);

        res.status(200).json({
            success: true,
            data: store
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        if (error instanceof Error && error.name === 'ForbiddenError') {
            res.status(403).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Get store by QR error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const assignUserController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const validatedData = assignUserSchema.parse(req.body);
        const assignment = await assignUserToStore(id, validatedData.userId);

        res.status(201).json({
            success: true,
            message: 'User assigned to store successfully',
            data: assignment
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

            if (error.name === 'BadRequestError') {
                res.status(400).json({
                    success: false,
                    message: error.message
                });
                return;
            }
        }

        console.error('Assign user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const unassignUserController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id, userId } = req.params;
        const result = await unassignUserFromStore(id, userId);

        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Unassign user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getStoreAssignmentsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const assignments = await getStoreAssignments(id);

        res.status(200).json({
            success: true,
            data: assignments,
            total: assignments.length
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Get store assignments error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getMyStoresController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const stores = await getMyAssignedStores(req.user.userId);

        res.status(200).json({
            success: true,
            data: stores,
            total: stores.length
        });
    } catch (error) {
        console.error('Get my stores error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
