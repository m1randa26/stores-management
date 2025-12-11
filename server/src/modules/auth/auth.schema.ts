import { z } from 'zod';

export const createUserSchema = z.object({
    email: z.email('Invalid email format')
        .toLowerCase()
        .trim(),
    name: z.string()
        .min(2, 'Short name')
        .max(100, 'Long name')
        .trim(),
    password: z.string()
        .min(8, 'Password must be contain 8 characters')
        .max(100, 'Long password')
        .regex(
            /^(?=.*[A-Z])(?=.*[0-9])(?=.*[#*!]).*$/,
            'Password must contain at least one uppercase letter, one number, and one special character (#, *, !)'
        ),
    role: z.enum(['ADMIN', 'REPARTIDOR'])

});

export const updateUserSchema = createUserSchema.partial();

export const loginSchema = z.object({
    email: z.email('Invalid email format')
        .toLowerCase()
        .trim(),
    password: z.string()
        .min(8, 'Password must be contain 8 characters')
        .max(100, 'Long password')
})


export type CreateNewUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;