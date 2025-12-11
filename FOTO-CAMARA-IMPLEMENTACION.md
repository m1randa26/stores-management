# Mejoras al Módulo de Fotos - Captura con Cámara

## 📋 Resumen de Cambios

Se ha **agregado** la funcionalidad de captura de fotos usando la cámara del dispositivo **SIN MODIFICAR** el comportamiento existente de selección de archivos.

---

## ✨ Nueva Funcionalidad Agregada

### **Captura de Foto con Cámara del Dispositivo**

#### Características Implementadas:

1. **Botón "Usar Cámara"** (nuevo)
   - Color verde distintivo
   - Icono de cámara
   - Se ubica junto al botón existente "Seleccionar Archivos"

2. **Vista de Cámara en Tiempo Real**
   - Stream de video en vivo
   - Recuadro guía para encuadre del stand
   - Preview en tiempo real
   - Diseño responsivo (aspect-ratio 16:9)

3. **Botón "Capturar Foto"**
   - Botón verde grande y destacado
   - Captura frame actual del video
   - Convierte a archivo JPEG (calidad 90%)
   - Genera nombre único: `captura-{timestamp}.jpg`

4. **Gestión de Permisos**
   - Solicita acceso a la cámara
   - Manejo de errores específicos:
     - Permiso denegado
     - Cámara no encontrada
     - Cámara en uso por otra app
   - Botón "Intentar nuevamente"

5. **Validaciones Automáticas**
   - Valida tipo de archivo (JPEG)
   - Valida tamaño (≤ 5MB)
   - Respeta límite de 3 fotos por visita
   - Detiene cámara automáticamente después de capturar

6. **Limpieza de Recursos**
   - Detiene stream al cerrar modal
   - Detiene stream al desmontar componente
   - Libera MediaStream correctamente

---

## 🔧 Comportamiento Original PRESERVADO

### **Funcionalidad Existente (NO modificada):**

✅ **Botón "Seleccionar Archivos"**
- Sigue funcionando igual
- Permite seleccionar múltiples archivos
- Abre explorador de archivos del sistema

✅ **Subida de Archivos**
- Validaciones originales intactas
- Límite de 3 fotos por visita
- Límite de 5MB por foto
- Formatos: JPEG, PNG, WebP

✅ **Previews de Imágenes**
- Vista previa de archivos seleccionados
- Descripción opcional por foto
- Botón eliminar por foto

✅ **Progreso de Subida**
- Barra de progreso
- Contador de fotos subidas
- Toast de confirmación

✅ **Modo Offline**
- Sincronización automática
- Almacenamiento en IndexedDB

---

## 📱 Flujo de Uso - Captura con Cámara

### **Paso 1: Acceder al Modal de Fotos**
```
Repartidor → Visitas → "Subir Fotos"
```

### **Paso 2: Activar Cámara**
```
Presionar botón "Usar Cámara" (verde)
↓
Navegador solicita permisos de cámara
↓
Aceptar permisos
↓
Vista de cámara se activa
```

### **Paso 3: Capturar Foto**
```
Ver preview en tiempo real
↓
Posicionar stand dentro del recuadro guía
↓
Presionar "Capturar Foto" (botón verde grande)
↓
Foto se captura y agrega a la lista
↓
Cámara se detiene automáticamente
```

### **Paso 4: Subir Foto**
```
Foto aparece en lista de previews
↓
(Opcional) Agregar descripción
↓
Presionar "Subir X foto(s)"
↓
Foto se envía al servidor
```

---

## 🎯 Configuración de Cámara

### **Parámetros MediaDevices:**
```javascript
{
  video: {
    facingMode: 'environment', // Cámara trasera en móviles
    width: { ideal: 1920 },    // 1920px ancho
    height: { ideal: 1080 }    // 1080px alto
  },
  audio: false                 // Sin audio
}
```

### **Calidad de Captura:**
- Formato: JPEG
- Calidad: 90%
- Resolución: Según capacidad de la cámara (ideal 1920x1080)

---

## 🔐 Seguridad y Permisos

### **Permisos Requeridos:**
- **Camera**: Para acceder a la cámara del dispositivo

### **Manejo de Errores:**

| Error | Causa | Mensaje |
|-------|-------|---------|
| `NotAllowedError` | Usuario denegó permisos | "Permiso de cámara denegado..." |
| `NotFoundError` | No hay cámara en dispositivo | "No se encontró ninguna cámara..." |
| `NotReadableError` | Cámara en uso | "La cámara está siendo usada..." |
| Genérico | Otro error | "Error al acceder a la cámara..." |

### **Validaciones:**
- ✅ Tipo MIME: `image/jpeg`
- ✅ Tamaño: ≤ 5MB
- ✅ Límite: 3 fotos por visita
- ✅ Stream se detiene al capturar
- ✅ Stream se detiene al cerrar modal

---

## 🖥️ Compatibilidad

### **Navegadores Soportados:**
- ✅ Chrome 53+ (Desktop y Android)
- ✅ Firefox 36+ (Desktop y Android)
- ✅ Safari 11+ (Desktop y iOS)
- ✅ Edge 79+
- ✅ Opera 40+

### **Dispositivos:**
- ✅ Desktop (webcam)
- ✅ Smartphones (cámara frontal/trasera)
- ✅ Tablets
- ❌ Dispositivos sin cámara (muestra error)

### **API Requerida:**
- `navigator.mediaDevices.getUserMedia()` (MediaDevices API)
- HTML5 `<video>` y `<canvas>`

---

## 🎨 Interfaz de Usuario

### **Componentes Agregados:**

#### 1. **Botón "Usar Cámara"** (nuevo)
```jsx
<button className="bg-green-600 hover:bg-green-700">
  <CameraIcon />
  Usar Cámara
</button>
```

#### 2. **Vista de Cámara**
```jsx
<div className="relative bg-black rounded-lg aspect-video">
  <video ref={videoRef} autoPlay playsInline muted />
  {/* Recuadro guía */}
  <div className="border-2 border-white/50"></div>
</div>
```

#### 3. **Botones de Control**
```jsx
<button onClick={stopCamera}>Cancelar</button>
<button onClick={capturePhoto}>Capturar Foto</button>
```

### **Estados Visuales:**

| Estado | Vista |
|--------|-------|
| Inicial | Dos botones: "Seleccionar Archivos" + "Usar Cámara" |
| Cámara activa | Stream de video + botones "Cancelar" / "Capturar" |
| Foto capturada | Se agrega a lista de previews + cámara se detiene |
| Error cámara | Mensaje de error + botón "Intentar nuevamente" |

---

## 📊 Comparación: Antes vs Después

### **ANTES (Comportamiento Original):**
```
┌─────────────────────────────────┐
│  Seleccionar fotos              │
│  [Agregar Fotos] 0 foto(s)      │
│  Formatos: JPEG, PNG, WebP      │
└─────────────────────────────────┘
```

### **DESPUÉS (Con Nueva Funcionalidad):**
```
┌──────────────────────────────────────────┐
│  Agregar fotos del stand                 │
│  [Seleccionar Archivos] [Usar Cámara]   │
│  0 foto(s) seleccionada(s)               │
│  Formatos: JPEG, PNG, WebP               │
└──────────────────────────────────────────┘
```

---

## 🧪 Casos de Prueba

### **Caso 1: Captura Exitosa**
```
Precondiciones:
- Dispositivo con cámara
- Permisos otorgados
- Menos de 3 fotos en visita

Pasos:
1. Abrir modal de fotos
2. Presionar "Usar Cámara"
3. Aceptar permisos
4. Posicionar stand
5. Presionar "Capturar Foto"

Resultado Esperado:
✅ Foto aparece en lista de previews
✅ Cámara se detiene
✅ Toast: "✅ Foto capturada exitosamente"
✅ Archivo generado: captura-{timestamp}.jpg
```

### **Caso 2: Permisos Denegados**
```
Pasos:
1. Presionar "Usar Cámara"
2. Denegar permisos en navegador

Resultado Esperado:
❌ Mensaje: "Permiso de cámara denegado..."
❌ Botón "Intentar nuevamente"
❌ Cámara no se activa
```

### **Caso 3: Sin Cámara**
```
Precondiciones:
- Dispositivo sin cámara

Pasos:
1. Presionar "Usar Cámara"

Resultado Esperado:
❌ Mensaje: "No se encontró ninguna cámara..."
❌ Botón "Intentar nuevamente"
```

### **Caso 4: Límite de Fotos Alcanzado**
```
Precondiciones:
- 3 fotos ya subidas

Pasos:
1. Presionar "Usar Cámara"
2. Capturar foto

Resultado Esperado:
❌ Error: "Ya alcanzaste el límite de 3 fotos..."
❌ Foto no se agrega
```

### **Caso 5: Cancelar Cámara**
```
Pasos:
1. Presionar "Usar Cámara"
2. Cámara se activa
3. Presionar "Cancelar"

Resultado Esperado:
✅ Cámara se detiene
✅ Vuelve a vista inicial con botones
✅ Stream liberado correctamente
```

---

## 🔍 Detalles Técnicos

### **Código Agregado:**

#### **Estados Nuevos:**
```javascript
const [isCameraActive, setIsCameraActive] = useState(false)
const [cameraError, setCameraError] = useState('')
const [mediaStream, setMediaStream] = useState(null)
const videoRef = useRef(null)
const canvasRef = useRef(null)
```

#### **Funciones Principales:**

##### `startCamera()`
- Solicita `getUserMedia()`
- Configuración: cámara trasera, 1920x1080
- Asigna stream al elemento `<video>`
- Manejo de errores específicos

##### `stopCamera()`
- Detiene todos los tracks del MediaStream
- Limpia referencias
- Cambia estado a inactivo

##### `capturePhoto()`
- Dibuja frame actual en `<canvas>`
- Convierte canvas a Blob (JPEG, 90%)
- Crea File con nombre único
- Valida y agrega a lista
- Detiene cámara automáticamente

---

## 📝 Archivos Modificados

### **c:\Users\jim_j\Desktop\actual\abarrotes-management\client\src\components\PhotoUploadModal.jsx**

**Cambios realizados:**
1. ✅ Agregados nuevos estados para cámara
2. ✅ Agregadas funciones `startCamera()`, `stopCamera()`, `capturePhoto()`
3. ✅ Agregado cleanup en useEffect para detener cámara
4. ✅ Modificada UI para incluir botón "Usar Cámara"
5. ✅ Agregada vista de cámara con video preview
6. ✅ Agregados controles de captura
7. ✅ Agregado manejo de errores de cámara

**Líneas de código agregadas:** ~200
**Comportamiento original modificado:** ❌ Ninguno
**Nuevas funcionalidades:** ✅ Captura con cámara

---

## 🚀 Ventajas de la Implementación

### **Para el Usuario:**
1. ✅ Captura rápida sin salir de la app
2. ✅ No necesita gestionar archivos
3. ✅ Preview en tiempo real
4. ✅ Recuadro guía para mejor encuadre
5. ✅ Calidad ajustada automáticamente

### **Para el Sistema:**
1. ✅ Sin cambios en backend
2. ✅ Usa la misma API de subida
3. ✅ Compatible con modo offline
4. ✅ Validaciones consistentes
5. ✅ No requiere plugins externos

### **Técnicas:**
1. ✅ Código modular y reutilizable
2. ✅ Limpieza de recursos automática
3. ✅ Manejo robusto de errores
4. ✅ Compatible con todos los navegadores modernos
5. ✅ No rompe funcionalidad existente

---

## 📚 Referencias

### **APIs Utilizadas:**
- [MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [HTMLVideoElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement)
- [HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)
- [File API](https://developer.mozilla.org/en-US/docs/Web/API/File)

### **Documentación:**
- [Using the Camera](https://web.dev/media-capturing-images/)
- [Media Capture and Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API)

---

## ✅ Checklist de Verificación

- [x] Funcionalidad de cámara agregada
- [x] Botón "Usar Cámara" visible
- [x] Preview de video funcional
- [x] Captura de foto funcional
- [x] Validaciones aplicadas
- [x] Límite de fotos respetado
- [x] Limpieza de recursos implementada
- [x] Manejo de errores completo
- [x] Comportamiento original preservado
- [x] Compatible con móviles y desktop
- [x] Funciona con modo offline
- [x] No requiere cambios en backend

---

## 🎯 Próximos Pasos (Opcional)

### **Mejoras Futuras Sugeridas:**

1. **Cambiar entre cámaras**
   - Botón para alternar frontal/trasera
   - Útil en tablets y smartphones

2. **Zoom digital**
   - Controles de zoom in/out
   - Mejor encuadre de stands

3. **Flash/Linterna**
   - Activar flash en móviles
   - Útil en lugares con poca luz

4. **Filtros básicos**
   - Brillo/Contraste
   - Mejora automática de imagen

5. **Múltiples capturas**
   - Capturar varias fotos sin cerrar cámara
   - Modo ráfaga

6. **Indicador de calidad**
   - Mostrar resolución actual
   - Advertir si es muy baja

---

**Fecha de Implementación:** Diciembre 11, 2025  
**Desarrollador:** Jorge Isaac  
**Branch:** feat/stand-pictures  
**Estado:** ✅ Completado

---

## 📞 Soporte

Si tienes problemas con la cámara:
1. Verifica permisos del navegador
2. Prueba en otro navegador
3. Reinicia el dispositivo
4. Usa "Seleccionar Archivos" como alternativa

---

**FIN DEL DOCUMENTO**
