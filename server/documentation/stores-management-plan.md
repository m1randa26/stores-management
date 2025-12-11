# Plan de Acción - Gestión de Tiendas

## Objetivo

Implementar un módulo completo de gestión de tiendas con operaciones CRUD, generación de códigos QR, y asignación de repartidores.

---

## Arquitectura del Módulo

```
src/modules/stores/
├── stores.schema.ts      # Validaciones Zod
├── stores.service.ts     # Lógica de negocio
├── stores.controller.ts  # Controladores HTTP
└── stores.routes.ts      # Definición de endpoints
```

---

## Funcionalidades a Implementar

### 1. Schemas de Validación (stores.schema.ts)

#### createStoreSchema
Validación para crear nuevas tiendas:
- `name`: string (2-100 caracteres, requerido)
- `address`: string (mínimo 5 caracteres, requerido)
- `latitude`: number opcional (rango: -90 a 90)
- `longitude`: number opcional (rango: -180 a 180)

#### updateStoreSchema
Versión parcial del createSchema para actualizaciones

#### assignUserSchema
Validación para asignación de usuarios:
- `userId`: string (ID del usuario/repartidor)

---

### 2. Servicios (stores.service.ts)

#### CRUD Básico

##### createStore()
- Crear nueva tienda en la base de datos
- Generar código QR único usando UUID v4
- Validar datos de entrada
- Retornar tienda creada

##### getAllStores(filters?)
- Listar todas las tiendas
- Filtros opcionales:
  - `isActive`: boolean (filtrar por estado)
  - Ordenamiento por fecha de creación
- Incluir información de asignaciones

##### getStoreById(id)
- Obtener tienda específica por ID
- Incluir información de repartidores asignados
- Retornar error 404 si no existe

##### updateStore(id, data)
- Actualizar información de tienda
- No permitir modificar el código QR
- Validar que la tienda exista

##### toggleStoreStatus(id)
- Activar/desactivar tienda
- Cambiar campo `isActive`
- Útil para dar de baja temporal

#### Funcionalidades Especiales

##### getStoreByQR(qrCode)
- Buscar tienda por código QR único
- Usado por repartidores al escanear código
- Verificar que la tienda esté activa

##### assignUserToStore(storeId, userId)
- Asignar repartidor a tienda
- Verificar que el usuario tenga rol REPARTIDOR
- Prevenir asignaciones duplicadas
- Crear registro en tabla StoreAssignment

##### unassignUserFromStore(storeId, userId)
- Desasignar repartidor de tienda
- Eliminar registro de StoreAssignment
- Validar que la asignación exista

##### getStoreAssignments(storeId)
- Obtener lista de repartidores asignados
- Incluir información del usuario (id, name, email)
- Ordenar por fecha de asignación

---

### 3. Controladores (stores.controller.ts)

Funciones que manejan las peticiones HTTP y responden con JSON estructurado.

#### createStoreController
- Validar request body con schema
- Llamar servicio createStore
- Retornar 201 con tienda creada

#### getStoresController
- Extraer filtros de query params
- Llamar servicio getAllStores
- Retornar 200 con lista de tiendas

#### getStoreByIdController
- Extraer ID de params
- Llamar servicio getStoreById
- Retornar 200 o 404

#### updateStoreController
- Validar request body
- Llamar servicio updateStore
- Retornar 200 con tienda actualizada

#### toggleStoreStatusController
- Extraer ID de params
- Llamar servicio toggleStoreStatus
- Retornar 200 con nuevo estado

#### getStoreByQRController
- Extraer qrCode de params
- Llamar servicio getStoreByQR
- Retornar 200 o 404

#### assignUserController
- Validar request body
- Llamar servicio assignUserToStore
- Retornar 201 con confirmación

#### unassignUserController
- Extraer storeId y userId de params
- Llamar servicio unassignUserFromStore
- Retornar 200 con confirmación

---

### 4. Rutas (stores.routes.ts)

#### Endpoints Públicos
```
GET /api/stores/qr/:qrCode
```
Buscar tienda por código QR (usado por app móvil al escanear)

#### Endpoints Protegidos (requieren autenticación)
```
GET /api/stores
GET /api/stores/:id
```
Listar y obtener tiendas (REPARTIDOR y ADMIN)

#### Endpoints Admin (solo ADMIN)
```
POST   /api/stores
PUT    /api/stores/:id
PATCH  /api/stores/:id/status
POST   /api/stores/:id/assign
DELETE /api/stores/:id/unassign/:userId
GET    /api/stores/:id/assignments
```
Gestión completa de tiendas y asignaciones

---

## Flujos de Operación

### Flujo 1: Crear Tienda (ADMIN)

1. **Request**: Admin envía POST a `/api/stores`
   ```json
   {
     "name": "Tienda La Esquina",
     "address": "Calle Principal #123",
     "latitude": 19.4326,
     "longitude": -99.1332
   }
   ```

2. **Validación**: Schema valida datos de entrada

3. **Generación QR**: Servicio genera UUID único
   ```javascript
   qrCode = crypto.randomUUID()
   ```

4. **Persistencia**: Guarda tienda en base de datos

5. **Response**: Retorna tienda creada (201)
   ```json
   {
     "success": true,
     "message": "Store created successfully",
     "data": {
       "id": "clxxx...",
       "name": "Tienda La Esquina",
       "address": "Calle Principal #123",
       "qrCode": "550e8400-e29b-41d4-a716-446655440000",
       "latitude": 19.4326,
       "longitude": -99.1332,
       "isActive": true,
       "createdAt": "2025-12-05T..."
     }
   }
   ```

---

### Flujo 2: Asignar Repartidor (ADMIN)

1. **Request**: Admin envía POST a `/api/stores/:id/assign`
   ```json
   {
     "userId": "clyyy..."
   }
   ```

2. **Validación**:
   - Verifica que la tienda exista
   - Verifica que el usuario exista
   - Verifica que el usuario tenga rol REPARTIDOR
   - Verifica que no exista asignación previa

3. **Creación**: Crea registro en StoreAssignment
   ```javascript
   {
     userId: "clyyy...",
     storeId: "clxxx...",
     assignedAt: new Date()
   }
   ```

4. **Response**: Retorna confirmación (201)
   ```json
   {
     "success": true,
     "message": "User assigned to store successfully",
     "data": {
       "id": "clzzz...",
       "userId": "clyyy...",
       "storeId": "clxxx...",
       "assignedAt": "2025-12-05T..."
     }
   }
   ```

---

### Flujo 3: Escanear QR (REPARTIDOR)

1. **Escaneo**: Repartidor escanea código QR en tienda física

2. **Request**: App envía GET a `/api/stores/qr/:qrCode`
   ```
   GET /api/stores/qr/550e8400-e29b-41d4-a716-446655440000
   ```

3. **Búsqueda**: Sistema busca tienda por código QR

4. **Validación**:
   - Verifica que la tienda exista
   - Verifica que la tienda esté activa
   - Opcionalmente verifica que el repartidor esté asignado

5. **Response**: Retorna información de tienda (200)
   ```json
   {
     "success": true,
     "data": {
       "id": "clxxx...",
       "name": "Tienda La Esquina",
       "address": "Calle Principal #123",
       "latitude": 19.4326,
       "longitude": -99.1332,
       "isActive": true
     }
   }
   ```

6. **Siguiente acción**: App permite registrar visita

---

## Seguridad y Permisos

| Operación | Público | REPARTIDOR | ADMIN |
|-----------|---------|------------|-------|
| Listar tiendas | ❌ | ✅ | ✅ |
| Ver tienda por ID | ❌ | ✅ | ✅ |
| Buscar por QR | ❌ | ✅ | ✅ |
| Crear tienda | ❌ | ❌ | ✅ |
| Editar tienda | ❌ | ❌ | ✅ |
| Activar/Desactivar | ❌ | ❌ | ✅ |
| Asignar repartidor | ❌ | ❌ | ✅ |
| Desasignar repartidor | ❌ | ❌ | ✅ |
| Ver asignaciones | ❌ | ❌ | ✅ |

---

## Manejo de Errores

### Errores de Validación (400)
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "name",
      "message": "Short name"
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
  "message": "Insufficient permissions"
}
```

### No Encontrado (404)
```json
{
  "success": false,
  "message": "Store not found"
}
```

### Conflicto (409)
```json
{
  "success": false,
  "message": "User already assigned to this store"
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

### Store (Prisma Schema)
```prisma
model Store {
  id            String    @id @default(cuid())
  name          String
  address       String
  latitude      Float?
  longitude     Float?
  qrCode        String    @unique  // UUID para el QR
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relaciones
  assignments   StoreAssignment[]
  visits        Visit[]
  orders        Order[]
}
```

### StoreAssignment
```prisma
model StoreAssignment {
  id            String    @id @default(cuid())
  userId        String
  storeId       String
  assignedAt    DateTime  @default(now())

  user          User      @relation(fields: [userId], references: [id])
  store         Store     @relation(fields: [storeId], references: [id])

  @@unique([userId, storeId])
}
```

---

## Casos de Uso

### Caso 1: Configuración Inicial del Sistema
**Actor**: Administrador
**Flujo**:
1. Admin crea tiendas en el sistema
2. Para cada tienda, el sistema genera código QR único
3. Admin imprime códigos QR
4. Admin coloca códigos QR en tiendas físicas
5. Admin asigna repartidores a sus rutas

### Caso 2: Ruta Diaria de Repartidor
**Actor**: Repartidor
**Flujo**:
1. Repartidor consulta sus tiendas asignadas
2. Planifica ruta del día
3. Al llegar a cada tienda, escanea código QR
4. Sistema verifica identidad y asignación
5. Permite registrar visita y pedido

### Caso 3: Rotación de Personal
**Actor**: Administrador
**Flujo**:
1. Admin identifica cambio de repartidor en zona
2. Desasigna repartidor saliente de tiendas
3. Asigna nuevo repartidor a las mismas tiendas
4. Nuevo repartidor puede acceder a sus tiendas

---

## Consideraciones Técnicas

### Generación de QR
- Usar `crypto.randomUUID()` de Node.js
- Garantiza unicidad
- Formato estándar UUID v4
- Ejemplo: `550e8400-e29b-41d4-a716-446655440000`

### Validación de Coordenadas
- Latitude: -90 a 90
- Longitude: -180 a 180
- Opcional para permitir tiendas sin geolocalización

### Índices de Base de Datos
- `qrCode` debe tener índice único (ya definido en schema)
- Considerar índice en `isActive` para filtros frecuentes

### Soft Delete vs Hard Delete
- Usar campo `isActive` para desactivación (soft delete)
- No eliminar tiendas físicamente para mantener historial
- Visitas y órdenes mantienen referencia a tienda

---

## Próximos Pasos

1. ✅ Crear schemas de validación Zod
2. ✅ Implementar servicios de negocio
3. ✅ Crear controladores HTTP
4. ✅ Definir rutas y middlewares
5. ✅ Integrar en aplicación principal
6. ✅ Realizar pruebas en Postman
7. ✅ Documentar endpoints en colección Postman

---

## Dependencias

- `crypto`: Generación de UUID (nativo de Node.js)
- `@prisma/client`: ORM para base de datos
- `zod`: Validación de schemas
- `express`: Framework web
- `jsonwebtoken`: Autenticación (ya implementado)

---

## Testing (Futuro)

### Pruebas Unitarias
- Validaciones de schemas
- Lógica de servicios
- Generación de UUID único

### Pruebas de Integración
- Endpoints completos
- Autenticación y autorización
- Asignaciones y desasignaciones

### Pruebas E2E
- Flujo completo de registro de visita
- Escaneo QR y validación
- Gestión de asignaciones

---

**Documento creado**: 2025-12-05
**Versión**: 1.0
**Estado**: Pendiente de implementación
