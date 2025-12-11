# Análisis Exhaustivo del Sistema de Abarrotes y Funcionalidad QR Mejorada

## 📋 Resumen Ejecutivo

Este documento presenta un análisis completo del sistema de gestión de abarrotes y la implementación de una nueva funcionalidad para el flujo de escaneo de códigos QR y registro de visitas.

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Stack Tecnológico Completo

#### Backend
- **Framework**: Express 5.2.1 + TypeScript 5.9.3
- **ORM**: Prisma 7.1.0
- **Base de Datos**: PostgreSQL
- **Autenticación**: JWT (jsonwebtoken 9.0.3)
- **Seguridad**: Bcrypt para contraseñas
- **Archivos**: Multer 2.0.2 para subida de fotos
- **Notificaciones**: 
  - Firebase Admin SDK 13.6.0 (FCM)
  - Web Push 3.6.7
- **Validación**: Zod 4.1.13

#### Frontend
- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.2.4
- **Router**: React Router DOM 7.10.1
- **Estilos**: TailwindCSS 4.1.17
- **QR**: qrcode.react 4.2.0
- **Offline**: Firebase 12.6.0 + IndexedDB (custom)
- **IDs únicos**: UUID 13.0.0

### Estructura Modular

```
📦 Sistema de Abarrotes
├── 🖥️ Backend (server/)
│   ├── auth/          → Registro, login, JWT
│   ├── users/         → Gestión de usuarios (ADMIN/REPARTIDOR)
│   ├── stores/        → CRUD tiendas, QR, asignaciones
│   ├── products/      → Catálogo de productos
│   ├── visits/        → Registro con geolocalización
│   ├── orders/        → Pedidos vinculados a visitas
│   ├── photos/        → Almacenamiento de fotos
│   ├── fcm/           → Tokens FCM
│   ├── push/          → Notificaciones push
│   └── sync/          → Sincronización offline
│
└── 💻 Frontend (client/)
    ├── components/    → Modales, Toast, Indicadores
    ├── pages/         → Dashboard, RepartidorDashboard, QR Views
    ├── services/      → API calls, offline DB, sync
    └── utils/         → Token storage, helpers

```

---

## 📊 MODELOS DE DATOS (Base de Datos)

### Modelo User
```prisma
User {
  id: String (cuid)
  email: String (unique)
  name: String
  password: String (hashed)
  role: ADMIN | REPARTIDOR
  
  // Relaciones
  assignedStores[]  → Tiendas asignadas
  visits[]          → Visitas realizadas
  orders[]          → Pedidos creados
  photos[]          → Fotos subidas
  fcmTokens[]       → Tokens para notificaciones
}
```

### Modelo Store
```prisma
Store {
  id: String (cuid)
  name: String
  address: String
  latitude: Float?
  longitude: Float?
  qrCode: String (unique UUID)
  isActive: Boolean
  
  // Relaciones
  assignments[]  → StoreAssignment
  visits[]       → Visitas recibidas
  orders[]       → Pedidos realizados
  photos[]       → Fotos capturadas
}
```

### Modelo StoreAssignment (Asignación de Repartidores)
```prisma
StoreAssignment {
  id: String (cuid)
  userId: String
  storeId: String
  assignedAt: DateTime
  
  @@unique([userId, storeId])  ← Previene duplicados
}
```

### Modelo Visit (Registro de Visitas)
```prisma
Visit {
  id: String (cuid)
  userId: String
  storeId: String
  latitude: Float         ← GPS del repartidor
  longitude: Float        ← GPS del repartidor
  accuracy: Float?        ← Precisión en metros
  visitedAt: DateTime
  syncedAt: DateTime?     ← Para sincronización offline
  offlineId: String?      ← UUID generado sin conexión
  
  // Relaciones
  user: User
  store: Store
  photos[]  → Fotos de la visita
  order?    → Pedido (relación 1:1)
}
```

### Modelo Order
```prisma
Order {
  id: String (cuid)
  visitId: String (unique)
  storeId: String
  userId: String
  status: PENDING | SYNCED | PROCESSING | COMPLETED | CANCELLED
  total: Decimal
  createdAt: DateTime
  syncedAt: DateTime?
  offlineId: String?
  
  // Relaciones
  visit: Visit (1:1)
  store: Store
  user: User
  items[]  → OrderItem
}
```

### Modelo Product
```prisma
Product {
  id: String (cuid)
  sku: String (unique)
  name: String
  description: String?
  price: Decimal
  imageUrl: String?
  isActive: Boolean
  
  orderItems[]  → OrderItem
}
```

### Modelo Photo
```prisma
Photo {
  id: String (cuid)
  visitId: String
  storeId: String
  userId: String
  filename: String
  filepath: String        ← Ruta en servidor
  mimetype: String
  size: Int
  description: String?
  uploadedAt: DateTime
  offlineId: String?
  
  // Relaciones
  visit: Visit
  store: Store
  user: User
}
```

---

## 🔄 ANÁLISIS DEL FLUJO ACTUAL (ANTES DE MODIFICACIONES)

### Flujo Original - Gestión de Tiendas

1. **Admin crea tienda**
   - POST `/api/stores`
   - Sistema genera `qrCode` único (UUID v4)
   - Ejemplo: `550e8400-e29b-41d4-a716-446655440000`

2. **Admin genera QR**
   - Modal en Dashboard Admin
   - Componente `QRModal.jsx` usa `qrcode.react`
   - URL generada: `http://localhost:5173/stores/qr/{qrCode}`

3. **Admin imprime QR**
   - Descarga imagen PNG del código QR
   - Coloca físicamente en la tienda

4. **Admin asigna repartidor**
   - POST `/api/stores/{storeId}/assign`
   - Crea registro en `StoreAssignment`
   - Validación: usuario debe tener rol REPARTIDOR

### Flujo Original - Registro de Visitas

#### Método 1: Desde Lista de Asignaciones (Usado actualmente)

1. Repartidor inicia sesión
2. Va a pestaña "Asignaciones de Tiendas"
3. Ve lista de tiendas asignadas
4. Presiona botón **"Registrar Visita"** directamente
5. Se abre `RegistrarVisitaModal`:
   - Obtiene ubicación GPS automáticamente
   - Muestra información de la tienda
   - Valida proximidad (< 100m)
   - Botón "Registrar Visita"
6. POST `/api/visits` con:
   ```json
   {
     "storeId": "xxx",
     "latitude": 19.4326,
     "longitude": -99.1332,
     "accuracy": 15.5
   }
   ```
7. Backend valida:
   - ✅ Tienda existe y está activa
   - ✅ Usuario está asignado a la tienda
   - ✅ Distancia < 100m (Haversine)
8. Se crea registro en tabla `Visit`
9. Notificación push a administradores

#### Método 2: Escaneo QR (Limitado)

1. Repartidor escanea QR físico
2. Abre URL: `/stores/qr/{qrCode}`
3. **PROBLEMA**: Solo muestra información
   - Nombre de la tienda
   - Dirección
   - Coordenadas
   - Botón "Ver en Google Maps"
   - **NO permite registrar visita**

---

## ✨ NUEVA FUNCIONALIDAD IMPLEMENTADA

### Objetivo
Integrar el escaneo de código QR con el registro de visitas en un flujo unificado.

### Flujo Mejorado: QR → Marcar como Visitada

#### Paso 1: Acceder a Lista de Tiendas Asignadas
- Repartidor inicia sesión
- Ve Dashboard con pestaña "Asignaciones"
- Lista muestra todas las tiendas asignadas

#### Paso 2: Escanear Código QR de una Tienda
- Repartidor escanea QR físico en la tienda
- URL generada: `/stores/scan/{qrCode}` (nueva ruta protegida)
- Si no está autenticado → Redirige a `/login`
- Si no es REPARTIDOR → Muestra error
- Si está autenticado → Muestra nueva vista `StoreQRScanView`

#### Paso 3: Vista de Escaneo con Información
La nueva vista muestra:
- ✅ Nombre de la tienda
- ✅ Dirección completa
- ✅ Coordenadas GPS (si existen)
- ✅ Estado (Activa/Inactiva)
- ✅ **Sección de ubicación del repartidor**:
  - Indicador de "Obteniendo ubicación..."
  - Coordenadas GPS capturadas
  - Precisión en metros
  - Botón para actualizar ubicación

#### Paso 4: Presionar Botón "Marcar como Visitada"
**Botón Verde Grande con Validaciones:**

```javascript
Estado del botón:
- Deshabilitado si:
  × No se ha obtenido ubicación
  × Error al obtener ubicación
  × Tienda no está activa
  × Está procesando registro
  
- Habilitado si:
  ✓ Ubicación GPS obtenida
  ✓ Tienda activa
  ✓ Precisión aceptable
```

#### Paso 5: Captura y Validación de Ubicación

**Proceso automático al abrir la vista:**

1. **Solicitud de Permisos**
   ```javascript
   navigator.geolocation.getCurrentPosition(
     successCallback,
     errorCallback,
     {
       enableHighAccuracy: true,
       timeout: 10000,
       maximumAge: 0
     }
   )
   ```

2. **Captura de Datos GPS**
   ```javascript
   {
     latitude: 19.432608,
     longitude: -99.133209,
     accuracy: 15.5  // metros
   }
   ```

3. **Validación de Proximidad (Frontend)**
   - Calcula distancia con fórmula Haversine
   - Radio máximo: 100 metros
   - Si distancia > 100m → Muestra error
   - Ejemplo: "Estás a 250 metros de la tienda. Debes estar a menos de 100 metros."

4. **Validación de Proximidad (Backend)**
   - Servicio `visits.service.ts` → `validateProximity()`
   - Calcula nuevamente la distancia
   - Rechaza con error 403 si > 100m

5. **Validación de Asignación**
   - Backend verifica tabla `StoreAssignment`
   - Rechaza con error 403 si el repartidor NO está asignado
   - Mensaje: "You are not assigned to this store"

6. **Registro de Visita**
   - POST `/api/visits`
   - Se crea registro en tabla `Visit`
   - Se envían notificaciones push a admins
   - Toast de éxito: "¡Visita a {tienda} registrada exitosamente!"
   - Redirige a Dashboard después de 2 segundos

---

## 🔐 SEGURIDAD Y VALIDACIONES

### Validaciones Frontend

1. **Autenticación**
   - Verifica token JWT en localStorage
   - Redirige a `/login` si no existe
   - Guarda `pendingQRCode` en sessionStorage

2. **Rol de Usuario**
   - Solo usuarios con rol REPARTIDOR pueden registrar
   - Admin redirige a `/dashboard`

3. **Geolocalización**
   - Manejo de errores de permisos
   - Timeout de 10 segundos
   - Precisión alta (enableHighAccuracy: true)

4. **Validación de Distancia**
   - Cálculo con fórmula Haversine
   - Alerta si > 100m antes de enviar

### Validaciones Backend

1. **Autenticación JWT**
   - Middleware `auth.middleware.ts`
   - Verifica token en header Authorization
   - Extrae userId del payload

2. **Existencia de Tienda**
   ```typescript
   const store = await prisma.store.findUnique({
     where: { id: storeId }
   })
   if (!store || !store.isActive) throw Error
   ```

3. **Verificación de Asignación**
   ```typescript
   const assignment = await prisma.storeAssignment.findUnique({
     where: {
       userId_storeId: { userId, storeId }
     }
   })
   if (!assignment) throw ForbiddenError
   ```

4. **Validación de Proximidad**
   ```typescript
   function haversineDistance(lat1, lon1, lat2, lon2) {
     // Fórmula Haversine
     return distanceInMeters
   }
   
   const distance = haversineDistance(...)
   if (distance > MAX_DISTANCE_METERS) {
     throw ProximityError
   }
   ```

5. **Prevención de Duplicados**
   - Campo `offlineId` único
   - Valida que no exista visita previa con mismo offlineId

---

## 🗺️ FÓRMULA DE HAVERSINE (Cálculo de Distancia GPS)

### Implementación

```javascript
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3 // Radio de la Tierra en metros
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c // Distancia en metros
}
```

### Uso
- **Frontend**: Validación previa antes de enviar
- **Backend**: Validación definitiva en servidor
- **Precisión**: ±10-50 metros dependiendo del GPS

---

## 🛣️ RUTAS Y ENDPOINTS

### Rutas Frontend (React Router)

```jsx
// Ruta pública - Solo muestra información
/stores/qr/:qrCode
  → Componente: StoreQRView.jsx
  → Propósito: Ver info de tienda (sin autenticación)
  → Botón: "Ver en Google Maps"

// Ruta protegida - Permite registrar visita
/stores/scan/:qrCode
  → Componente: StoreQRScanView.jsx (NUEVO)
  → Requiere: Autenticación + Rol REPARTIDOR
  → Propósito: Escanear y marcar como visitada
  → Botones: "Marcar como Visitada", "Ver en Mapa", "Volver"
```

### Endpoints Backend

```typescript
// Stores
GET    /api/stores/qr/:qrCode
  → Obtiene tienda por código QR
  → Público (pero requiere token)
  → Valida que esté activa

GET    /api/stores
  → Lista tiendas (con asignaciones)
  → Requiere: ADMIN o REPARTIDOR

POST   /api/stores
  → Crea tienda y genera QR
  → Requiere: ADMIN

POST   /api/stores/:id/assign
  → Asigna repartidor a tienda
  → Requiere: ADMIN

// Visits
POST   /api/visits
  → Registra nueva visita
  → Requiere: REPARTIDOR autenticado
  → Validaciones:
    - Tienda existe y activa
    - Usuario asignado
    - Proximidad < 100m

GET    /api/visits/my-visits
  → Lista visitas del repartidor
  → Filtros: startDate, endDate, hasOrder

POST   /api/visits/sync
  → Sincroniza visita offline
  → Valida offlineId único
```

---

## 📱 FUNCIONALIDAD OFFLINE

### Sistema de Sincronización

**Servicios Implementados:**
- `offlineDB.js`: IndexedDB para almacenamiento local
- `syncService.js`: Sincronización automática
- `networkService.js`: Detección de conexión

**Flujo Offline:**
1. Repartidor sin conexión registra visita
2. Se guarda en IndexedDB con `offlineId` único
3. Al recuperar conexión:
   - `syncService` detecta pendientes
   - POST `/api/visits/sync` con datos offline
   - Backend valida y registra
   - Frontend actualiza UI

**Prevención de Duplicados:**
- Campo `offlineId` (UUID) en tabla `Visit`
- Índice único en base de datos
- Backend rechaza si ya existe

---

## 🔔 NOTIFICACIONES PUSH

### Firebase Cloud Messaging (FCM)

**Implementación:**
```javascript
// Cliente registra token
POST /api/fcm/token
{
  "token": "fcm_token_xxx",
  "deviceInfo": "Mozilla/5.0..."
}

// Servidor envía notificación
await sendFcmNotification({
  title: '📍 Visita registrada',
  body: `Juan Pérez visitó Tienda La Esquina`,
  userIds: [adminIds...],
  data: {
    type: 'new_visit',
    visitId: 'xxx',
    storeName: 'Tienda La Esquina'
  }
})
```

**Eventos que Generan Notificaciones:**
- ✅ Nueva visita registrada → Notifica a ADMINs
- ✅ Nuevo pedido creado → Notifica a ADMINs
- ✅ Nueva foto subida → Notifica a ADMINs

---

## 🎨 COMPONENTES UI

### Componentes Principales

#### RepartidorDashboard.jsx
- **Pestañas**: Asignaciones, Visitas, Órdenes
- **AsignacionesTab**: Grid de tiendas con botón "Registrar Visita"
- **VisitasTab**: Historial con filtros y galería de fotos
- **OrdenesTab**: Lista de pedidos con detalles

#### StoreQRScanView.jsx (NUEVO)
- **Header**: Nombre y estado de tienda
- **Sección Info**: Dirección y coordenadas
- **Sección Ubicación**: 
  - Estado: "Obteniendo...", "Obtenida", "Error"
  - Datos GPS con precisión
  - Botón actualizar ubicación
- **Botón Principal**: "Marcar como Visitada"
  - Verde cuando está listo
  - Deshabilitado si falta ubicación o está lejos
- **Botones Secundarios**: "Ver en Mapa", "Volver"

#### RegistrarVisitaModal.jsx
- Modal para registro manual desde lista
- Obtiene ubicación automáticamente
- Validaciones de proximidad
- Botón "Registrar Visita"

#### QRModal.jsx
- Muestra código QR generado
- **URL actualizada**: `/stores/scan/{qrCode}`
- Botón descargar PNG
- Usado por Admin para imprimir

---

## 📊 DIAGRAMA DE FLUJO COMPLETO

```
┌─────────────────────────────────────────────────────────────┐
│                  FLUJO COMPLETO DEL SISTEMA                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  ADMIN LOGIN    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Crear Tienda    │────▶│ Genera QR (UUID) │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ Asignar         │     │ Imprimir QR      │
│ Repartidor      │     │ (QRModal)        │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│        TIENDA CON QR FÍSICO             │
│     /stores/scan/{qrCode}               │
└─────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│      REPARTIDOR ESCANEA QR              │
└────────┬────────────────────────────────┘
         │
         ├──── No autenticado? ───▶ Redirige a /login
         │
         ├──── No es REPARTIDOR? ──▶ Error
         │
         ▼
┌─────────────────────────────────────────┐
│     Vista StoreQRScanView               │
│  • Nombre tienda                        │
│  • Dirección                            │
│  • Coordenadas                          │
│  • Obtiene ubicación GPS automático     │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│   ¿Ubicación obtenida exitosamente?    │
└────────┬───────────────┬────────────────┘
         │               │
    ❌ Error        ✅ Éxito
         │               │
         │               ▼
         │      ┌─────────────────────┐
         │      │ Muestra coordenadas │
         │      │ Lat/Lng/Precisión   │
         │      └──────────┬──────────┘
         │                 │
         │                 ▼
         │      ┌─────────────────────┐
         │      │  Valida proximidad  │
         │      │    (< 100 metros)   │
         │      └──────────┬──────────┘
         │                 │
         │            ✅ Cerca
         │                 │
         │                 ▼
         │      ┌─────────────────────┐
         │      │ Botón "Marcar como  │
         │      │   Visitada" activo  │
         │      └──────────┬──────────┘
         │                 │
         │                 ▼
         │      ┌─────────────────────┐
         │      │ POST /api/visits    │
         │      └──────────┬──────────┘
         │                 │
         │                 ▼
         │      ┌─────────────────────┐
         │      │ Backend valida:     │
         │      │ • Tienda activa     │
         │      │ • Usuario asignado  │
         │      │ • Proximidad        │
         │      └──────────┬──────────┘
         │                 │
         │                 ▼
         │      ┌─────────────────────┐
         │      │ Crea registro Visit │
         │      │ en base de datos    │
         │      └──────────┬──────────┘
         │                 │
         │                 ▼
         │      ┌─────────────────────┐
         │      │ Notifica a Admins   │
         │      │ via FCM/Push        │
         │      └──────────┬──────────┘
         │                 │
         │                 ▼
         │      ┌─────────────────────┐
         │      │ Toast: "¡Visita     │
         │      │ registrada!"        │
         │      └──────────┬──────────┘
         │                 │
         │                 ▼
         │      ┌─────────────────────┐
         │      │ Redirige a          │
         │      │ /repartidor         │
         │      └─────────────────────┘
         │
         └──▶ Mostrar error y botón "Intentar nuevamente"
```

---

## 🚀 INSTRUCCIONES DE USO

### Para Administradores

1. **Crear Tienda**
   - Login como ADMIN
   - Dashboard → Pestaña "Tiendas"
   - Botón "Nueva Tienda"
   - Llenar formulario:
     * Nombre
     * Dirección
     * Latitud/Longitud (opcional pero recomendado)
   - Guardar → Sistema genera QR automáticamente

2. **Imprimir Código QR**
   - En lista de tiendas, botón "Ver QR"
   - Modal muestra código QR grande
   - Botón "Descargar" (genera PNG)
   - Imprimir y colocar en tienda física

3. **Asignar Repartidor**
   - En lista de tiendas, botón "Asignar Repartidor"
   - Seleccionar repartidor del dropdown
   - Confirmar → Se crea asignación

### Para Repartidores

**Método 1: Escanear QR (RECOMENDADO - NUEVO)**

1. **Preparación**
   - Asegúrate de estar logueado en la app
   - Habilita permisos de ubicación en tu navegador

2. **En la Tienda**
   - Escanea el código QR físico con tu teléfono
   - Se abre URL: `/stores/scan/{qrCode}`
   - La app detecta automáticamente tu ubicación

3. **Verificar Información**
   - Revisa nombre y dirección de la tienda
   - Espera a que aparezca: "✅ Ubicación obtenida"
   - Verifica que la precisión sea buena (< 50m)

4. **Registrar Visita**
   - Si estás a menos de 100m, el botón verde estará activo
   - Presiona "Marcar como Visitada"
   - Espera confirmación
   - Serás redirigido al Dashboard

5. **Si hay Error**
   - "Estás muy lejos": Acércate más a la tienda
   - "Error de ubicación": Habilita permisos GPS
   - "No asignado": Contacta al administrador

**Método 2: Desde Lista de Asignaciones (Tradicional)**

1. Login → Dashboard Repartidor
2. Pestaña "Asignaciones de Tiendas"
3. Busca la tienda que visitarás
4. Botón "Registrar Visita"
5. Modal se abre y obtiene ubicación
6. Botón "Registrar Visita"

---

## 🧪 CASOS DE PRUEBA

### Caso 1: Registro Exitoso
```
Precondiciones:
- Usuario logueado como REPARTIDOR
- Usuario asignado a la tienda
- GPS habilitado
- A menos de 100m de la tienda

Pasos:
1. Escanear QR
2. Esperar obtención de ubicación
3. Presionar "Marcar como Visitada"

Resultado Esperado:
✅ Toast de éxito
✅ Registro en BD
✅ Notificación a admins
✅ Redirige a dashboard
```

### Caso 2: Usuario No Asignado
```
Precondiciones:
- Usuario logueado como REPARTIDOR
- Usuario NO asignado a la tienda

Pasos:
1. Escanear QR
2. Obtener ubicación
3. Presionar "Marcar como Visitada"

Resultado Esperado:
❌ Error 403: "You are not assigned to this store"
❌ Toast de error
```

### Caso 3: Fuera de Rango
```
Precondiciones:
- Usuario logueado y asignado
- A más de 100m de la tienda

Pasos:
1. Escanear QR
2. Obtener ubicación
3. Presionar "Marcar como Visitada"

Resultado Esperado:
❌ Error frontend: "Estás a X metros..."
❌ Si llega al backend: Error 403 "Too far from store"
```

### Caso 4: Permisos GPS Denegados
```
Precondiciones:
- GPS deshabilitado en navegador

Pasos:
1. Escanear QR
2. Navegador no otorga permisos

Resultado Esperado:
❌ Mensaje: "Permiso de ubicación denegado..."
❌ Botón deshabilitado
❌ Link a instrucciones de permisos
```

---

## 🔧 CONFIGURACIÓN NECESARIA

### Variables de Entorno (Frontend)

```env
# client/.env
VITE_API_URL=http://localhost:8081
VITE_APP_URL=http://localhost:5173

# Firebase (para notificaciones)
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
VITE_FIREBASE_VAPID_KEY=xxx
```

### Variables de Entorno (Backend)

```env
# server/.env
PORT=8081
DATABASE_URL="postgresql://user:pass@localhost:5432/abarrotes_dev"

# JWT
BETTER_AUTH_SECRET=tu-secret-de-64-caracteres
BETTER_AUTH_URL=http://localhost:8081

# Firebase Admin (para enviar notificaciones)
# Archivo: server/firebase-adminsdk.json
```

### Permisos del Navegador

**Geolocalización:**
- Chrome: Configuración → Privacidad → Configuración de sitios → Ubicación
- Firefox: about:permissions
- Safari: Preferencias → Sitios web → Ubicación

**Notificaciones:**
- Permitir notificaciones push para recibir alertas
- Configuración → Notificaciones → Permitir para el sitio

---

## 📈 MEJORAS FUTURAS SUGERIDAS

### Corto Plazo
1. ✅ **Historial de escaneos QR**
   - Registrar cada escaneo (aunque no se marque como visitada)
   - Tabla `QRScan` con timestamp y resultado

2. ✅ **Caché de tiendas offline**
   - Guardar datos de tiendas en IndexedDB
   - Permitir consultar info sin conexión

3. ✅ **Notificaciones en tiempo real**
   - WebSocket para actualizaciones instantáneas
   - Admin ve visitas en tiempo real

### Mediano Plazo
4. ✅ **Analytics y reportes**
   - Dashboard con gráficas
   - Tiempos promedio de visita
   - Frecuencia por tienda

5. ✅ **Geofencing automático**
   - Detectar entrada/salida de zona
   - Recordatorio automático al llegar

6. ✅ **Ruta óptima**
   - Algoritmo para ordenar tiendas
   - Minimizar distancia recorrida

### Largo Plazo
7. ✅ **App nativa móvil**
   - React Native
   - Mejor manejo de GPS
   - Notificaciones nativas

8. ✅ **Machine Learning**
   - Predicción de demanda por tienda
   - Sugerencias de productos

---

## 📞 SOPORTE Y CONTACTO

**Desarrollador**: Jorge Isaac  
**Fecha de Documento**: Diciembre 10, 2025  
**Versión del Sistema**: 1.0.0

---

## 📝 CHANGELOG

### v1.0.0 (Diciembre 10, 2025)
- ✅ Implementación inicial del sistema completo
- ✅ Módulos: Auth, Stores, Visits, Orders, Products, Photos, FCM, Sync
- ✅ Nueva funcionalidad: QR → Marcar como Visitada
- ✅ Componente `StoreQRScanView.jsx`
- ✅ Validación de proximidad con Haversine
- ✅ Notificaciones push con FCM
- ✅ Soporte offline con IndexedDB
- ✅ Dashboard para Admin y Repartidor

---

## 🎯 RESUMEN EJECUTIVO DE CAMBIOS

### Problema Original
- Escanear QR solo mostraba información
- No había integración QR → Registro de visita
- Repartidores debían ir manualmente a la lista

### Solución Implementada
- Nueva ruta: `/stores/scan/:qrCode` (protegida)
- Componente `StoreQRScanView.jsx` con:
  - Obtención automática de GPS
  - Validación de proximidad
  - Botón "Marcar como Visitada"
- Validaciones en backend y frontend
- Flujo unificado: Escanear → Ver → Marcar

### Beneficios
- ✅ Proceso más rápido (menos clics)
- ✅ Menos errores (selección automática de tienda)
- ✅ Mejor UX (feedback visual de ubicación)
- ✅ Mayor seguridad (validación de proximidad)
- ✅ Trazabilidad completa (GPS + timestamp)

---

**FIN DEL DOCUMENTO**
