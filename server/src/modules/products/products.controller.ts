import { Request, Response } from 'express';
import { ZodError } from 'zod';
import {
    createProduct,
    getAllProducts,
    getProductById,
    getProductBySku,
    updateProduct,
    toggleProductStatus,
    deleteProduct,
    getActiveProducts
} from './products.service.js';
import { createProductSchema, updateProductSchema } from './products.schema.js';

export const createProductController = async (req: Request, res: Response): Promise<void> => {
    try {
        const validatedData = createProductSchema.parse(req.body);
        const product = await createProduct(validatedData);

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: product
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

        if (error instanceof Error && error.name === 'ConflictError') {
            res.status(409).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Create product error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getProductsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { isActive, search } = req.query;
        const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
        const searchTerm = typeof search === 'string' ? search : undefined;

        const products = await getAllProducts(activeFilter, searchTerm);

        res.status(200).json({
            success: true,
            data: products,
            total: products.length
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getProductByIdController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const product = await getProductById(id);

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Get product by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getProductBySkuController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sku } = req.params;
        const product = await getProductBySku(sku);

        res.status(200).json({
            success: true,
            data: product
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

        console.error('Get product by SKU error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const updateProductController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const validatedData = updateProductSchema.parse(req.body);
        const product = await updateProduct(id, validatedData);

        res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: product
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

        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const toggleProductStatusController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const product = await toggleProductStatus(id);

        res.status(200).json({
            success: true,
            message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
            data: product
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Toggle product status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const deleteProductController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = await deleteProduct(id);

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

        if (error instanceof Error && error.name === 'ConflictError') {
            res.status(409).json({
                success: false,
                message: error.message
            });
            return;
        }

        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getActiveProductsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const products = await getActiveProducts();

        res.status(200).json({
            success: true,
            data: products,
            total: products.length
        });
    } catch (error) {
        console.error('Get active products error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
