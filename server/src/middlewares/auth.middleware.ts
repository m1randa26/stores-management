import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.BETTER_AUTH_SECRET || 'fallback-secret-key';

interface JwtPayload {
    userId: string;
    email: string;
    role: string;
}

export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        const tokenFromQuery = req.query.token as string | undefined;

        // Intentar obtener el token del header o del query param
        let token: string | null = null;

        if (authHeader) {
            token = authHeader.startsWith('Bearer ')
                ? authHeader.substring(7)
                : authHeader;
        } else if (tokenFromQuery) {
            token = tokenFromQuery;
        }

        if (!token) {
            res.status(401).json({
                success: false,
                message: 'No authorization token provided'
            });
            return;
        }

        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role
        };

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                success: false,
                message: 'Token expired'
            });
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
            return;
        }

        console.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const authorize = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
            return;
        }

        next();
    };
};
