# Plan de Acción - Gestión de Órdenes

## Objetivo

Implementar un módulo completo de gestión de órdenes (pedidos) que permita a los repartidores crear pedidos durante las visitas a tiendas, calcular totales automáticamente, gestionar estados, y sincronizar órdenes creadas en modo offline.

---

## Arquitectura del Módulo

```
src/modules/orders/
├── orders.schema.ts      # Validaciones Zod
├── orders.service.ts     # Lógica de negocio
├── orders.controller.ts  # Controladores HTTP
└── orders.routes.ts      # Definición de endpoints
```

---

## Funcionalidades a Implementar

### 1. Schemas de Validación (orders.schema.ts)

#### createOrderSchema
Validación para crear nueva orden:
- `visitId`: string (ID de la visita, requerido, único)
- `items`: array de objetos (requerido, mínimo 1 item)
  - `productId`: string (ID del producto, requerido)
  - `quantity`: number (cantidad, entero positivo, requerido)
  - `unitPrice`: number (precio unitario, positivo, 2 decimales)
- `offlineId`: string opcional (UUID generado offline)

#### updateOrderStatusSchema
Validación para actualizar estado:
- `status`: enum (PENDING, SYNCED, PROCESSING, COMPLETED, CANCELLED)

#### syncOrderSchema
Validación para sincronizar orden offline:
- Incluye todos los campos de createOrderSchema
- `createdAt`: DateTime opcional (fecha/hora de creación offline)

---

### 2. Servicios (orders.service.ts)

#### CRUD y Operaciones Principales

##### createOrder(userId, data)
- Crear nueva orden durante una visita
- Validar que el usuario esté autenticado
- **Validar que la visita exista y pertenezca al usuario**
- **Validar que la visita NO tenga ya una orden** (relación 1:1)
- Validar que todos los productos existan y estén activos
- Calcular total automáticamente (suma de quantity * unitPrice)
- Crear orden y items en una transacción
- Retornar orden completa con items y productos

##### getOrderById(id, userId?)
- Obtener orden específica por ID
- Incluir items con información de productos
- Incluir información de visita y tienda
- Si userId proporcionado (REPARTIDOR), validar propiedad
- Retornar error 404 si no existe

##### getMyOrders(userId, filters?)
- Obtener órdenes del repartidor autenticado
- Filtros opcionales:
  - `storeId`: filtrar por tienda
  - `status`: filtrar por estado
  - `startDate` y `endDate`: rango de fechas
- Ordenamiento por fecha descendente
- Incluir información de tienda y totales

##### getAllOrders(filters?)
- Listar todas las órdenes (solo ADMIN)
- Filtros opcionales:
  - `userId`: filtrar por repartidor
  - `storeId`: filtrar por tienda
  - `status`: filtrar por estado
  - `startDate` y `endDate`: rango de fechas
  - `synced`: órdenes sincronizadas/pendientes
- Paginación opcional
- Ordenamiento por fecha

##### getStoreOrders(storeId, filters?)
- Obtener órdenes de una tienda específica
- Filtros de fecha y estado
- Útil para reportes de ventas por tienda

##### updateOrderStatus(id, status, userId?)
- Actualizar estado de la orden
- Validar transiciones de estado válidas:
  - PENDING → SYNCED, PROCESSING, CANCELLED
  - SYNCED → PROCESSING, CANCELLED
  - PROCESSING → COMPLETED, CANCELLED
  - COMPLETED ❌ (no se puede cambiar)
  - CANCELLED ❌ (no se puede cambiar)
- Si es REPARTIDOR, validar que la orden le pertenezca
- Registrar fecha de actualización

##### syncOfflineOrder(userId, data)
- Sincronizar orden creada en modo offline
- Validar que no exista duplicado por offlineId
- Validar que la visita exista
- Validar productos y calcular total
- Marcar como SYNCED automáticamente
- Registrar fecha de sincronización
- Crear orden e items en transacción

##### calculateOrderTotal(items)
- Calcular total de la orden
- Suma de (quantity * unitPrice) de cada item
- Validar que el total sea positivo
- Retornar con 2 decimales

##### getOrderStatistics(userId?, storeId?, filters?)
- Estadísticas de órdenes
- Total de órdenes por estado
- Suma de ventas totales
- Promedio de ticket
- Productos más vendidos
- Órdenes por día/semana/mes

---

### 3. Controladores (orders.controller.ts)

Funciones que manejan las peticiones HTTP y responden con JSON estructurado.

#### createOrderController
- Validar request body con schema
- Extraer userId del token (req.user)
- Llamar servicio createOrder
- Retornar 201 con orden creada

#### getOrderByIdController
- Extraer ID de params
- Extraer userId del token si es REPARTIDOR
- Llamar servicio getOrderById
- Retornar 200 o 404

#### getMyOrdersController
- Extraer userId del token (req.user)
- Extraer filtros de query params
- Llamar servicio getMyOrders
- Retornar 200 con lista de órdenes

#### getAllOrdersController
- Solo ADMIN
- Extraer filtros de query params
- Llamar servicio getAllOrders
- Retornar 200 con lista completa

#### getStoreOrdersController
- Extraer storeId de params
- Extraer filtros de query params
- Llamar servicio getStoreOrders
- Retornar 200 con órdenes de la tienda

#### updateOrderStatusController
- Extraer ID de params
- Validar request body
- Llamar servicio updateOrderStatus
- Retornar 200 con orden actualizada

#### syncOfflineOrderController
- Validar request body
- Llamar servicio syncOfflineOrder
- Retornar 201 con orden sincronizada

#### getOrderStatisticsController
- Extraer filtros de query params
- Llamar servicio getOrderStatistics
- Retornar 200 con estadísticas

---

### 4. Rutas (orders.routes.ts)

#### Endpoints Protegidos (REPARTIDOR autenticado)
```
POST   /api/orders                  # Crear nueva orden
GET    /api/orders/my-orders        # Mis órdenes
GET    /api/orders/:id              # Ver orden específica
POST   /api/orders/sync             # Sincronizar orden offline
PATCH  /api/orders/:id/status       # Actualizar estado (propias)
```

#### Endpoints Admin (solo ADMIN)
```
GET    /api/orders                  # Listar todas las órdenes
GET    /api/orders/store/:storeId   # Órdenes de una tienda
GET    /api/orders/statistics       # Estadísticas generales
PATCH  /api/orders/:id/status       # Actualizar cualquier orden
```

---

## Flujos de Operación

### Flujo 1: Crear Orden Durante Visita (REPARTIDOR)

1. **Escenario**: Repartidor registró visita y ahora crea pedido

2. **Request**: Repartidor envía POST a `/api/orders`
   ```json
   {
     "visitId": "clxxx...",
     "items": [
       {
         "productId": "clyyy...",
         "quantity": 10,
         "unitPrice": 15.50
       },
       {
         "productId": "clzzz...",
         "quantity": 5,
         "unitPrice": 20.00
       }
     ]
   }
   ```

3. **Validaciones**:
   - Schema valida estructura de items
   - Verifica que la visita exista
   - **Verifica que la visita pertenezca al usuario**
   - **Verifica que la visita NO tenga ya una orden**
   - Valida que todos los productos existan y estén activos
   - Valida cantidades positivas

4. **Cálculo**:
   ```
   Item 1: 10 × 15.50 = 155.00
   Item 2:  5 × 20.00 = 100.00
   Total: 255.00
   ```

5. **Creación**:
   - Crea orden con estado PENDING
   - Crea items asociados
   - Todo en una transacción (rollback si falla)

6. **Response**: Retorna orden creada (201)
   ```json
   {
     "success": true,
     "message": "Order created successfully",
     "data": {
       "id": "clorder123...",
       "visitId": "clxxx...",
       "storeId": "clstore...",
       "userId": "cluser...",
       "status": "PENDING",
       "total": "255.00",
       "createdAt": "2025-12-05T11:00:00Z",
       "items": [
         {
           "id": "clitem1...",
           "productId": "clyyy...",
           "quantity": 10,
           "unitPrice": "15.50",
           "product": {
             "sku": "COCA-355",
             "name": "Coca Cola 355ml"
           }
         },
         {
           "id": "clitem2...",
           "productId": "clzzz...",
           "quantity": 5,
           "unitPrice": "20.00",
           "product": {
             "sku": "PEPSI-600",
             "name": "Pepsi 600ml"
           }
         }
       ],
       "store": {
         "name": "Tienda La Esquina",
         "address": "Calle Principal #123"
       }
     }
   }
   ```

---

### Flujo 2: Consultar Mis Órdenes (REPARTIDOR)

1. **Request**: Repartidor envía GET a `/api/orders/my-orders`
   ```
   GET /api/orders/my-orders?status=PENDING&startDate=2025-12-01
   Authorization: Bearer <token>
   ```

2. **Búsqueda**:
   - Sistema filtra por userId del token
   - Aplica filtros de estado y fecha
   - Incluye información de tienda e items

3. **Response**: Retorna lista de órdenes (200)
   ```json
   {
     "success": true,
     "data": [
       {
         "id": "clorder123...",
         "storeId": "clstore...",
         "status": "PENDING",
         "total": "255.00",
         "createdAt": "2025-12-05T11:00:00Z",
         "store": {
           "name": "Tienda La Esquina",
           "address": "Calle Principal #123"
         },
         "items": [...],
         "_count": {
           "items": 2
         }
       }
     ],
     "total": 1,
     "summary": {
       "totalAmount": "255.00",
       "averageTicket": "255.00"
     }
   }
   ```

---

### Flujo 3: Actualizar Estado de Orden (ADMIN)

1. **Request**: Admin actualiza estado a PROCESSING
   ```
   PATCH /api/orders/clorder123.../status
   Authorization: Bearer <admin-token>

   Body:
   {
     "status": "PROCESSING"
   }
   ```

2. **Validación**:
   - Verifica que la orden exista
   - Valida transición de estado válida
   - PENDING → PROCESSING ✅
   - COMPLETED → PROCESSING ❌

3. **Actualización**:
   - Cambia estado a PROCESSING
   - Actualiza updatedAt

4. **Response**: Retorna orden actualizada (200)
   ```json
   {
     "success": true,
     "message": "Order status updated successfully",
     "data": {
       "id": "clorder123...",
       "status": "PROCESSING",
       "updatedAt": "2025-12-05T15:30:00Z"
     }
   }
   ```

---

### Flujo 4: Sincronización Offline (REPARTIDOR)

1. **Escenario**:
   - Repartidor trabajó sin conexión
   - Creó órdenes localmente con offlineId
   - Ahora tiene conexión y sincroniza

2. **Request**: App envía POST a `/api/orders/sync`
   ```json
   {
     "visitId": "clxxx...",
     "items": [
       {
         "productId": "clyyy...",
         "quantity": 10,
         "unitPrice": 15.50
       }
     ],
     "createdAt": "2025-12-05T09:30:00Z",
     "offlineId": "offline-order-uuid-5678"
   }
   ```

3. **Validaciones**:
   - Verifica que no exista orden con ese offlineId
   - Valida todos los campos normales
   - Respeta la fecha/hora original (createdAt)
   - Calcula total automáticamente

4. **Sincronización**:
   - Crea orden con fecha original
   - Marca estado como SYNCED
   - Registra syncedAt con timestamp actual
   - Crea items asociados

5. **Response**: Retorna orden sincronizada (201)
   ```json
   {
     "success": true,
     "message": "Order synced successfully",
     "data": {
       "id": "clorder456...",
       "status": "SYNCED",
       "total": "155.00",
       "createdAt": "2025-12-05T09:30:00Z",
       "syncedAt": "2025-12-05T16:00:00Z",
       "offlineId": "offline-order-uuid-5678"
     }
   }
   ```

---

## Seguridad y Permisos

| Operación | REPARTIDOR | ADMIN |
|-----------|------------|-------|
| Crear orden | ✅ (solo en sus visitas) | ✅ |
| Ver mis órdenes | ✅ | ✅ |
| Ver orden específica | ✅ (solo propias) | ✅ (todas) |
| Actualizar estado | ✅ (solo propias, limitado) | ✅ (todas) |
| Listar todas las órdenes | ❌ | ✅ |
| Ver órdenes de tienda | ❌ | ✅ |
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
      "field": "items.0.quantity",
      "message": "Quantity must be a positive integer"
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
  "message": "You cannot create an order for this visit"
}
```

### No Encontrado (404)
```json
{
  "success": false,
  "message": "Order not found"
}
```

### Conflicto - Visita ya tiene orden (409)
```json
{
  "success": false,
  "message": "Visit already has an order"
}
```

### Conflicto - Duplicado Offline (409)
```json
{
  "success": false,
  "message": "Order with this offline ID already synced"
}
```

### Conflicto - Producto Inactivo (409)
```json
{
  "success": false,
  "message": "Product 'COCA-355' is not active"
}
```

### Conflicto - Transición Inválida (409)
```json
{
  "success": false,
  "message": "Cannot change status from COMPLETED to PENDING"
}
```

---

## Modelo de Datos

### Order (Prisma Schema)
```prisma
model Order {
  id            String      @id @default(cuid())
  visitId       String      @unique
  storeId       String
  userId        String
  status        OrderStatus @default(PENDING)
  total         Decimal     @db.Decimal(10, 2)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  syncedAt      DateTime?
  offlineId     String?     @unique

  visit         Visit       @relation(fields: [visitId], references: [id])
  store         Store       @relation(fields: [storeId], references: [id])
  user          User        @relation(fields: [userId], references: [id])
  items         OrderItem[]
}
```

### OrderItem
```prisma
model OrderItem {
  id            String    @id @default(cuid())
  orderId       String
  productId     String
  quantity      Int
  unitPrice     Decimal   @db.Decimal(10, 2)

  order         Order     @relation(fields: [orderId], references: [id])
  product       Product   @relation(fields: [productId], references: [id])
}
```

### OrderStatus
```prisma
enum OrderStatus {
  PENDING      // Creada, pendiente de sincronizar
  SYNCED       // Sincronizada con servidor
  PROCESSING   // En proceso de preparación
  COMPLETED    // Completada y entregada
  CANCELLED    // Cancelada
}
```

---

## Casos de Uso

### Caso 1: Jornada Completa del Repartidor
**Actor**: Repartidor
**Flujo**:
1. Repartidor llega a tienda y registra visita
2. Toma fotos de evidencia
3. Conversa con cliente sobre pedido
4. Consulta catálogo de productos activos
5. Crea orden con múltiples items
6. Sistema calcula total automáticamente
7. Confirma orden con cliente
8. Continúa con siguiente tienda

### Caso 2: Modo Offline Completo
**Actor**: Repartidor sin conexión
**Flujo**:
1. Repartidor pierde conexión
2. App detecta modo offline
3. Repartidor registra visitas localmente
4. Crea órdenes con offlineId único
5. Todo se guarda en almacenamiento local
6. Repartidor recupera conexión
7. App sincroniza visitas primero
8. Luego sincroniza órdenes asociadas
9. Sistema valida y registra todo

### Caso 3: Gestión de Pedidos (ADMIN)
**Actor**: Administrador
**Flujo**:
1. Admin consulta órdenes pendientes
2. Filtra por estado PENDING
3. Revisa detalles de cada orden
4. Marca orden como PROCESSING
5. Prepara productos
6. Actualiza a COMPLETED cuando entrega
7. Genera reportes de ventas

### Caso 4: Análisis de Ventas (ADMIN)
**Actor**: Administrador
**Flujo**:
1. Admin consulta estadísticas
2. Filtra por rango de fechas
3. Ve total de ventas por tienda
4. Identifica productos más vendidos
5. Calcula ticket promedio
6. Analiza conversión de visitas a órdenes
7. Genera reportes para gerencia

---

## Consideraciones Técnicas

### Cálculo de Total

**Fórmula**:
```javascript
total = items.reduce((sum, item) => {
  return sum + (item.quantity * item.unitPrice);
}, 0);
```

**Precisión**:
- Usar tipo Decimal para evitar errores de punto flotante
- Redondear a 2 decimales
- Ejemplo: 15.50 × 10 = 155.00 (no 155.000001)

### Transacciones

**Creación de Orden**:
```javascript
await prisma.$transaction(async (tx) => {
  // 1. Crear orden
  const order = await tx.order.create({...});

  // 2. Crear items
  await tx.orderItem.createMany({
    data: items.map(item => ({
      orderId: order.id,
      ...item
    }))
  });

  return order;
});
```

Beneficios:
- Todo se crea o nada (atomicidad)
- No quedan órdenes sin items
- No quedan items huérfanos

### Transiciones de Estado Válidas

```
PENDING ──→ SYNCED ──→ PROCESSING ──→ COMPLETED
   │           │            │
   └──→────────└───────────→ CANCELLED
```

**Reglas**:
- PENDING puede ir a: SYNCED, PROCESSING, CANCELLED
- SYNCED puede ir a: PROCESSING, CANCELLED
- PROCESSING puede ir a: COMPLETED, CANCELLED
- COMPLETED es final (no cambia)
- CANCELLED es final (no cambia)

### Validaciones de Negocio

#### 1. Una Orden por Visita
```sql
SELECT COUNT(*) FROM Order WHERE visitId = ?
```
- Si count > 0, rechazar con 409

#### 2. Productos Activos
```sql
SELECT isActive FROM Product WHERE id IN (?)
```
- Si alguno no está activo, rechazar con 409

#### 3. Visita Pertenece al Usuario
```sql
SELECT userId FROM Visit WHERE id = ?
```
- Si userId diferente, rechazar con 403

#### 4. Cantidades Positivas
```javascript
items.every(item => item.quantity > 0 && Number.isInteger(item.quantity))
```

### Modo Offline

**Offline ID**:
- UUID v4 generado en cliente
- Ejemplo: `offline-order-550e8400-e29b-41d4`
- Previene duplicados al sincronizar

**Timestamps**:
- `createdAt`: Fecha/hora real de la orden (puede ser pasada)
- `syncedAt`: Fecha/hora de sincronización
- `updatedAt`: Última modificación

**Dependencias**:
- Sincronizar visitas ANTES que órdenes
- Orden referencia visitId que debe existir

---

## Índices de Base de Datos Recomendados

```prisma
@@index([userId, createdAt])
@@index([storeId, createdAt])
@@index([status])
@@index([visitId])
@@index([offlineId])
```

Beneficios:
- Búsquedas rápidas por usuario
- Filtros por tienda eficientes
- Queries por estado optimizadas
- Validación rápida de visitId único

---

## Próximos Pasos

1. ✅ Crear schemas de validación Zod
2. ✅ Implementar servicios de negocio
3. ✅ Implementar cálculo de totales
4. ✅ Implementar validaciones de transición de estados
5. ✅ Crear controladores HTTP
6. ✅ Definir rutas y middlewares
7. ✅ Integrar en aplicación principal
8. ✅ Realizar pruebas de transacciones
9. ✅ Probar sincronización offline

---

## Dependencias

- `@prisma/client`: ORM para base de datos
- `zod`: Validación de schemas
- `express`: Framework web
- `jsonwebtoken`: Autenticación (ya implementado)
- `decimal.js`: Manejo preciso de decimales (incluido en Prisma)

---

## Testing (Futuro)

### Pruebas Unitarias
- Cálculo de totales
- Validación de transiciones de estado
- Validación de items
- Prevención de duplicados

### Pruebas de Integración
- Creación de orden con transacción
- Sincronización offline
- Actualización de estados
- Filtros y búsquedas

### Pruebas E2E
- Flujo completo: Visita → Orden → Actualización
- Modo offline y sincronización
- Cancelación de órdenes

---

## Mejoras Futuras (Opcional)

### Descuentos y Promociones
- Códigos de descuento
- Descuentos por volumen
- Promociones especiales

### Devoluciones
- Registrar productos devueltos
- Ajustar totales
- Generar notas de crédito

### Firma Digital
- Firma del cliente al recibir
- Evidencia de entrega

### Integración con Inventario
- Descontar stock automáticamente
- Alertas de bajo inventario
- Reserva de productos

### Historial de Precios
- Rastrear cambios de precio por item
- Validar si precio cambió desde catálogo

---

**Documento creado**: 2025-12-05
**Versión**: 1.0
**Estado**: Pendiente de implementación
