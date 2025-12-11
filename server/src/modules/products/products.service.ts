import { prisma } from '../../config/prisma.js';
import { CreateProductInput, UpdateProductInput } from './products.schema.js';

export const createProduct = async (data: CreateProductInput) => {
    const existingProduct = await prisma.product.findUnique({
        where: { sku: data.sku }
    });

    if (existingProduct) {
        const error = new Error('Product with this SKU already exists');
        error.name = 'ConflictError';
        throw error;
    }

    const product = await prisma.product.create({
        data: {
            sku: data.sku,
            name: data.name,
            description: data.description,
            price: data.price,
            imageUrl: data.imageUrl || null
        }
    });

    return product;
};

export const getAllProducts = async (isActive?: boolean, search?: string) => {
    const products = await prisma.product.findMany({
        where: {
            AND: [
                isActive !== undefined ? { isActive } : {},
                search ? {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { sku: { contains: search, mode: 'insensitive' } }
                    ]
                } : {}
            ]
        },
        include: {
            _count: {
                select: {
                    orderItems: true
                }
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    return products;
};

export const getProductById = async (id: string) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    orderItems: true
                }
            }
        }
    });

    if (!product) {
        const error = new Error('Product not found');
        error.name = 'NotFoundError';
        throw error;
    }

    return product;
};

export const getProductBySku = async (sku: string) => {
    const product = await prisma.product.findUnique({
        where: { sku: sku.toUpperCase() },
        select: {
            id: true,
            sku: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            isActive: true,
            createdAt: true
        }
    });

    if (!product) {
        const error = new Error('Product not found');
        error.name = 'NotFoundError';
        throw error;
    }

    if (!product.isActive) {
        const error = new Error('Product is not active');
        error.name = 'ForbiddenError';
        throw error;
    }

    return product;
};

export const updateProduct = async (id: string, data: UpdateProductInput) => {
    const productExists = await prisma.product.findUnique({
        where: { id }
    });

    if (!productExists) {
        const error = new Error('Product not found');
        error.name = 'NotFoundError';
        throw error;
    }

    const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
            name: data.name,
            description: data.description,
            price: data.price,
            imageUrl: data.imageUrl
        }
    });

    return updatedProduct;
};

export const toggleProductStatus = async (id: string) => {
    const product = await prisma.product.findUnique({
        where: { id }
    });

    if (!product) {
        const error = new Error('Product not found');
        error.name = 'NotFoundError';
        throw error;
    }

    const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
            isActive: !product.isActive
        }
    });

    return updatedProduct;
};

export const deleteProduct = async (id: string) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    orderItems: true
                }
            }
        }
    });

    if (!product) {
        const error = new Error('Product not found');
        error.name = 'NotFoundError';
        throw error;
    }

    if (product._count.orderItems > 0) {
        await prisma.product.update({
            where: { id },
            data: { isActive: false }
        });

        const error = new Error('Cannot delete product with existing orders. Product has been deactivated instead.');
        error.name = 'ConflictError';
        throw error;
    }

    await prisma.product.delete({
        where: { id }
    });

    return { message: 'Product deleted successfully' };
};

export const getActiveProducts = async () => {
    const products = await prisma.product.findMany({
        where: { isActive: true },
        select: {
            id: true,
            sku: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            isActive: true
        },
        orderBy: {
            name: 'asc'
        }
    });

    return products;
};
