# Proyecto Abarrotes - Backend API

API REST para sistema de gestión de abarrotes con funcionalidad offline-first para repartidores.

## 🚀 Tecnologías

- **Node.js** 18+
- **Express** 5.2.1
- **TypeScript** 5.9.3
- **Prisma** 7.1.0 (ORM)
- **PostgreSQL** (Base de datos)
- **JWT** (Autenticación)
- **Multer** (Subida de archivos)
- **Web Push** (Notificaciones)

## 📋 Requisitos Previos

- Node.js >= 18.0.0
- PostgreSQL instalado y corriendo
- npm o yarn

## 🛠️ Instalación Local

1. **Clonar el repositorio**
```bash
git clone <tu-repositorio>
cd server
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**

Crea un archivo `.env` en la raíz:

```env
PORT=8081
BETTER_AUTH_SECRET=tu-secret-de-64-caracteres-aleatorio
BETTER_AUTH_URL=http://localhost:8080
DATABASE_URL="postgresql://postgres:root@localhost:5432/abarrotes_dev?schema=public"
```

4. **Generar claves VAPID (para notificaciones push)**
```bash
npx web-push generate-vapid-keys
```

Agrega al `.env`:
```env
VAPID_PUBLIC_KEY=BN...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@tuapp.com
```

5. **Ejecutar migraciones de Prisma**
```bash
npx prisma migrate dev
```

6. **Generar Prisma Client**
```bash
npx prisma generate
```

7. **Compilar TypeScript**
```bash
npm run build
```

8. **Iniciar servidor**

Desarrollo:
```bash
npm run dev
```

Producción:
```bash
npm start
```

## 📁 Estructura del Proyecto

```
server/
├── src/
│   ├── modules/           # Módulos de la aplicación
│   │   ├── auth/         # Autenticación
│   │   ├── users/        # Usuarios
│   │   ├── stores/       # Tiendas
│   │   ├── products/     # Productos
│   │   ├── visits/       # Visitas
│   │   ├── orders/       # Pedidos
│   │   ├── photos/       # Fotos
│   │   ├── sync/         # Logs de sincronización
│   │   └── push/         # Notificaciones push
│   ├── middlewares/      # Middlewares (auth, etc.)
│   ├── config/           # Configuración (Prisma, etc.)
│   ├── types/            # Tipos TypeScript
│   ├── app.ts            # Configuración Express
│   └── server.ts         # Punto de entrada
├── prisma/
│   └── schema.prisma     # Schema de base de datos
├── uploads/              # Fotos subidas (local)
├── .env                  # Variables de entorno
├── package.json
└── tsconfig.json
```

## 🔌 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Perfil del usuario

### Tiendas
- `GET /api/stores` - Listar tiendas
- `POST /api/stores` - Crear tienda (ADMIN)
- `GET /api/stores/my-stores` - Tiendas asignadas (REPARTIDOR)
- `GET /api/stores/qr/:qrCode` - Obtener tienda por QR

### Productos
- `GET /api/products` - Listar productos
- `POST /api/products` - Crear producto (ADMIN)
- `GET /api/products/active` - Productos activos

### Visitas
- `POST /api/visits` - Crear visita
- `POST /api/visits/sync` - Sincronizar visita offline
- `GET /api/visits/my-visits` - Mis visitas

### Órdenes
- `POST /api/orders` - Crear orden
- `POST /api/orders/sync` - Sincronizar orden offline
- `GET /api/orders/my-orders` - Mis órdenes

### Fotos
- `POST /api/photos` - Subir foto
- `POST /api/photos/sync` - Sincronizar foto offline
- `GET /api/photos/visit/:visitId` - Fotos de una visita
- `GET /api/photos/:id/file` - Obtener archivo de imagen

### Sincronización
- `POST /api/sync` - Crear log de sync
- `GET /api/sync/my-logs` - Mis logs
- `GET /api/sync/statistics` - Estadísticas

### Push Notifications
- `GET /api/push/vapid-public-key` - Obtener clave pública
- `POST /api/push/subscribe` - Suscribirse
- `POST /api/push/send` - Enviar notificación (ADMIN)

## 🌐 Despliegue

### Railway (Recomendado)
Ver guía completa: [railway-deploy-guide.md](./railway-deploy-guide.md)

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login y deploy
railway login
railway init
railway up
```

### Render
Ver guía completa: [render-deploy-guide.md](./render-deploy-guide.md)

## 🔐 Roles de Usuario

- **ADMIN**: Gestión completa del sistema
- **REPARTIDOR**: Crear visitas, órdenes y fotos

## 📝 Sincronización Offline

El sistema soporta modo offline con sincronización automática:

1. Visitas se marcan con `offlineId` cuando no hay conexión
2. Órdenes y fotos se vinculan al `offlineId` de la visita
3. Al recuperar conexión, se sincronizan automáticamente:
   - Primero visitas → genera `serverId`
   - Luego órdenes → usa `serverId` de visita
   - Finalmente fotos → usa `serverId` de visita

Endpoints de sincronización:
- `POST /api/visits/sync`
- `POST /api/orders/sync`
- `POST /api/photos/sync`

## 🛡️ Seguridad

- JWT tokens con expiración
- Bcrypt para hash de contraseñas
- CORS configurado
- Validación con Zod
- Control de acceso basado en roles

## 📊 Base de Datos

Ejecutar migraciones:
```bash
npx prisma migrate dev
```

Ver base de datos:
```bash
npx prisma studio
```

Reset base de datos (desarrollo):
```bash
npx prisma migrate reset
```

## 🐛 Debug

Ver logs de Prisma:
```bash
# En .env
DATABASE_URL="postgresql://...?schema=public&connection_limit=10&pool_timeout=20"
```

## 📦 Scripts Disponibles

- `npm run dev` - Desarrollo con hot reload
- `npm run build` - Compilar TypeScript
- `npm start` - Iniciar en producción
- `npm run postinstall` - Generar Prisma Client (automático)

## 👥 Autores

- Jorge Isaac

## 📄 Licencia

ISC
