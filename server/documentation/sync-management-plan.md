# Plan de Gestión de Sincronización (SyncLog)

## 1. Objetivo del Módulo
Registrar y gestionar logs de sincronización para el modo offline de la aplicación. Permite a los repartidores trabajar sin conexión y sincronizar datos cuando recuperen conectividad, manteniendo un historial de todas las operaciones de sincronización.

## 2. Modelo de Datos (Prisma)
```prisma
model SyncLog {
  id          String   @id @default(uuid())
  userId      String
  entityType  String   // "VISIT", "ORDER", "PHOTO"
  entityId    String   // ID del registro sincronizado
  offlineId   String?  // UUID generado offline
  action      String   // "CREATE", "UPDATE"
  syncedAt    DateTime @default(now())
  deviceInfo  String?  // Información del dispositivo

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([entityType])
  @@index([syncedAt])
}
```

## 3. Arquitectura del Módulo

### 3.1 Capas
```
routes (sync.routes.ts)
    ↓
controllers (sync.controller.ts)
    ↓
services (sync.service.ts)
    ↓
Prisma Client
```

### 3.2 Validaciones (Zod)
- **createSyncLogSchema**: Validar datos para crear un log de sincronización
  - userId: UUID requerido
  - entityType: Enum ("VISIT", "ORDER", "PHOTO")
  - entityId: UUID requerido
  - offlineId: UUID opcional
  - action: Enum ("CREATE", "UPDATE")
  - deviceInfo: String opcional (máx 500 caracteres)

- **getSyncLogsQuerySchema**: Filtros para consultar logs
  - userId: UUID opcional
  - entityType: String opcional
  - startDate: DateTime opcional
  - endDate: DateTime opcional

## 4. Servicios

### 4.1 createSyncLog
Registra un nuevo log de sincronización.

**Validaciones:**
- Verificar que el usuario existe
- Validar que el entityType es válido
- Validar que el action es válido

**Retorna:**
- Objeto SyncLog creado

### 4.2 getUserSyncLogs
Obtiene todos los logs de sincronización de un usuario.

**Parámetros:**
- userId (string)
- filters (opcional): entityType, startDate, endDate

**Retorna:**
- Array de SyncLogs ordenados por fecha descendente

### 4.3 getAllSyncLogs
Lista todos los logs de sincronización (solo ADMIN).

**Parámetros:**
- filters (opcional): userId, entityType, startDate, endDate

**Retorna:**
- Array de SyncLogs con información del usuario

### 4.4 getSyncLogById
Obtiene un log específico por ID.

**Validaciones:**
- Verificar que el log existe
- REPARTIDOR solo puede ver sus propios logs
- ADMIN puede ver cualquier log

**Retorna:**
- Objeto SyncLog con relaciones

### 4.5 getSyncStatistics
Obtiene estadísticas de sincronización.

**Parámetros:**
- userId (opcional, solo ADMIN puede filtrar por otros usuarios)
- startDate, endDate (opcional)

**Retorna:**
- Estadísticas:
  - Total de sincronizaciones
  - Sincronizaciones por tipo de entidad
  - Sincronizaciones por acción
  - Promedio de sincronizaciones por día

## 5. Endpoints API

### 5.1 POST /api/sync
Registrar un log de sincronización.

**Autenticación:** Requerida
**Rol:** Cualquiera
**Body:**
```json
{
  "entityType": "VISIT",
  "entityId": "uuid",
  "offlineId": "uuid",
  "action": "CREATE",
  "deviceInfo": "iPhone 12, iOS 15.0"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "message": "Log de sincronización registrado",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "entityType": "VISIT",
    "entityId": "uuid",
    "offlineId": "uuid",
    "action": "CREATE",
    "syncedAt": "2024-01-15T10:30:00Z",
    "deviceInfo": "iPhone 12, iOS 15.0"
  }
}
```

### 5.2 GET /api/sync/my-logs
Obtener logs de sincronización del usuario autenticado.

**Autenticación:** Requerida
**Rol:** Cualquiera
**Query Params:**
- entityType (opcional): "VISIT" | "ORDER" | "PHOTO"
- startDate (opcional): ISO 8601
- endDate (opcional): ISO 8601

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "entityType": "VISIT",
      "entityId": "uuid",
      "offlineId": "uuid",
      "action": "CREATE",
      "syncedAt": "2024-01-15T10:30:00Z",
      "deviceInfo": "iPhone 12, iOS 15.0"
    }
  ]
}
```

### 5.3 GET /api/sync
Listar todos los logs de sincronización (solo ADMIN).

**Autenticación:** Requerida
**Rol:** ADMIN
**Query Params:**
- userId (opcional): UUID
- entityType (opcional): "VISIT" | "ORDER" | "PHOTO"
- startDate (opcional): ISO 8601
- endDate (opcional): ISO 8601

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "entityType": "ORDER",
      "entityId": "uuid",
      "offlineId": "uuid",
      "action": "CREATE",
      "syncedAt": "2024-01-15T11:00:00Z",
      "deviceInfo": "Android 12",
      "user": {
        "id": "uuid",
        "name": "Juan Pérez",
        "email": "juan@example.com"
      }
    }
  ]
}
```

### 5.4 GET /api/sync/statistics
Obtener estadísticas de sincronización.

**Autenticación:** Requerida
**Rol:** Cualquiera (REPARTIDOR ve solo sus stats, ADMIN puede filtrar por usuario)
**Query Params:**
- userId (opcional, solo ADMIN): UUID
- startDate (opcional): ISO 8601
- endDate (opcional): ISO 8601

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "totalSyncs": 150,
    "byEntityType": {
      "VISIT": 50,
      "ORDER": 70,
      "PHOTO": 30
    },
    "byAction": {
      "CREATE": 140,
      "UPDATE": 10
    },
    "avgSyncsPerDay": 12.5
  }
}
```

### 5.5 GET /api/sync/:id
Obtener un log específico por ID.

**Autenticación:** Requerida
**Rol:** REPARTIDOR (solo propios logs) / ADMIN (cualquier log)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "entityType": "VISIT",
    "entityId": "uuid",
    "offlineId": "uuid",
    "action": "CREATE",
    "syncedAt": "2024-01-15T10:30:00Z",
    "deviceInfo": "iPhone 12, iOS 15.0",
    "user": {
      "id": "uuid",
      "name": "Juan Pérez",
      "email": "juan@example.com"
    }
  }
}
```

## 6. Flujo de Uso

### 6.1 Sincronización de Visita Offline
```
1. Repartidor crea visita en modo offline con offlineId
2. Al recuperar conexión, frontend llama POST /api/visits/sync
3. Backend crea la visita y automáticamente registra SyncLog
4. Frontend puede consultar GET /api/sync/my-logs para ver historial
```

### 6.2 Consulta de Historial
```
1. Repartidor consulta GET /api/sync/my-logs?entityType=ORDER
2. Backend retorna todos los logs de órdenes sincronizadas
3. Frontend muestra historial de sincronizaciones
```

### 6.3 Monitoreo de ADMIN
```
1. ADMIN consulta GET /api/sync?userId=xxx&startDate=2024-01-01
2. Backend retorna logs filtrados
3. ADMIN consulta GET /api/sync/statistics para ver métricas
4. Frontend muestra dashboard de sincronizaciones
```

## 7. Seguridad

### 7.1 Control de Acceso
- **REPARTIDOR**:
  - Puede crear logs de sincronización
  - Solo puede ver sus propios logs
  - Solo puede ver sus propias estadísticas

- **ADMIN**:
  - Puede ver todos los logs
  - Puede filtrar por cualquier usuario
  - Puede ver estadísticas globales

### 7.2 Validaciones
- userId debe corresponder al usuario autenticado (excepto ADMIN)
- entityType debe ser uno de los valores permitidos
- action debe ser "CREATE" o "UPDATE"
- Fechas deben estar en formato ISO 8601 válido

## 8. Manejo de Errores

### Errores Específicos
- **400 Bad Request**: Datos de entrada inválidos
- **401 Unauthorized**: Token no proporcionado o inválido
- **403 Forbidden**: Usuario no tiene permiso para acceder al recurso
- **404 Not Found**: Log no encontrado
- **500 Internal Server Error**: Error del servidor

## 9. Casos de Uso

### 9.1 Repartidor Sincroniza Datos Offline
**Actor:** Repartidor
**Flujo:**
1. Repartidor trabaja sin conexión durante el día
2. Crea visitas, órdenes y fotos con offlineId
3. Al recuperar conexión, sincroniza todos los datos
4. Backend registra automáticamente SyncLogs para cada entidad
5. Repartidor consulta su historial de sincronizaciones

### 9.2 ADMIN Monitorea Sincronizaciones
**Actor:** ADMIN
**Flujo:**
1. ADMIN accede al dashboard de sincronizaciones
2. Filtra por fecha y tipo de entidad
3. Ve estadísticas de sincronizaciones por usuario
4. Identifica patrones de trabajo offline

### 9.3 Auditoría de Operaciones Offline
**Actor:** ADMIN
**Flujo:**
1. ADMIN necesita auditar las operaciones de un repartidor
2. Consulta logs de sincronización del usuario
3. Verifica qué datos fueron creados offline vs online
4. Valida integridad de las sincronizaciones

## 10. Consideraciones Técnicas

### 10.1 Registro Automático
Los SyncLogs se pueden crear automáticamente desde los endpoints de sincronización:
- `/api/visits/sync` → crea SyncLog con entityType="VISIT"
- `/api/orders/sync` → crea SyncLog con entityType="ORDER"
- `/api/photos/sync` → crea SyncLog con entityType="PHOTO"

### 10.2 Información del Dispositivo
El campo `deviceInfo` puede contener:
- Modelo del dispositivo
- Sistema operativo y versión
- Versión de la app
- Información útil para debugging

### 10.3 Índices de Base de Datos
- userId: Para consultas por usuario
- entityType: Para filtrar por tipo de entidad
- syncedAt: Para ordenar y filtrar por fecha

### 10.4 Retención de Datos
Considerar política de retención:
- Logs más antiguos de X meses pueden ser archivados
- Mantener solo logs recientes para queries rápidas
