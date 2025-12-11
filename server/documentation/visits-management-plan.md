# Plan de Acción - Gestión de Visitas

## Objetivo

Implementar un módulo completo de gestión de visitas que permita a los repartidores registrar sus llegadas a tiendas con geolocalización, validación de asignaciones, y soporte para sincronización offline.

---

## Arquitectura del Módulo

```
src/modules/visits/
├── visits.schema.ts      # Validaciones Zod
├── visits.service.ts     # Lógica de negocio
├── visits.controller.ts  # Controladores HTTP
└── visits.routes.ts      # Definición de endpoints
```

---

## Funcionalidades a Implementar

### 1. Schemas de Validación (visits.schema.ts)

#### createVisitSchema
Validación para registrar nueva visita:
- `storeId`: string (ID de la tienda, requerido)
- `latitude`: number (coordenada GPS, -90 a 90, requerido)
- `longitude`: number (coordenada GPS, -180 a 180, requerido)
- `accuracy`: number opcional (precisión en metros, mayor a 0)
- `offlineId`: string opcional (UUID generado offline para evitar duplicados)

#### syncVisitSchema
Validación para sincronizar visita offline:
- Incluye todos los campos de createVisitSchema
- `visitedAt`: DateTime opcional (fecha/hora de visita offline)

---

### 2. Servicios (visits.service.ts)

#### CRUD y Operaciones Principales

##### createVisit(userId, data)
- Crear nueva visita en la base de datos
- Validar que el usuario esté autenticado
- Validar que la tienda exista y esté activa
- **IMPORTANTE**: Verificar que el repartidor esté asignado a la tienda
- Validar coordenadas GPS
- Opcional: Validar proximidad a la tienda (radio de X metros)
- Retornar visita creada con relaciones

##### getVisitById(id, userId?)
- Obtener visita específica por ID
- Incluir información de tienda, usuario, fotos y orden
- Si userId proporcionado, validar que la visita pertenezca al usuario
- Retornar error 404 si no existe

##### getMyVisits(userId, filters?)
- Obtener visitas del repartidor autenticado
- Filtros opcionales:
  - `storeId`: filtrar por tienda específica
  - `startDate`: visitas desde fecha
  - `endDate`: visitas hasta fecha
  - `hasOrder`: solo visitas con/sin orden
- Ordenamiento por fecha descendente
- Incluir información de tienda y orden

##### getAllVisits(filters?)
- Listar todas las visitas (solo ADMIN)
- Filtros opcionales:
  - `userId`: filtrar por repartidor
  - `storeId`: filtrar por tienda
  - `startDate` y `endDate`: rango de fechas
  - `synced`: visitas sincronizadas/pendientes
- Paginación opcional
- Ordenamiento por fecha

##### getStoreVisits(storeId, filters?)
- Obtener visitas de una tienda específica
- Filtros de fecha
- Útil para reportes de actividad por tienda
- Incluir información del repartidor

##### syncOfflineVisit(data)
- Sincronizar visita creada en modo offline
- Validar que no exista duplicado por offlineId
- Registrar fecha de sincronización (syncedAt)
- Mantener fecha original de visita (visitedAt)
- Retornar visita sincronizada

##### validateProximity(latitude, longitude, store)
- Validar que las coordenadas estén cerca de la tienda
- Calcular distancia usando fórmula Haversine
- Radio máximo configurable (ej: 100 metros)
- Retornar true/false y distancia calculada

##### getVisitStatistics(userId?, storeId?)
- Obtener estadísticas de visitas
- Total de visitas
- Visitas con órdenes
- Promedio de precisión GPS
- Visitas por día/semana/mes

---

### 3. Controladores (visits.controller.ts)

Funciones que manejan las peticiones HTTP y responden con JSON estructurado.

#### createVisitController
- Validar request body con schema
- Extraer userId del token (req.user)
- Llamar servicio createVisit
- Retornar 201 con visita creada

#### getVisitByIdController
- Extraer ID de params
- Extraer userId del token
- Llamar servicio getVisitById
- Retornar 200 o 404

#### getMyVisitsController
- Extraer userId del token (req.user)
- Extraer filtros de query params
- Llamar servicio getMyVisits
- Retornar 200 con lista de visitas

#### getAllVisitsController
- Solo ADMIN
- Extraer filtros de query params
- Llamar servicio getAllVisits
- Retornar 200 con lista completa

#### getStoreVisitsController
- Extraer storeId de params
- Extraer filtros de query params
- Llamar servicio getStoreVisits
- Retornar 200 con visitas de la tienda

#### syncOfflineVisitController
- Validar request body
- Llamar servicio syncOfflineVisit
- Retornar 201 con visita sincronizada

#### getVisitStatisticsController
- Extraer filtros de query params
- Llamar servicio getVisitStatistics
- Retornar 200 con estadísticas

---

### 4. Rutas (visits.routes.ts)

#### Endpoints Protegidos (REPARTIDOR autenticado)
```
POST   /api/visits                  # Registrar nueva visita
GET    /api/visits/my-visits        # Mis visitas
GET    /api/visits/:id              # Obtener visita específica
POST   /api/visits/sync             # Sincronizar visita offline
```

#### Endpoints Admin (solo ADMIN)
```
GET    /api/visits                  # Listar todas las visitas
GET    /api/visits/store/:storeId   # Visitas de una tienda
GET    /api/visits/statistics       # Estadísticas generales
```

---

## Flujos de Operación

### Flujo 1: Registrar Visita (REPARTIDOR)

1. **Escenario**: Repartidor llega a tienda y escanea QR

2. **Request**: Repartidor envía POST a `/api/visits`
   ```json
   {
     "storeId": "clxxx...",
     "latitude": 19.4326,
     "longitude": -99.1332,
     "accuracy": 15.5
   }
   ```

3. **Validaciones**:
   - Schema valida coordenadas GPS
   - Verifica que la tienda exista y esté activa
   - **Verifica que el repartidor esté asignado a la tienda**
   - Opcionalmente valida proximidad (ej: < 100m de la tienda)

4. **Registro**:
   - Guarda visita con timestamp actual
   - Asocia userId del token
   - Marca como no sincronizada inicialmente

5. **Response**: Retorna visita creada (201)
   ```json
   {
     "success": true,
     "message": "Visit registered successfully",
     "data": {
       "id": "clyyy...",
       "userId": "clzzz...",
       "storeId": "clxxx...",
       "latitude": 19.4326,
       "longitude": -99.1332,
       "accuracy": 15.5,
       "visitedAt": "2025-12-05T10:30:00Z",
       "store": {
         "id": "clxxx...",
         "name": "Tienda La Esquina",
         "address": "Calle Principal #123"
       }
     }
   }
   ```

6. **Siguiente acción**:
   - Repartidor puede tomar fotos
   - Repartidor puede crear orden

---

### Flujo 2: Consultar Mis Visitas (REPARTIDOR)

1. **Request**: Repartidor envía GET a `/api/visits/my-visits`
   ```
   GET /api/visits/my-visits?startDate=2025-12-01&endDate=2025-12-05
   Authorization: Bearer <token>
   ```

2. **Búsqueda**:
   - Sistema filtra por userId del token
   - Aplica filtros de fecha
   - Incluye información de tienda y orden

3. **Response**: Retorna lista de visitas (200)
   ```json
   {
     "success": true,
     "data": [
       {
         "id": "clyyy...",
         "storeId": "clxxx...",
         "latitude": 19.4326,
         "longitude": -99.1332,
         "accuracy": 15.5,
         "visitedAt": "2025-12-05T10:30:00Z",
         "store": {
           "name": "Tienda La Esquina",
           "address": "Calle Principal #123"
         },
         "order": {
           "id": "clzzz...",
           "total": "250.00",
           "status": "PENDING"
         },
         "_count": {
           "photos": 3
         }
       }
     ],
     "total": 1
   }
   ```

---

### Flujo 3: Sincronización Offline (REPARTIDOR)

1. **Escenario**:
   - Repartidor trabajó sin conexión
   - Creó visitas localmente con offlineId
   - Ahora tiene conexión y sincroniza

2. **Request**: App envía POST a `/api/visits/sync`
   ```json
   {
     "storeId": "clxxx...",
     "latitude": 19.4326,
     "longitude": -99.1332,
     "accuracy": 20.0,
     "visitedAt": "2025-12-05T08:15:00Z",
     "offlineId": "offline-uuid-1234"
   }
   ```

3. **Validaciones**:
   - Verifica que no exista visita con ese offlineId
   - Valida todos los campos normales
   - Respeta la fecha/hora original (visitedAt)

4. **Sincronización**:
   - Crea visita con fecha original
   - Registra syncedAt con timestamp actual
   - Marca como sincronizada

5. **Response**: Retorna visita sincronizada (201)
   ```json
   {
     "success": true,
     "message": "Visit synced successfully",
     "data": {
       "id": "clyyy...",
       "visitedAt": "2025-12-05T08:15:00Z",
       "syncedAt": "2025-12-05T15:30:00Z",
       "offlineId": "offline-uuid-1234"
     }
   }
   ```

---

### Flujo 4: Validación de Proximidad

1. **Configuración**: Radio máximo = 100 metros

2. **Cálculo**:
   - Coordenadas tienda: (19.4326, -99.1332)
   - Coordenadas repartidor: (19.4330, -99.1335)
   - Distancia calculada: ~45 metros

3. **Validación**:
   - Si distancia ≤ 100m → ✅ Permitir visita
   - Si distancia > 100m → ❌ Rechazar o marcar como "fuera de zona"

4. **Response si está lejos** (403):
   ```json
   {
     "success": false,
     "message": "You are too far from the store",
     "distance": 250.5,
     "maxDistance": 100
   }
   ```

---

## Seguridad y Permisos

| Operación | REPARTIDOR | ADMIN |
|-----------|------------|-------|
| Registrar visita | ✅ (solo sus tiendas asignadas) | ✅ |
| Ver mis visitas | ✅ | ✅ |
| Ver visita específica | ✅ (solo propias) | ✅ (todas) |
| Listar todas las visitas | ❌ | ✅ |
| Ver visitas de tienda | ❌ | ✅ |
| Estadísticas | ✅ (propias) | ✅ (todas) |
| Sincronizar offline | ✅ | ✅ |

---

## Manejo de Errores

### Errores de Validación (400)
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "latitude",
      "message": "Latitude must be between -90 and 90"
    }
  ]
}
```

### No Autorizado (401)
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### Permisos Insuficientes (403)
```json
{
  "success": false,
  "message": "You are not assigned to this store"
}
```

### Fuera de Zona (403)
```json
{
  "success": false,
  "message": "You are too far from the store",
  "distance": 250.5,
  "maxDistance": 100
}
```

### No Encontrado (404)
```json
{
  "success": false,
  "message": "Visit not found"
}
```

### Conflicto - Duplicado Offline (409)
```json
{
  "success": false,
  "message": "Visit with this offline ID already synced"
}
```

### Error Interno (500)
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Modelo de Datos

### Visit (Prisma Schema)
```prisma
model Visit {
  id            String    @id @default(cuid())
  userId        String
  storeId       String
  latitude      Float
  longitude     Float
  accuracy      Float?    // Precisión en metros
  visitedAt     DateTime  @default(now())
  syncedAt      DateTime?
  offlineId     String?   @unique  // ID generado offline

  user          User      @relation(fields: [userId], references: [id])
  store         Store     @relation(fields: [storeId], references: [id])
  photos        Photo[]
  order         Order?
}
```

---

## Casos de Uso

### Caso 1: Jornada Normal del Repartidor
**Actor**: Repartidor con conexión
**Flujo**:
1. Repartidor consulta sus tiendas asignadas
2. Llega a primera tienda
3. Escanea código QR de la tienda
4. App captura geolocalización automáticamente
5. Sistema valida proximidad y asignación
6. Registra visita exitosamente
7. Repartidor toma fotos y crea orden
8. Continúa con siguiente tienda

### Caso 2: Modo Offline
**Actor**: Repartidor sin conexión
**Flujo**:
1. Repartidor pierde conexión a internet
2. App detecta modo offline
3. Repartidor visita tiendas normalmente
4. App registra visitas localmente con offlineId único
5. Repartidor recupera conexión
6. App sincroniza visitas pendientes automáticamente
7. Sistema valida y registra todas las visitas

### Caso 3: Análisis de Productividad (ADMIN)
**Actor**: Administrador
**Flujo**:
1. Admin consulta estadísticas de visitas
2. Filtra por repartidor y rango de fechas
3. Ve total de visitas realizadas
4. Identifica visitas sin orden (oportunidades perdidas)
5. Analiza precisión GPS promedio
6. Genera reportes de productividad

### Caso 4: Auditoría de Tienda
**Actor**: Administrador
**Flujo**:
1. Admin selecciona tienda específica
2. Consulta todas las visitas a esa tienda
3. Ve historial completo con fechas
4. Identifica frecuencia de visitas
5. Revisa qué repartidores la visitaron
6. Analiza órdenes generadas

---

## Consideraciones Técnicas

### Geolocalización GPS

**Coordenadas**:
- Latitude: -90 a 90 (Norte/Sur)
- Longitude: -180 a 180 (Este/Oeste)
- Formato decimal: 19.4326, -99.1332

**Precisión (Accuracy)**:
- Medida en metros
- Valores típicos:
  - < 10m: Excelente (GPS + WiFi + Celular)
  - 10-50m: Buena (GPS + Celular)
  - 50-100m: Aceptable (Solo celular)
  - > 100m: Pobre (señal débil)

**Cálculo de Distancia (Haversine)**:
```javascript
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distancia en metros
}
```

### Modo Offline

**Offline ID**:
- UUID v4 generado en cliente
- Ejemplo: `offline-550e8400-e29b-41d4-a716-446655440000`
- Previene duplicados al sincronizar
- Debe ser único por visita

**Timestamps**:
- `visitedAt`: Fecha/hora real de la visita (puede ser pasada)
- `syncedAt`: Fecha/hora de sincronización con servidor
- Diferencia permite identificar visitas offline

**Estrategia de Sincronización**:
1. Cola local en IndexedDB/AsyncStorage
2. Intentar sincronizar automáticamente
3. Retry con backoff exponencial
4. Notificar usuario si falla

### Validaciones Importantes

**Proximidad a Tienda**:
- Radio recomendado: 50-100 metros
- Configurable por ambiente
- Más estricto en zonas urbanas
- Más flexible en zonas rurales

**Asignación de Repartidor**:
- Verificar en tabla StoreAssignment
- Solo repartidores asignados pueden registrar visitas
- Previene visitas no autorizadas

**Duplicados**:
- Por offlineId (visitas offline)
- Opcional: prevenir múltiples visitas mismo día a misma tienda

---

## Validaciones de Negocio

### 1. Verificar Asignación
```sql
SELECT COUNT(*) FROM StoreAssignment
WHERE userId = ? AND storeId = ?
```
- Retornar 403 si no está asignado

### 2. Verificar Tienda Activa
```sql
SELECT isActive FROM Store WHERE id = ?
```
- Retornar 403 si tienda inactiva

### 3. Validar Proximidad (Opcional)
```javascript
const distance = haversineDistance(
  visit.latitude, visit.longitude,
  store.latitude, store.longitude
);

if (distance > MAX_DISTANCE) {
  throw new Error('Too far from store');
}
```

### 4. Prevenir Duplicados Offline
```sql
SELECT id FROM Visit WHERE offlineId = ?
```
- Retornar 409 si ya existe

---

## Índices de Base de Datos Recomendados

```prisma
@@index([userId, visitedAt])
@@index([storeId, visitedAt])
@@index([offlineId])
@@index([syncedAt])
```

Beneficios:
- Búsquedas rápidas por usuario
- Filtros por tienda eficientes
- Queries de rango de fechas optimizadas
- Sincronización rápida

---

## Próximos Pasos

1. ✅ Crear schemas de validación Zod
2. ✅ Implementar servicios de negocio
3. ✅ Implementar cálculo de distancia Haversine
4. ✅ Crear controladores HTTP
5. ✅ Definir rutas y middlewares
6. ✅ Integrar en aplicación principal
7. ✅ Realizar pruebas con coordenadas reales
8. ✅ Probar sincronización offline

---

## Dependencias

- `@prisma/client`: ORM para base de datos
- `zod`: Validación de schemas
- `express`: Framework web
- `jsonwebtoken`: Autenticación (ya implementado)

---

## Testing (Futuro)

### Pruebas Unitarias
- Validación de coordenadas
- Cálculo de distancia Haversine
- Validación de proximidad
- Prevención de duplicados offline

### Pruebas de Integración
- Registro de visita completo
- Validación de asignación
- Sincronización offline
- Filtros y búsquedas

### Pruebas E2E
- Flujo completo: QR → Visita → Fotos → Orden
- Modo offline y sincronización
- Validación de proximidad en campo

---

## Mejoras Futuras (Opcional)

### Geofencing
- Alertas automáticas al entrar/salir de zona
- Registro automático de visita por proximidad

### Rutas Optimizadas
- Sugerir orden óptimo de visitas
- Algoritmo de ruteo (TSP)
- Integración con Google Maps

### Verificación Biométrica
- Selfie del repartidor en ubicación
- Prevenir fraude de ubicación

### Análisis de Patrones
- Tiempos promedio por visita
- Rutas más eficientes
- Horas pico de visitas

### Notificaciones
- Alertar si repartidor no visita tienda esperada
- Recordatorios de visitas pendientes

---

**Documento creado**: 2025-12-05
**Versión**: 1.0
**Estado**: Pendiente de implementación
