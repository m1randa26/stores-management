# Plan de Gestión de Notificaciones Push

## 1. Objetivo del Módulo
Gestionar suscripciones a notificaciones push web para enviar notificaciones en tiempo real a los dispositivos de los usuarios. Permite al ADMIN enviar notificaciones a repartidores sobre nuevas asignaciones, cambios en tiendas, actualizaciones de productos, etc.

## 2. Modelo de Datos (Prisma)
```prisma
model PushSubscription {
  id           String   @id @default(uuid())
  userId       String
  endpoint     String   @unique
  p256dh       String   // Clave pública
  auth         String   // Secreto de autenticación
  userAgent    String?  // Información del navegador/dispositivo
  subscribedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

## 3. Arquitectura del Módulo

### 3.1 Capas
```
routes (push.routes.ts)
    ↓
controllers (push.controller.ts)
    ↓
services (push.service.ts)
    ↓
web-push library + Prisma Client
```

### 3.2 Validaciones (Zod)
- **subscribePushSchema**: Validar suscripción a notificaciones
  - endpoint: URL requerida
  - keys.p256dh: String requerido (clave pública)
  - keys.auth: String requerido (secreto)
  - userAgent: String opcional

- **sendNotificationSchema**: Validar envío de notificación (solo ADMIN)
  - title: String requerido (máx 100 caracteres)
  - body: String requerido (máx 500 caracteres)
  - userIds: Array de UUIDs opcional (si no se proporciona, envía a todos)
  - data: Object opcional (datos adicionales)

## 4. Dependencias

### 4.1 web-push
Librería para enviar notificaciones push usando el protocolo Web Push.

```bash
npm install web-push
npm install --save-dev @types/web-push
```

### 4.2 Configuración de VAPID Keys
Generar claves VAPID (Voluntary Application Server Identification):

```bash
npx web-push generate-vapid-keys
```

Agregar a `.env`:
```
VAPID_PUBLIC_KEY=BNxxxxx...
VAPID_PRIVATE_KEY=xxxxx...
VAPID_SUBJECT=mailto:admin@example.com
```

## 5. Servicios

### 5.1 subscribePush
Registra una nueva suscripción a notificaciones push.

**Validaciones:**
- Verificar que el usuario existe
- Verificar que el endpoint no esté ya registrado
- Si existe endpoint para otro usuario, actualizar userId

**Retorna:**
- Objeto PushSubscription creado

### 5.2 getUserSubscriptions
Obtiene todas las suscripciones de un usuario.

**Parámetros:**
- userId (string)

**Retorna:**
- Array de PushSubscriptions del usuario

### 5.3 unsubscribePush
Elimina una suscripción específica.

**Validaciones:**
- Verificar que la suscripción existe
- Verificar que pertenece al usuario (o es ADMIN)

**Retorna:**
- Confirmación de eliminación

### 5.4 unsubscribeAll
Elimina todas las suscripciones de un usuario.

**Parámetros:**
- userId (string)

**Retorna:**
- Número de suscripciones eliminadas

### 5.5 sendNotification
Envía una notificación push a uno o más usuarios (solo ADMIN).

**Parámetros:**
- title: Título de la notificación
- body: Contenido de la notificación
- userIds (opcional): Array de IDs de usuarios destino
- data (opcional): Datos adicionales

**Proceso:**
1. Obtener suscripciones de los usuarios destino
2. Para cada suscripción:
   - Enviar notificación usando web-push
   - Si falla (suscripción inválida/expirada), eliminar suscripción
3. Retornar estadísticas de envío

**Retorna:**
- Objeto con estadísticas:
  - sent: número de notificaciones enviadas
  - failed: número de fallos
  - removed: número de suscripciones eliminadas

### 5.6 getVapidPublicKey
Retorna la clave pública VAPID para que el frontend pueda suscribirse.

**Retorna:**
- String con la clave pública VAPID

## 6. Endpoints API

### 6.1 GET /api/push/vapid-public-key
Obtener la clave pública VAPID.

**Autenticación:** No requerida (clave pública)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "publicKey": "BNxxxxx..."
  }
}
```

### 6.2 POST /api/push/subscribe
Suscribirse a notificaciones push.

**Autenticación:** Requerida
**Rol:** Cualquiera
**Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BJxxxxx...",
    "auth": "xxxxx..."
  },
  "userAgent": "Mozilla/5.0..."
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "message": "Suscripción registrada correctamente",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "endpoint": "https://fcm.googleapis.com/...",
    "subscribedAt": "2024-01-15T10:30:00Z"
  }
}
```

### 6.3 GET /api/push/my-subscriptions
Obtener suscripciones del usuario autenticado.

**Autenticación:** Requerida
**Rol:** Cualquiera

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "endpoint": "https://fcm.googleapis.com/...",
      "userAgent": "Mozilla/5.0...",
      "subscribedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 6.4 DELETE /api/push/unsubscribe/:id
Eliminar una suscripción específica.

**Autenticación:** Requerida
**Rol:** Cualquiera (propietario) / ADMIN

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Suscripción eliminada correctamente"
}
```

### 6.5 DELETE /api/push/unsubscribe-all
Eliminar todas las suscripciones del usuario autenticado.

**Autenticación:** Requerida
**Rol:** Cualquiera

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Todas las suscripciones eliminadas",
  "data": {
    "count": 3
  }
}
```

### 6.6 POST /api/push/send
Enviar notificación push (solo ADMIN).

**Autenticación:** Requerida
**Rol:** ADMIN
**Body:**
```json
{
  "title": "Nueva asignación",
  "body": "Te han asignado a la tienda Oxxo Centro",
  "userIds": ["uuid1", "uuid2"],
  "data": {
    "type": "STORE_ASSIGNMENT",
    "storeId": "uuid",
    "url": "/stores/uuid"
  }
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Notificaciones enviadas",
  "data": {
    "sent": 5,
    "failed": 1,
    "removed": 1
  }
}
```

## 7. Flujo de Uso

### 7.1 Suscripción del Usuario
```
1. Frontend solicita GET /api/push/vapid-public-key
2. Frontend usa Service Worker para suscribirse con la clave pública
3. Frontend recibe subscription object del navegador
4. Frontend envía POST /api/push/subscribe con el subscription
5. Backend guarda la suscripción en la base de datos
```

### 7.2 Envío de Notificación (ADMIN)
```
1. ADMIN crea nueva asignación de tienda a repartidor
2. Backend llama internamente al servicio sendNotification
3. Backend obtiene suscripciones del repartidor
4. Backend envía notificación usando web-push
5. Repartidor recibe notificación en su dispositivo
```

### 7.3 Desuscripción
```
1. Usuario desactiva notificaciones en la app
2. Frontend llama DELETE /api/push/unsubscribe-all
3. Backend elimina todas las suscripciones del usuario
```

## 8. Seguridad

### 8.1 Control de Acceso
- **Cualquier usuario autenticado**:
  - Puede suscribirse a notificaciones
  - Solo puede ver sus propias suscripciones
  - Solo puede eliminar sus propias suscripciones

- **ADMIN**:
  - Puede enviar notificaciones a cualquier usuario
  - Puede eliminar cualquier suscripción

### 8.2 Validaciones
- Endpoint debe ser una URL válida
- Keys (p256dh y auth) son requeridos para suscripción
- Solo ADMIN puede enviar notificaciones
- Suscripciones inválidas/expiradas se eliminan automáticamente

### 8.3 VAPID Keys
- Clave pública: Puede ser compartida con el frontend
- Clave privada: NUNCA debe exponerse, solo en el servidor

## 9. Manejo de Errores

### Errores Específicos
- **400 Bad Request**: Datos de suscripción inválidos
- **401 Unauthorized**: Token no proporcionado o inválido
- **403 Forbidden**: Usuario no tiene permiso (solo ADMIN puede enviar)
- **404 Not Found**: Suscripción no encontrada
- **410 Gone**: Suscripción expirada (se elimina automáticamente)
- **500 Internal Server Error**: Error del servidor

### Manejo de Suscripciones Inválidas
Cuando se intenta enviar una notificación y falla con código 410 (Gone):
1. Eliminar la suscripción de la base de datos
2. Continuar con las demás suscripciones
3. Reportar la suscripción eliminada en las estadísticas

## 10. Casos de Uso

### 10.1 Notificación de Nueva Asignación
**Actor:** ADMIN
**Flujo:**
1. ADMIN asigna repartidor a una tienda
2. Backend automáticamente envía notificación al repartidor
3. Repartidor recibe notificación en tiempo real
4. Al hacer clic, abre la app en la sección de tiendas

### 10.2 Recordatorio de Visitas Pendientes
**Actor:** Sistema (Cron Job)
**Flujo:**
1. Job programado verifica visitas pendientes
2. Identifica repartidores con visitas del día
3. Envía recordatorio a cada repartidor
4. Repartidor recibe notificación con lista de tiendas

### 10.3 Actualización de Producto
**Actor:** ADMIN
**Flujo:**
1. ADMIN actualiza precio o disponibilidad de producto
2. Sistema identifica repartidores activos
3. Envía notificación sobre cambio de producto
4. Repartidores ven el cambio en su catálogo

## 11. Consideraciones Técnicas

### 11.1 Service Worker
El frontend necesita un Service Worker para:
- Manejar notificaciones en segundo plano
- Mostrar notificaciones cuando la app no está abierta
- Manejar clics en notificaciones

### 11.2 Permisos del Navegador
- Usuario debe otorgar permiso explícito para notificaciones
- Permisos pueden ser revocados en cualquier momento
- Frontend debe manejar el caso de permisos denegados

### 11.3 Compatibilidad
- Web Push funciona en Chrome, Firefox, Edge, Safari (iOS 16.4+)
- Requiere HTTPS (excepto localhost para desarrollo)
- Service Workers requieren HTTPS

### 11.4 Límites de Notificaciones
- Evitar spam: limitar frecuencia de notificaciones
- Agrupar notificaciones similares cuando sea posible
- Permitir al usuario configurar qué notificaciones recibir

### 11.5 Payload Size
- Límite típico: 4KB por notificación
- Mantener title y body concisos
- Usar data para información adicional (IDs, URLs)

## 12. Ejemplo de Integración Frontend

### 12.1 Solicitar Permiso y Suscribirse
```javascript
// Obtener clave pública VAPID
const response = await fetch('/api/push/vapid-public-key');
const { data } = await response.json();
const publicKey = data.publicKey;

// Solicitar permiso
const permission = await Notification.requestPermission();
if (permission !== 'granted') {
  console.log('Permiso de notificaciones denegado');
  return;
}

// Registrar Service Worker
const registration = await navigator.serviceWorker.register('/sw.js');

// Suscribirse
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(publicKey)
});

// Enviar suscripción al backend
await fetch('/api/push/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
      auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
    },
    userAgent: navigator.userAgent
  })
});
```

### 12.2 Service Worker (sw.js)
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();

  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/badge.png',
    data: data.data
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.openWindow(url)
  );
});
```
