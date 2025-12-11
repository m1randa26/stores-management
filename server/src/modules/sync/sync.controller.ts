import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import {
    createSyncLogSchema,
    getSyncLogsQuerySchema,
    getSyncStatisticsQuerySchema
} from './sync.schema.js';
import {
    createSyncLog,
    getUserSyncLogs,
    getAllSyncLogs,
    getSyncLogById,
    getSyncStatistics
} from './sync.service.js';

/**
 * POST /api/sync
 * Crear un log de sincronización
 * Requiere: Autenticación
 */
export const createSyncLogController = async (req: Request, res: Response): Promise<void> => {
    try {
        const validatedData = createSyncLogSchema.parse(req.body);
        const syncLog = await createSyncLog(req.user!.userId, validatedData);

        res.status(201).json({
            success: true,
            message: 'Log de sincronización registrado',
            data: syncLog
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: error.issues
            });
            return;
        }

        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({ success: false, message: error.message });
                return;
            }
        }

        console.error('Error al crear log de sincronización:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/sync/my-logs
 * Obtener logs de sincronización del usuario autenticado
 * Requiere: Autenticación
 * Query params: ?entityType=&startDate=&endDate=
 */
export const getMyLogsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const filters = getSyncLogsQuerySchema.parse(req.query);
        const syncLogs = await getUserSyncLogs(req.user!.userId, filters);

        res.status(200).json({
            success: true,
            data: syncLogs
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Parámetros de búsqueda inválidos',
                errors: error.issues
            });
            return;
        }

        console.error('Error al obtener logs de sincronización:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/sync
 * Listar todos los logs de sincronización (solo ADMIN)
 * Requiere: Autenticación + ADMIN
 * Query params: ?userId=&entityType=&startDate=&endDate=
 */
export const getAllSyncLogsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const filters = getSyncLogsQuerySchema.parse(req.query);
        const syncLogs = await getAllSyncLogs(filters);

        res.status(200).json({
            success: true,
            data: syncLogs
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Parámetros de búsqueda inválidos',
                errors: error.issues
            });
            return;
        }

        console.error('Error al listar logs de sincronización:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/sync/statistics
 * Obtener estadísticas de sincronización
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver sus propias estadísticas
 * - ADMIN: puede ver estadísticas de cualquier usuario
 * Query params: ?userId=&startDate=&endDate=
 */
export const getSyncStatisticsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const filters = getSyncStatisticsQuerySchema.parse(req.query);
        const statistics = await getSyncStatistics(req.user!.userId, req.user!.role, filters);

        res.status(200).json({
            success: true,
            data: statistics
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                success: false,
                message: 'Parámetros de búsqueda inválidos',
                errors: error.issues
            });
            return;
        }

        console.error('Error al obtener estadísticas de sincronización:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/sync/:id
 * Obtener un log específico por ID
 * Requiere: Autenticación
 * - REPARTIDOR: solo puede ver sus propios logs
 * - ADMIN: puede ver cualquier log
 */
export const getSyncLogByIdController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const syncLog = await getSyncLogById(id, req.user!.userId, req.user!.role);

        res.status(200).json({
            success: true,
            data: syncLog
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                res.status(404).json({ success: false, message: error.message });
                return;
            }
            if (error.name === 'ForbiddenError') {
                res.status(403).json({ success: false, message: error.message });
                return;
            }
        }

        console.error('Error al obtener log de sincronización:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};
