import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { CreateNewUserInput, LoginInput } from './auth.schema.js';
import { prisma } from '../../config/prisma.js';

const JWT_SECRET = process.env.BETTER_AUTH_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = '7d';

interface AuthResponse {
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        createdAt: Date;
    };
    token: string;
}

export const registerUser = async (data: CreateNewUserInput): Promise<AuthResponse> => {
    const userExists = await prisma.user.findUnique({
        where: { email: data.email },
    });

    if (userExists) {
        const error = new Error('USER_EMAIL_ALREADY_REGISTERED');
        error.name = 'ConflictError';
        throw error;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            role: data.role,
            password: hashedPassword
        }
    });

    const token = jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt
        },
        token
    };
};

export const loginUser = async (data: LoginInput): Promise<AuthResponse> => {
    const user = await prisma.user.findUnique({
        where: { email: data.email },
    });

    if (!user) {
        const error = new Error('INVALID_CREDENTIALS');
        error.name = 'UnauthorizedError';
        throw error;
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
        const error = new Error('INVALID_CREDENTIALS');
        error.name = 'UnauthorizedError';
        throw error;
    }

    const token = jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt
        },
        token
    };
};