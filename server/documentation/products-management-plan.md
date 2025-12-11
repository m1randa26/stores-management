# Plan de Acción - Gestión de Productos

## Objetivo

Implementar un módulo completo de gestión de productos con operaciones CRUD, catálogo para repartidores, y administración de inventario.

---

## Arquitectura del Módulo

```
src/modules/products/
├── products.schema.ts      # Validaciones Zod
├── products.service.ts     # Lógica de negocio
├── products.controller.ts  # Controladores HTTP
└── products.routes.ts      # Definición de endpoints
```

---

## Funcionalidades a Implementar

### 1. Schemas de Validación (products.schema.ts)

#### createProductSchema
Validación para crear nuevos productos:
- `sku`: string (único, 3-50 caracteres, alfanumérico)
- `name`: string (2-200 caracteres, requerido)
- `description`: string opcional (máximo 1000 caracteres)
- `price`: number (mayor a 0, máximo 2 decimales)
- `imageUrl`: string opcional (URL válida)

#### updateProductSchema
Versión parcial del createSchema para actualizaciones
- No permite modificar el SKU (identificador único del producto)

---

### 2. Servicios (products.service.ts)

#### CRUD Básico

##### createProduct()
- Crear nuevo producto en la base de datos
- Validar que el SKU sea único
- Validar datos de entrada
- Retornar producto creado

##### getAllProducts(filters?)
- Listar todos los productos
- Filtros opcionales:
  - `isActive`: boolean (productos activos/inactivos)
  - `search`: string (buscar por nombre o SKU)
  - Paginación opcional
- Ordenamiento por fecha de creación o nombre

##### getProductById(id)
- Obtener producto específico por ID
- Incluir estadísticas de uso (cantidad de órdenes)
- Retornar error 404 si no existe

##### getProductBySku(sku)
- Buscar producto por SKU único
- Útil para escaneo de código de barras
- Retornar error 404 si no existe

##### updateProduct(id, data)
- Actualizar información de producto
- No permitir modificar el SKU
- Validar que el producto exista
- Actualizar precio, nombre, descripción, imagen

##### toggleProductStatus(id)
- Activar/desactivar producto
- Cambiar campo `isActive`
- Útil para descontinuar productos sin eliminarlos

##### deleteProduct(id)
- Eliminar producto (soft delete recomendado)
- Verificar que no tenga órdenes asociadas
- Si tiene órdenes, solo desactivar

##### getActiveProducts()
- Obtener solo productos activos
- Para catálogo de repartidores
- Ordenado alfabéticamente

---

### 3. Controladores (products.controller.ts)

Funciones que manejan las peticiones HTTP y responden con JSON estructurado.

#### createProductController
- Validar request body con schema
- Llamar servicio createProduct
- Retornar 201 con producto creado

#### getProductsController
- Extraer filtros de query params (isActive, search)
- Llamar servicio getAllProducts
- Retornar 200 con lista de productos

#### getProductByIdController
- Extraer ID de params
- Llamar servicio getProductById
- Retornar 200 o 404

#### getProductBySkuController
- Extraer SKU de params
- Llamar servicio getProductBySku
- Retornar 200 o 404

#### updateProductController
- Validar request body
- Llamar servicio updateProduct
- Retornar 200 con producto actualizado

#### toggleProductStatusController
- Extraer ID de params
- Llamar servicio toggleProductStatus
- Retornar 200 con nuevo estado

#### deleteProductController
- Extraer ID de params
- Llamar servicio deleteProduct
- Retornar 200 con confirmación

#### getActiveProductsController
- Llamar servicio getActiveProducts
- Retornar 200 con catálogo activo

---

### 4. Rutas (products.routes.ts)

#### Endpoints Protegidos (requieren autenticación)
```
GET /api/products                # Listar productos (todos los usuarios autenticados)
GET /api/products/active         # Catálogo activo (REPARTIDOR y ADMIN)
GET /api/products/:id            # Obtener producto por ID
GET /api/products/sku/:sku       # Buscar por SKU (para escaneo)
```

#### Endpoints Admin (solo ADMIN)
```
POST   /api/products             # Crear producto
PUT    /api/products/:id         # Actualizar producto
PATCH  /api/products/:id/status  # Activar/Desactivar
DELETE /api/products/:id         # Eliminar producto
```

---

## Flujos de Operación

### Flujo 1: Crear Producto (ADMIN)

1. **Request**: Admin envía POST a `/api/products`
   ```json
   {
     "sku": "COCA-355",
     "name": "Coca Cola 355ml",
     "description": "Refresco de cola en lata de 355ml",
     "price": 15.50,
     "imageUrl": "https://example.com/coca-355.jpg"
   }
   ```

2. **Validación**:
   - Schema valida datos de entrada
   - Verifica que el SKU sea único
   - Valida formato de precio

3. **Persistencia**: Guarda producto en base de datos

4. **Response**: Retorna producto creado (201)
   ```json
   {
     "success": true,
     "message": "Product created successfully",
     "data": {
       "id": "clxxx...",
       "sku": "COCA-355",
       "name": "Coca Cola 355ml",
       "description": "Refresco de cola en lata de 355ml",
       "price": "15.50",
       "imageUrl": "https://example.com/coca-355.jpg",
       "isActive": true,
       "createdAt": "2025-12-05T..."
     }
   }
   ```

---

### Flujo 2: Repartidor Consulta Catálogo

1. **Request**: Repartidor envía GET a `/api/products/active`
   ```
   GET /api/products/active
   Authorization: Bearer <token>
   ```

2. **Búsqueda**: Sistema obtiene solo productos activos

3. **Response**: Retorna catálogo (200)
   ```json
   {
     "success": true,
     "data": [
       {
         "id": "clxxx...",
         "sku": "COCA-355",
         "name": "Coca Cola 355ml",
         "description": "Refresco de cola en lata de 355ml",
         "price": "15.50",
         "imageUrl": "https://example.com/coca-355.jpg",
         "isActive": true
       },
       {
         "id": "clyyy...",
         "sku": "PEPSI-600",
         "name": "Pepsi 600ml",
         "price": "18.00",
         "isActive": true
       }
     ],
     "total": 2
   }
   ```

4. **Siguiente acción**: Repartidor usa catálogo para crear órdenes

---

### Flujo 3: Buscar Producto por SKU (Escaneo)

1. **Escaneo**: Repartidor escanea código de barras del producto

2. **Request**: App envía GET a `/api/products/sku/:sku`
   ```
   GET /api/products/sku/COCA-355
   Authorization: Bearer <token>
   ```

3. **Búsqueda**: Sistema busca producto por SKU único

4. **Response**: Retorna producto (200)
   ```json
   {
     "success": true,
     "data": {
       "id": "clxxx...",
       "sku": "COCA-355",
       "name": "Coca Cola 355ml",
       "description": "Refresco de cola en lata de 355ml",
       "price": "15.50",
       "imageUrl": "https://example.com/coca-355.jpg",
       "isActive": true
     }
   }
   ```

5. **Siguiente acción**: App agrega producto a la orden

---

### Flujo 4: Actualizar Precio (ADMIN)

1. **Request**: Admin envía PUT a `/api/products/:id`
   ```json
   {
     "price": 16.00
   }
   ```

2. **Validación**: Verifica que el producto exista

3. **Actualización**: Modifica el precio en base de datos

4. **Response**: Retorna producto actualizado (200)
   ```json
   {
     "success": true,
     "message": "Product updated successfully",
     "data": {
       "id": "clxxx...",
       "sku": "COCA-355",
       "name": "Coca Cola 355ml",
       "price": "16.00",
       "updatedAt": "2025-12-05T..."
     }
   }
   ```

---

## Seguridad y Permisos

| Operación | REPARTIDOR | ADMIN |
|-----------|------------|-------|
| Listar productos | ✅ | ✅ |
| Ver catálogo activo | ✅ | ✅ |
| Ver producto por ID | ✅ | ✅ |
| Buscar por SKU | ✅ | ✅ |
| Crear producto | ❌ | ✅ |
| Editar producto | ❌ | ✅ |
| Activar/Desactivar | ❌ | ✅ |
| Eliminar producto | ❌ | ✅ |

---

## Manejo de Errores

### Errores de Validación (400)
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "price",
      "message": "Price must be greater than 0"
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
  "message": "Product not found"
}
```

### Conflicto - SKU Duplicado (409)
```json
{
  "success": false,
  "message": "Product with this SKU already exists"
}
```

### Conflicto - No se puede eliminar (409)
```json
{
  "success": false,
  "message": "Cannot delete product with existing orders. Product has been deactivated instead."
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

### Product (Prisma Schema)
```prisma
model Product {
  id            String    @id @default(cuid())
  sku           String    @unique
  name          String
  description   String?
  price         Decimal   @db.Decimal(10, 2)
  imageUrl      String?
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  orderItems    OrderItem[]
}
```

---

## Casos de Uso

### Caso 1: Configuración Inicial del Catálogo
**Actor**: Administrador
**Flujo**:
1. Admin crea productos en el sistema
2. Para cada producto ingresa: SKU, nombre, precio
3. Opcionalmente agrega descripción e imagen
4. Productos quedan activos por defecto
5. Repartidores pueden ver el catálogo

### Caso 2: Toma de Pedido
**Actor**: Repartidor
**Flujo**:
1. Repartidor consulta catálogo activo
2. Selecciona productos para la orden
3. Opcionalmente escanea código de barras (SKU)
4. Sistema valida que productos estén activos
5. Agrega productos a la orden con cantidades

### Caso 3: Actualización de Precios
**Actor**: Administrador
**Flujo**:
1. Admin consulta lista de productos
2. Selecciona producto a actualizar
3. Modifica precio
4. Sistema actualiza y registra fecha de modificación
5. Nuevas órdenes usan el precio actualizado

### Caso 4: Descontinuar Producto
**Actor**: Administrador
**Flujo**:
1. Admin identifica producto a descontinuar
2. Desactiva producto (no elimina)
3. Producto deja de aparecer en catálogo de repartidores
4. Órdenes históricas mantienen referencia al producto

---

## Consideraciones Técnicas

### SKU (Stock Keeping Unit)
- Código único alfanumérico
- Ejemplos: "COCA-355", "PAN-BLANCO-500", "LECHE-1L"
- Inmutable (no se puede cambiar después de crear)
- Usado para escaneo de códigos de barras

### Formato de Precio
- Decimal con 2 decimales
- Almacenado como `Decimal(10, 2)` en base de datos
- Validar que sea mayor a 0
- Ejemplos: 15.50, 100.00, 0.50

### Imágenes de Productos
- URL opcional
- Puede ser URL externa o ruta local
- Validar formato de URL
- Recomendado: 500x500px, formato JPG/PNG

### Soft Delete vs Hard Delete
- **Soft delete**: Cambiar `isActive` a `false`
- **Hard delete**: Solo si no tiene órdenes asociadas
- Mantener historial para reportes

### Búsqueda y Filtros
- Búsqueda por texto: nombre y SKU
- Filtro por estado: activo/inactivo
- Ordenamiento: alfabético, precio, fecha

---

## Validaciones Importantes

### SKU
- Único en el sistema
- Solo alfanumérico y guiones
- 3-50 caracteres
- Convertir a mayúsculas automáticamente

### Precio
- Número positivo (> 0)
- Máximo 2 decimales
- Rango: 0.01 a 99,999,999.99

### Nombre
- Requerido
- 2-200 caracteres
- Trim espacios

### Descripción
- Opcional
- Máximo 1000 caracteres

---

## Próximos Pasos

1. ✅ Crear schemas de validación Zod
2. ✅ Implementar servicios de negocio
3. ✅ Crear controladores HTTP
4. ✅ Definir rutas y middlewares
5. ✅ Integrar en aplicación principal
6. ✅ Realizar pruebas en Postman
7. ✅ Poblar base de datos con productos de ejemplo

---

## Dependencias

- `@prisma/client`: ORM para base de datos
- `zod`: Validación de schemas
- `express`: Framework web
- `jsonwebtoken`: Autenticación (ya implementado)

---

## Testing (Futuro)

### Pruebas Unitarias
- Validaciones de schemas
- Unicidad de SKU
- Cálculos de precio

### Pruebas de Integración
- Endpoints completos
- Búsqueda por SKU
- Filtros y paginación

### Pruebas E2E
- Flujo de creación de orden con productos
- Escaneo de código de barras
- Actualización de precios

---

## Mejoras Futuras (Opcional)

### Categorías de Productos
- Agrupar productos por categoría
- Facilitar navegación en catálogo

### Inventario
- Control de stock por tienda
- Alertas de bajo inventario

### Precios por Tienda
- Precios diferenciados según ubicación
- Promociones especiales

### Imágenes Locales
- Almacenamiento en servidor/S3
- Optimización de imágenes

### Historial de Precios
- Rastrear cambios de precio
- Reportes de variaciones

---

**Documento creado**: 2025-12-05
**Versión**: 1.0
**Estado**: Pendiente de implementación
