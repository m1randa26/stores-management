# Plan de Acción - Gestión de Fotos

## Objetivo

Implementar un módulo completo de gestión de fotos (evidencia fotográfica) que permita a los repartidores subir imágenes durante las visitas a tiendas, almacenarlas localmente o en la nube, y sincronizarlas en modo offline.

---

## Arquitectura del Módulo

```
src/modules/photos/
├── photos.schema.ts      # Validaciones Zod
├── photos.service.ts     # Lógica de negocio
├── photos.controller.ts  # Controladores HTTP
└── photos.routes.ts      # Definición de endpoints

uploads/                  # Carpeta para almacenar fotos localmente
└── photos/
    └── [año]/[mes]/[archivo]
```

---

## Funcionalidades a Implementar

### 1. Schemas de Validación (photos.schema.ts)

#### uploadPhotoSchema
Validación para subir nueva foto:
- `visitId`: string (ID de la visita, requerido)
- `file`: archivo (imagen, requerido)
- `offlineId`: string opcional (UUID generado offline)

**Validaciones de archivo:**
- Tipos permitidos: image/jpeg, image/png, image/webp
- Tamaño máximo: 5MB
- Nombre de archivo sanitizado

---

### 2. Servicios (photos.service.ts)

#### Upload y Gestión

##### uploadPhoto(userId, visitId, file, offlineId?)
- Subir nueva foto asociada a visita
- Validar que la visita exista y pertenezca al usuario
- Validar tipo y tamaño de archivo
- Generar nombre único para evitar colisiones
- Guardar archivo en sistema de archivos local
- Crear registro en base de datos con metadata
- Retornar información de la foto

##### getPhotoById(id, userId?)
- Obtener metadata de foto por ID
- Si userId proporcionado (REPARTIDOR), validar propiedad
- Incluir información de visita
- Retornar error 404 si no existe

##### getVisitPhotos(visitId, userId?)
- Obtener todas las fotos de una visita
- Validar que la visita pertenezca al usuario (si REPARTIDOR)
- Ordenar por fecha de carga
- Retornar lista de fotos con URLs

##### deletePhoto(id, userId?)
- Eliminar foto (soft delete o hard delete)
- Validar propiedad si es REPARTIDOR
- Eliminar archivo del sistema
- Eliminar registro de base de datos
- Retornar confirmación

##### syncOfflinePhoto(userId, data, file)
- Sincronizar foto creada offline
- Validar que no exista duplicado por offlineId
- Guardar archivo y crear registro
- Marcar como sincronizada
- Retornar foto sincronizada

##### servePhoto(filename, userId?)
- Servir archivo de foto
- Validar permisos de acceso
- Retornar stream de archivo
- Manejar errores 404

---

### 3. Controladores (photos.controller.ts)

Funciones que manejan las peticiones HTTP multipart/form-data.

#### uploadPhotoController
- Procesar multipart/form-data
- Extraer archivo del request
- Validar archivo
- Llamar servicio uploadPhoto
- Retornar 201 con metadata

#### getPhotoByIdController
- Extraer ID de params
- Llamar servicio getPhotoById
- Retornar 200 con metadata

#### getVisitPhotosController
- Extraer visitId de params
- Llamar servicio getVisitPhotos
- Retornar 200 con lista

#### deletePhotoController
- Extraer ID de params
- Llamar servicio deletePhoto
- Retornar 200 con confirmación

#### syncOfflinePhotoController
- Procesar multipart/form-data offline
- Llamar servicio syncOfflinePhoto
- Retornar 201 con foto sincronizada

#### servePhotoController
- Extraer filename de params
- Validar permisos
- Servir archivo con sendFile
- Retornar 404 si no existe

---

### 4. Rutas (photos.routes.ts)

#### Endpoints Protegidos (REPARTIDOR autenticado)
```
POST   /api/photos                    # Subir nueva foto
GET    /api/photos/:id                # Ver metadata de foto
GET    /api/photos/visit/:visitId     # Fotos de una visita
DELETE /api/photos/:id                # Eliminar foto
POST   /api/photos/sync               # Sincronizar foto offline
GET    /api/photos/file/:filename     # Servir archivo de foto
```

#### Endpoints Admin (solo ADMIN)
```
GET    /api/photos                    # Listar todas las fotos
DELETE /api/photos/:id                # Eliminar cualquier foto
```

---

## Flujos de Operación

### Flujo 1: Subir Foto Durante Visita (REPARTIDOR)

1. **Escenario**: Repartidor toma foto de evidencia en tienda

2. **Request**: Repartidor envía POST multipart/form-data
   ```
   POST /api/photos
   Headers:
     Authorization: Bearer <token>
     Content-Type: multipart/form-data

   Form Data:
     visitId: "clxxx..."
     photo: [archivo binario]
   ```

3. **Validaciones**:
   - Verifica que la visita exista
   - Verifica que la visita pertenezca al usuario
   - Valida tipo MIME (image/jpeg, image/png, image/webp)
   - Valida tamaño (≤ 5MB)

4. **Procesamiento**:
   - Genera nombre único: `{timestamp}-{random}.{ext}`
   - Guarda en: `uploads/photos/2025/12/1733432400000-abc123.jpg`
   - Crea registro en DB

5. **Response**: Retorna metadata (201)
   ```json
   {
     "success": true,
     "message": "Photo uploaded successfully",
     "data": {
       "id": "clphoto123...",
       "visitId": "clxxx...",
       "url": "/api/photos/file/2025/12/1733432400000-abc123.jpg",
       "filename": "1733432400000-abc123.jpg",
       "size": 524288,
       "mimeType": "image/jpeg",
       "uploadedAt": "2025-12-05T12:00:00Z"
     }
   }
   ```

---

### Flujo 2: Ver Fotos de una Visita (REPARTIDOR)

1. **Request**: Repartidor solicita fotos de visita
   ```
   GET /api/photos/visit/clxxx...
   Authorization: Bearer <token>
   ```

2. **Búsqueda**:
   - Sistema filtra fotos por visitId
   - Verifica que la visita pertenezca al usuario
   - Genera URLs para cada foto

3. **Response**: Retorna lista (200)
   ```json
   {
     "success": true,
     "data": [
       {
         "id": "clphoto1...",
         "url": "/api/photos/file/2025/12/1733432400000-abc123.jpg",
         "filename": "1733432400000-abc123.jpg",
         "size": 524288,
         "mimeType": "image/jpeg",
         "uploadedAt": "2025-12-05T12:00:00Z"
       },
       {
         "id": "clphoto2...",
         "url": "/api/photos/file/2025/12/1733432401000-def456.jpg",
         "filename": "1733432401000-def456.jpg",
         "size": 612352,
         "mimeType": "image/jpeg",
         "uploadedAt": "2025-12-05T12:01:00Z"
       }
     ],
     "total": 2
   }
   ```

---

### Flujo 3: Servir Archivo de Foto

1. **Request**: Frontend solicita imagen
   ```
   GET /api/photos/file/2025/12/1733432400000-abc123.jpg
   Authorization: Bearer <token>
   ```

2. **Validación**:
   - Verifica que el archivo exista
   - Valida permisos de acceso

3. **Response**: Stream de archivo (200)
   - Content-Type: image/jpeg
   - Cache headers apropiados
   - Archivo binario

---

### Flujo 4: Sincronización Offline

1. **Escenario**: Repartidor tomó fotos sin conexión

2. **Request**: App sincroniza fotos
   ```
   POST /api/photos/sync
   Headers:
     Authorization: Bearer <token>
     Content-Type: multipart/form-data

   Form Data:
     visitId: "clxxx..."
     photo: [archivo]
     uploadedAt: "2025-12-05T10:00:00Z"
     offlineId: "offline-photo-uuid-789"
   ```

3. **Validaciones**:
   - Verifica que no exista foto con ese offlineId
   - Valida visita y permisos

4. **Sincronización**:
   - Guarda archivo con fecha original
   - Marca syncedAt actual
   - Preserva uploadedAt original

5. **Response**: Retorna foto sincronizada (201)
   ```json
   {
     "success": true,
     "message": "Photo synced successfully",
     "data": {
       "id": "clphoto456...",
       "uploadedAt": "2025-12-05T10:00:00Z",
       "syncedAt": "2025-12-05T16:00:00Z",
       "offlineId": "offline-photo-uuid-789"
     }
   }
   ```

---

## Seguridad y Permisos

| Operación | REPARTIDOR | ADMIN |
|-----------|------------|-------|
| Subir foto | ✅ (solo en sus visitas) | ✅ |
| Ver fotos de visita | ✅ (solo propias) | ✅ (todas) |
| Ver foto específica | ✅ (solo propias) | ✅ (todas) |
| Eliminar foto | ✅ (solo propias) | ✅ (todas) |
| Sincronizar offline | ✅ | ✅ |
| Servir archivo | ✅ (solo propias) | ✅ (todas) |

---

## Manejo de Errores

### Errores de Validación (400)
```json
{
  "success": false,
  "message": "Invalid file type. Allowed: jpeg, png, webp"
}
```

```json
{
  "success": false,
  "message": "File too large. Maximum size: 5MB"
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
  "message": "You cannot upload photos for this visit"
}
```

### No Encontrado (404)
```json
{
  "success": false,
  "message": "Photo not found"
}
```

```json
{
  "success": false,
  "message": "Visit not found"
}
```

### Conflicto (409)
```json
{
  "success": false,
  "message": "Photo with this offline ID already synced"
}
```

### Archivo Muy Grande (413)
```json
{
  "success": false,
  "message": "File size exceeds maximum limit of 5MB"
}
```

---

## Modelo de Datos

### Photo (Prisma Schema)
```prisma
model Photo {
  id            String    @id @default(cuid())
  visitId       String
  url           String    // URL relativa
  filename      String    // Nombre único del archivo
  size          Int       // Tamaño en bytes
  mimeType      String    // image/jpeg, image/png, etc.
  uploadedAt    DateTime  @default(now())
  syncedAt      DateTime?
  offlineId     String?   @unique

  visit         Visit     @relation(fields: [visitId], references: [id])
}
```

---

## Consideraciones Técnicas

### Almacenamiento de Archivos

**Estructura de Carpetas:**
```
uploads/
└── photos/
    └── 2025/
        └── 12/
            ├── 1733432400000-abc123.jpg
            ├── 1733432401000-def456.png
            └── ...
```

**Beneficios:**
- Organización por fecha
- Evita directorios con miles de archivos
- Fácil limpieza de archivos antiguos

**Generación de Nombre Único:**
```javascript
const timestamp = Date.now();
const randomStr = crypto.randomBytes(8).toString('hex');
const ext = path.extname(originalname);
const filename = `${timestamp}-${randomStr}${ext}`;
```

### Validación de Archivos

**MIME Types Permitidos:**
- `image/jpeg` - .jpg, .jpeg
- `image/png` - .png
- `image/webp` - .webp

**Tamaño Máximo:** 5MB (5 * 1024 * 1024 bytes)

**Validación en Código:**
```javascript
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

if (!ALLOWED_MIMES.includes(file.mimetype)) {
  throw new Error('Invalid file type');
}

if (file.size > MAX_SIZE) {
  throw new Error('File too large');
}
```

### Middleware Multer

**Configuración:**
```javascript
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dir = `uploads/photos/${year}/${month}`;

    // Crear directorio si no existe
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${random}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
```

### Servir Archivos

**Opciones:**

1. **Opción 1: Express sendFile**
   ```javascript
   res.sendFile(absolutePath, { root: '.' });
   ```

2. **Opción 2: Stream**
   ```javascript
   const stream = fs.createReadStream(filePath);
   stream.pipe(res);
   ```

3. **Opción 3: Servidor estático** (menos recomendado por seguridad)
   ```javascript
   app.use('/uploads', express.static('uploads'));
   ```

**Recomendación:** Usar opción 1 con validación de permisos.

### URLs de Fotos

**Formato:**
```
/api/photos/file/{year}/{month}/{filename}
```

**Ejemplo:**
```
/api/photos/file/2025/12/1733432400000-abc123.jpg
```

### Modo Offline

**Offline ID:**
- UUID v4 generado en cliente
- Ejemplo: `offline-photo-550e8400-e29b-41d4`
- Previene duplicados al sincronizar

**Timestamps:**
- `uploadedAt`: Fecha/hora real de la foto (puede ser pasada)
- `syncedAt`: Fecha/hora de sincronización

### Optimización de Imágenes (Opcional)

**Librerías:**
- `sharp`: Redimensionar y optimizar imágenes
- `imagemin`: Comprimir imágenes

**Ejemplo con sharp:**
```javascript
import sharp from 'sharp';

await sharp(inputPath)
  .resize(1920, 1080, { fit: 'inside' })
  .jpeg({ quality: 85 })
  .toFile(outputPath);
```

---

## Casos de Uso

### Caso 1: Evidencia de Visita
**Actor**: Repartidor
**Flujo**:
1. Repartidor llega a tienda
2. Registra visita
3. Toma foto del exterior de la tienda
4. Toma foto del mostrador
5. Toma foto del inventario
6. Sistema guarda 3 fotos asociadas a la visita
7. Admin puede revisar evidencia

### Caso 2: Modo Offline
**Actor**: Repartidor sin conexión
**Flujo**:
1. Repartidor trabaja sin internet
2. Toma fotos en cada visita
3. Fotos se guardan localmente con offlineId
4. Al recuperar conexión
5. App sincroniza fotos automáticamente
6. Sistema valida y guarda en servidor

### Caso 3: Revisión de Evidencia (ADMIN)
**Actor**: Administrador
**Flujo**:
1. Admin consulta visita específica
2. Ve lista de fotos asociadas
3. Click en foto para ver en tamaño completo
4. Verifica que la evidencia sea válida
5. Aprueba o rechaza visita

---

## Índices de Base de Datos Recomendados

```prisma
@@index([visitId])
@@index([offlineId])
@@index([uploadedAt])
```

---

## Próximos Pasos

1. ✅ Instalar dependencia multer
2. ✅ Crear carpeta uploads/photos
3. ✅ Crear schemas de validación
4. ✅ Implementar servicios con multer
5. ✅ Crear controladores multipart
6. ✅ Definir rutas con middleware upload
7. ✅ Integrar en aplicación
8. ✅ Probar upload en Postman

---

## Dependencias

- `multer`: Middleware para multipart/form-data
- `@types/multer`: Tipos TypeScript para multer
- `sharp` (opcional): Optimización de imágenes
- `@prisma/client`: ORM
- `zod`: Validación
- `express`: Framework web

---

## Testing (Futuro)

### Pruebas Unitarias
- Validación de tipos MIME
- Validación de tamaño
- Generación de nombres únicos

### Pruebas de Integración
- Upload de foto completo
- Servir archivo
- Sincronización offline
- Eliminación de foto

### Pruebas E2E
- Flujo completo: Visita → Upload → Ver → Eliminar
- Modo offline y sincronización

---

## Mejoras Futuras (Opcional)

### Compresión Automática
- Redimensionar imágenes grandes
- Comprimir para reducir tamaño
- Generar thumbnails

### Almacenamiento en Nube
- S3 / CloudStorage
- CDN para servir imágenes
- Backup automático

### Reconocimiento de Imagen
- OCR para extraer texto
- Detección de productos
- Validación automática

### Marca de Agua
- Agregar fecha y ubicación
- Logo de la empresa
- Metadata visual

---

**Documento creado**: 2025-12-05
**Versión**: 1.0
**Estado**: Pendiente de implementación
