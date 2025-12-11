import { Request, Response } from 'express';
import { registerUser, loginUser } from './auth.service.js';
import { createUserSchema, loginSchema } from './auth.schema.js';
import { prisma } from '../../config/prisma.js';
import { ZodError } from 'zod';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const validatedData = createUserSchema.parse(req.body);
        const result = await registerUser(validatedData);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: result
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
            if (error.name === 'ConflictError') {
                res.status(409).json({
                    success: false,
                    message: error.message
                });
                return;
            }
        }

        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const validatedData = loginSchema.parse(req.body);
        const result = await loginUser(validatedData);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: result
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
            if (error.name === 'UnauthorizedError') {
                res.status(401).json({
                    success: false,
                    message: error.message
                });
                return;
            }
        }

        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
