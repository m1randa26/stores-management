# Plan de Implementación: Escáner QR en la Aplicación

## 📋 Resumen Ejecutivo

Implementar la funcionalidad de escaneo de códigos QR directamente dentro de la aplicación del repartidor, permitiendo identificar tiendas asignadas y realizar acciones (registrar visita, crear orden) incluso en modo offline.

---

## 🎯 Objetivos

1. **Escaneo nativo**: Usar la cámara del dispositivo para escanear códigos QR desde la app
2. **Validación local**: Verificar que la tienda escaneada esté en las asignaciones del repartidor
3. **Modo offline**: Cachear tiendas asignadas en IndexedDB para funcionamiento sin conexión
4. **UX fluida**: Experiencia integrada sin salir de la aplicación

---

## 📐 Arquitectura de la Solución

```
┌─────────────────────────────────────────────────────────────────┐
│                    RepartidorDashboard                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Asignaciones│  │   Visitas   │  │   Órdenes   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │     [📷 Escanear QR]  (Botón nuevo)     │                   │
│  └─────────────────────────────────────────┘                   │
│                      │                                          │
│                      ▼                                          │
│  ┌─────────────────────────────────────────┐                   │
│  │         QRScannerModal                   │                   │
│  │  ┌───────────────────────────────────┐  │                   │
│  │  │                                   │  │                   │
│  │  │         Visor de Cámara           │  │                   │
│  │  │         (html5-qrcode)            │  │                   │
│  │  │                                   │  │                   │
│  │  └───────────────────────────────────┘  │                   │
│  │  [Cancelar]                             │                   │
│  └─────────────────────────────────────────┘                   │
│                      │                                          │
│                      ▼                                          │
│  ┌─────────────────────────────────────────┐                   │
│  │    Validación contra cache local        │                   │
│  │    (IndexedDB: tiendas asignadas)       │                   │
│  └─────────────────────────────────────────┘                   │
│                      │                                          │
│           ┌─────────┴─────────┐                                │
│           ▼                   ▼                                │
│    ┌──────────────┐   ┌──────────────┐                        │
│    │  ✅ Tienda   │   │  ❌ Tienda   │                        │
│    │  encontrada  │   │  no asignada │                        │
│    └──────────────┘   └──────────────┘                        │
│           │                   │                                │
│           ▼                   ▼                                │
│  ┌─────────────────┐  ┌─────────────────┐                     │
│  │ StoreInfoModal  │  │  Toast de error │                     │
│  │ + Registrar     │  │  "Tienda no     │                     │
│  │   Visita        │  │   asignada"     │                     │
│  └─────────────────┘  └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Estructura de Archivos

### Archivos a Crear

```
client/src/
├── components/
│   └── QRScannerModal.jsx       # Modal con escáner de cámara
├── services/
│   └── offlineStoreService.js   # Servicio para cache de tiendas
└── hooks/
    └── useQRScanner.js          # Hook para lógica del escáner (opcional)
```

### Archivos a Modificar

```
client/src/
├── pages/
│   └── RepartidorDashboard.jsx  # Agregar botón y lógica de escaneo
├── services/
│   └── offlineDB.js             # Agregar store para tiendas cacheadas
└── package.json                 # Agregar dependencia html5-qrcode
```

---

## 📦 Dependencias

### Librería de Escaneo QR

```bash
npm install html5-qrcode
```

**¿Por qué `html5-qrcode`?**
- ✅ Soporta cámara trasera y frontal
- ✅ Funciona en PWA
- ✅ No requiere backend para decodificar
- ✅ Compatible con iOS y Android
- ✅ Manejo de permisos integrado
- ✅ Tamaño pequeño (~50KB)

---

## 🔧 Implementación Detallada

### Fase 1: Cache de Tiendas Asignadas

#### 1.1 Actualizar `offlineDB.js`

Agregar un nuevo object store para tiendas asignadas:

```javascript
// offlineDB.js - Agregar nuevo store

const DB_NAME = 'abarrotes-offline-db'
const DB_VERSION = 2  // Incrementar versión

const STORES = {
  PENDING_VISITS: 'pendingVisits',
  PENDING_ORDERS: 'pendingOrders', 
  PENDING_PHOTOS: 'pendingPhotos',
  ASSIGNED_STORES: 'assignedStores'  // NUEVO
}

// En la función de upgrade:
if (!db.objectStoreNames.contains(STORES.ASSIGNED_STORES)) {
  const storesStore = db.createObjectStore(STORES.ASSIGNED_STORES, { keyPath: 'id' })
  storesStore.createIndex('qrCode', 'qrCode', { unique: true })
}
```

#### 1.2 Crear `offlineStoreService.js`

```javascript
// services/offlineStoreService.js

import { openDB } from './offlineDB'

const STORE_NAME = 'assignedStores'

/**
 * Guardar tiendas asignadas en cache
 */
export const cacheAssignedStores = async (stores) => {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  
  // Limpiar cache anterior
  await store.clear()
  
  // Guardar nuevas tiendas
  for (const tienda of stores) {
    await store.put({
      ...tienda,
      cachedAt: new Date().toISOString()
    })
  }
  
  await tx.done
  console.log(`✅ ${stores.length} tiendas cacheadas`)
}

/**
 * Obtener todas las tiendas cacheadas
 */
export const getCachedStores = async () => {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  return await store.getAll()
}

/**
 * Buscar tienda por código QR
 */
export const findStoreByQRCode = async (qrCode) => {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const index = store.index('qrCode')
  return await index.get(qrCode)
}

/**
 * Verificar si hay tiendas en cache
 */
export const hasCachedStores = async () => {
  const stores = await getCachedStores()
  return stores.length > 0
}
```

#### 1.3 Modificar `RepartidorDashboard.jsx` - Cache automático

```javascript
// En fetchTiendasAsignadas, después de obtener las tiendas:

import { cacheAssignedStores } from '../services/offlineStoreService'

const fetchTiendasAsignadas = async () => {
  try {
    setIsLoadingTiendas(true)
    const response = await storeService.getStores()
    
    const tiendasAsignadas = response.data.filter(tienda =>
      tienda.assignments?.some(a => a.userId === user?.id)
    )
    
    setTiendas(tiendasAsignadas)
    
    // NUEVO: Cachear tiendas para modo offline
    await cacheAssignedStores(tiendasAsignadas)
    
  } catch (error) {
    // Si falla la red, intentar cargar desde cache
    const cachedStores = await getCachedStores()
    if (cachedStores.length > 0) {
      setTiendas(cachedStores)
      setErrorTiendas('Mostrando datos offline')
    } else {
      setErrorTiendas(error.message)
    }
  } finally {
    setIsLoadingTiendas(false)
  }
}
```

---

### Fase 2: Componente QRScannerModal

#### 2.1 Crear `QRScannerModal.jsx`

```jsx
// components/QRScannerModal.jsx

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

function QRScannerModal({ isOpen, onClose, onScan }) {
  const [error, setError] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)

  useEffect(() => {
    if (isOpen && !isScanning) {
      startScanner()
    }
    
    return () => {
      stopScanner()
    }
  }, [isOpen])

  const startScanner = async () => {
    try {
      setError('')
      setIsScanning(true)
      
      html5QrCodeRef.current = new Html5Qrcode('qr-reader')
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      }
      
      await html5QrCodeRef.current.start(
        { facingMode: 'environment' }, // Cámara trasera
        config,
        handleScanSuccess,
        handleScanError
      )
    } catch (err) {
      console.error('Error al iniciar escáner:', err)
      setError(getErrorMessage(err))
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current?.isScanning) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
      } catch (err) {
        console.error('Error al detener escáner:', err)
      }
    }
    setIsScanning(false)
  }

  const handleScanSuccess = async (decodedText) => {
    // Vibrar si está disponible
    if (navigator.vibrate) {
      navigator.vibrate(200)
    }
    
    // Detener escáner antes de procesar
    await stopScanner()
    
    // Extraer el código QR del URL escaneado
    // Formato esperado: https://domain.com/stores/scan/{qrCode}
    const qrCode = extractQRCode(decodedText)
    
    if (qrCode) {
      onScan(qrCode)
    } else {
      setError('Código QR no válido')
      // Reiniciar escáner después de error
      setTimeout(() => startScanner(), 2000)
    }
  }

  const handleScanError = (errorMessage) => {
    // Ignorar errores de "no QR found" (son normales mientras busca)
    if (!errorMessage.includes('No QR code found')) {
      console.warn('Error de escaneo:', errorMessage)
    }
  }

  const extractQRCode = (text) => {
    // Si es un URL, extraer el último segmento
    if (text.includes('/stores/scan/')) {
      const parts = text.split('/stores/scan/')
      return parts[1]?.split('?')[0] // Remover query params si hay
    }
    // Si ya es solo el código (UUID)
    if (text.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return text
    }
    return null
  }

  const getErrorMessage = (err) => {
    if (err.name === 'NotAllowedError') {
      return 'Permiso de cámara denegado. Por favor, permite el acceso a la cámara.'
    }
    if (err.name === 'NotFoundError') {
      return 'No se encontró ninguna cámara en el dispositivo.'
    }
    if (err.name === 'NotReadableError') {
      return 'La cámara está siendo usada por otra aplicación.'
    }
    return 'Error al acceder a la cámara. Intenta de nuevo.'
  }

  const handleClose = async () => {
    await stopScanner()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" 
                />
              </svg>
              Escanear Código QR
            </h2>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scanner Area */}
        <div className="p-4">
          <div 
            id="qr-reader" 
            ref={scannerRef}
            className="w-full aspect-square bg-gray-900 rounded-lg overflow-hidden"
          />
          
          {/* Instrucciones */}
          <p className="text-center text-gray-600 mt-4 text-sm">
            Apunta la cámara al código QR de la tienda
          </p>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          {/* Loading */}
          {!isScanning && !error && (
            <div className="mt-4 flex items-center justify-center gap-2 text-gray-500">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Iniciando cámara...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={handleClose}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default QRScannerModal
```

---

### Fase 3: Integración en Dashboard

#### 3.1 Modificar `AsignacionesTab`

```jsx
// En RepartidorDashboard.jsx - AsignacionesTab

import QRScannerModal from '../components/QRScannerModal'
import { findStoreByQRCode } from '../services/offlineStoreService'

function AsignacionesTab({ tiendas, isLoading, error, onReload, onVisitRegistered, onOrderCreated }) {
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false)
  const [isPedidoModalOpen, setIsPedidoModalOpen] = useState(false)
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)  // NUEVO
  const [selectedTienda, setSelectedTienda] = useState(null)
  const [currentVisita, setCurrentVisita] = useState(null)
  const [scanError, setScanError] = useState('')  // NUEVO

  // NUEVO: Manejar escaneo de QR
  const handleQRScan = async (qrCode) => {
    setScanError('')
    
    // Buscar en cache local primero
    let tienda = await findStoreByQRCode(qrCode)
    
    // Si no está en cache, buscar en el array actual
    if (!tienda) {
      tienda = tiendas.find(t => t.qrCode === qrCode)
    }
    
    if (tienda) {
      setSelectedTienda(tienda)
      setIsQRScannerOpen(false)
      setIsVisitModalOpen(true)
    } else {
      setScanError('Esta tienda no está asignada a tu ruta')
      // El modal de error se mostrará como Toast
      setTimeout(() => setScanError(''), 3000)
    }
  }

  return (
    <div>
      {/* NUEVO: Modal de escáner QR */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScan={handleQRScan}
      />

      {/* Toast de error de escaneo */}
      {scanError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-red-600 text-white rounded-lg shadow-lg">
          {scanError}
        </div>
      )}

      {/* ... resto de modales existentes ... */}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Mis Tiendas Asignadas</h2>
        <div className="flex items-center gap-2">
          {/* NUEVO: Botón de escanear QR */}
          <button
            onClick={() => setIsQRScannerOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" 
              />
            </svg>
            <span className="hidden sm:inline">Escanear QR</span>
          </button>
          
          <button
            onClick={onReload}
            className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {/* ... botón actualizar existente ... */}
          </button>
        </div>
      </div>

      {/* ... resto del componente ... */}
    </div>
  )
}
```

---

## 📱 Flujo de Usuario Detallado

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  1. INICIO - Dashboard Repartidor                              │
│     ┌────────────────────────────────────────────────────┐    │
│     │  Mis Tiendas Asignadas    [📷 Escanear QR] [🔄]   │    │
│     │                                                    │    │
│     │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │    │
│     │  │ Tienda 1 │ │ Tienda 2 │ │ Tienda 3 │           │    │
│     │  └──────────┘ └──────────┘ └──────────┘           │    │
│     └────────────────────────────────────────────────────┘    │
│                              │                                 │
│                              ▼                                 │
│  2. ESCANEO - Click en "Escanear QR"                          │
│     ┌────────────────────────────────────────────────────┐    │
│     │  ╔════════════════════════════════════════════╗    │    │
│     │  ║         Escanear Código QR            [X]  ║    │    │
│     │  ╠════════════════════════════════════════════╣    │    │
│     │  ║  ┌──────────────────────────────────────┐  ║    │    │
│     │  ║  │                                      │  ║    │    │
│     │  ║  │         📷 Visor Cámara              │  ║    │    │
│     │  ║  │         ┌────────────┐               │  ║    │    │
│     │  ║  │         │   ▣▣▣▣▣   │               │  ║    │    │
│     │  ║  │         │   ▣   ▣   │ ← Marco QR    │  ║    │    │
│     │  ║  │         │   ▣▣▣▣▣   │               │  ║    │    │
│     │  ║  │         └────────────┘               │  ║    │    │
│     │  ║  │                                      │  ║    │    │
│     │  ║  └──────────────────────────────────────┘  ║    │    │
│     │  ║  Apunta la cámara al código QR             ║    │    │
│     │  ║                                            ║    │    │
│     │  ║  [         Cancelar          ]             ║    │    │
│     │  ╚════════════════════════════════════════════╝    │    │
│     └────────────────────────────────────────────────────┘    │
│                              │                                 │
│                              ▼                                 │
│  3. VALIDACIÓN - Se detecta QR                                │
│                                                                │
│     ┌─── Tienda asignada ───┐    ┌─── Tienda NO asignada ───┐ │
│     │                       │    │                          │ │
│     │  Vibración ✓          │    │  Toast de error          │ │
│     │  Cierra escáner       │    │  "Tienda no asignada"    │ │
│     │  Abre modal visita    │    │  Continúa escaneando     │ │
│     │                       │    │                          │ │
│     └───────────────────────┘    └──────────────────────────┘ │
│                              │                                 │
│                              ▼                                 │
│  4. ACCIÓN - Modal de Registrar Visita                        │
│     ┌────────────────────────────────────────────────────┐    │
│     │  ╔════════════════════════════════════════════╗    │    │
│     │  ║    Registrar Visita - Tienda XYZ           ║    │    │
│     │  ╠════════════════════════════════════════════╣    │    │
│     │  ║                                            ║    │    │
│     │  ║  📍 Ubicación: Obteniendo...              ║    │    │
│     │  ║                                            ║    │    │
│     │  ║  [   Registrar Visita y Crear Orden   ]   ║    │    │
│     │  ║  [      Solo Registrar Visita         ]   ║    │    │
│     │  ║                                            ║    │    │
│     │  ╚════════════════════════════════════════════╝    │    │
│     └────────────────────────────────────────────────────┘    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Sincronización Offline

### Estrategia de Cache

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE SINCRONIZACIÓN                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐     ┌─────────────┐     ┌─────────────────┐   │
│  │  Login  │────▶│  Fetch API  │────▶│ Cache IndexedDB │   │
│  └─────────┘     └─────────────┘     └─────────────────┘   │
│                         │                     │             │
│                         │                     │             │
│                    (Online)              (Offline)          │
│                         │                     │             │
│                         ▼                     ▼             │
│               ┌─────────────────┐   ┌─────────────────┐    │
│               │ Tiendas frescas │   │ Tiendas cached  │    │
│               │   del servidor  │   │  (puede estar   │    │
│               │                 │   │   desactualizado)│   │
│               └─────────────────┘   └─────────────────┘    │
│                         │                     │             │
│                         └──────────┬──────────┘             │
│                                    │                        │
│                                    ▼                        │
│                        ┌─────────────────────┐              │
│                        │  UI muestra tiendas │              │
│                        │  + indicador offline│              │
│                        └─────────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Indicador de Estado Offline

```jsx
// Indicador visual en la lista de tiendas
{!navigator.onLine && (
  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" 
      />
    </svg>
    <span className="text-sm text-yellow-700">
      Modo offline - Mostrando tiendas guardadas
    </span>
  </div>
)}
```

---

## 🧪 Casos de Prueba

### Pruebas Funcionales

| # | Caso | Pasos | Resultado Esperado |
|---|------|-------|-------------------|
| 1 | Escaneo exitoso online | Escanear QR de tienda asignada con conexión | Modal de visita se abre |
| 2 | Escaneo exitoso offline | Escanear QR sin conexión | Modal de visita se abre (datos en cache) |
| 3 | Tienda no asignada | Escanear QR de tienda no asignada | Toast de error, escáner continúa |
| 4 | QR inválido | Escanear código no reconocido | Mensaje de error, escáner continúa |
| 5 | Permiso denegado | Denegar acceso a cámara | Mensaje explicativo con instrucciones |
| 6 | Sin cámara | Dispositivo sin cámara | Mensaje de error apropiado |
| 7 | Cache vacío offline | Abrir app sin conexión por primera vez | Mensaje de "sin datos disponibles" |

### Pruebas de Rendimiento

| Métrica | Objetivo |
|---------|----------|
| Tiempo de inicio del escáner | < 2 segundos |
| Tiempo de reconocimiento QR | < 500ms |
| Tiempo de búsqueda en cache | < 50ms |

---

## 📅 Cronograma de Implementación

```
┌──────────────────────────────────────────────────────────────┐
│                    TIMELINE DE DESARROLLO                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  DÍA 1: Configuración Base                                   │
│  ├── Instalar html5-qrcode                                   │
│  ├── Actualizar offlineDB.js (nuevo store)                   │
│  └── Crear offlineStoreService.js                            │
│                                                              │
│  DÍA 2: Componente Escáner                                   │
│  ├── Crear QRScannerModal.jsx                                │
│  ├── Implementar lógica de cámara                            │
│  └── Manejo de errores y permisos                            │
│                                                              │
│  DÍA 3: Integración Dashboard                                │
│  ├── Agregar botón "Escanear QR"                             │
│  ├── Conectar con modal de visita                            │
│  └── Implementar cache automático                            │
│                                                              │
│  DÍA 4: Modo Offline y Testing                               │
│  ├── Probar funcionamiento offline                           │
│  ├── Agregar indicadores visuales                            │
│  └── Testing en dispositivos móviles                         │
│                                                              │
│  DÍA 5: Pulido y Deploy                                      │
│  ├── Ajustes de UX                                           │
│  ├── Pruebas finales                                         │
│  └── Deploy a producción                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚨 Consideraciones Importantes

### Permisos de Cámara

1. **HTTPS obligatorio**: El acceso a la cámara requiere conexión segura
2. **Solicitar permiso una vez**: El navegador recordará la elección
3. **Fallback claro**: Si no hay permiso, mostrar instrucciones

### Compatibilidad

| Navegador | Soporte |
|-----------|---------|
| Chrome (Android) | ✅ Completo |
| Safari (iOS 11+) | ✅ Completo |
| Firefox | ✅ Completo |
| Samsung Internet | ✅ Completo |

### Limitaciones Conocidas

1. **iOS Safari**: Requiere interacción del usuario para iniciar cámara
2. **PWA iOS**: Algunas limitaciones con la cámara en modo standalone
3. **Luz baja**: El reconocimiento puede ser lento con poca luz

---

## 📝 Checklist de Implementación

- [ ] Instalar dependencia `html5-qrcode`
- [ ] Actualizar `offlineDB.js` con nuevo store
- [ ] Crear `offlineStoreService.js`
- [ ] Crear `QRScannerModal.jsx`
- [ ] Modificar `RepartidorDashboard.jsx`
  - [ ] Agregar botón de escanear
  - [ ] Integrar modal de escáner
  - [ ] Implementar cache automático
- [ ] Agregar indicador de modo offline
- [ ] Probar en dispositivos móviles
- [ ] Probar modo offline
- [ ] Deploy a producción

---

## 🔗 Referencias

- [html5-qrcode Documentation](https://github.com/mebjas/html5-qrcode)
- [MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
