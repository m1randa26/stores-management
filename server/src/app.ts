import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import storesRoutes from './modules/stores/stores.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import visitsRoutes from './modules/visits/visits.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import photosRoutes from './modules/photos/photos.routes.js';
import syncRoutes from './modules/sync/sync.routes.js';
import pushRoutes from './modules/push/push.routes.js';
import fcmRoutes from './modules/fcm/fcm.routes.js';

const app = express();

// Configuración CORS
app.use(cors({
    origin: true, // Permite el origen de la solicitud
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 horas
}));

app.use(express.json());

app.get('/', (_req, res) => {
    res.send('Hola!')
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/fcm', fcmRoutes);

export default app;