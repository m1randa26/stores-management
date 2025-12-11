const DB_NAME = 'abarrotesDB'
const DB_VERSION = 1

const STORES = {
  PENDING_VISITS: 'pendingVisits',
  PENDING_ORDERS: 'pendingOrders',
  PENDING_PHOTOS: 'pendingPhotos',
  OFFLINE_MAPPING: 'offlineMapping',
  CACHED_PRODUCTS: 'cachedProducts',
  CACHED_STORES: 'cachedStores'
}

// Abrir/crear base de datos
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Store de visitas pendientes
      if (!db.objectStoreNames.contains(STORES.PENDING_VISITS)) {
        const visitStore = db.createObjectStore(STORES.PENDING_VISITS, { keyPath: 'offlineId' })
        visitStore.createIndex('syncStatus', 'syncStatus', { unique: false })
        visitStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Store de órdenes pendientes
      if (!db.objectStoreNames.contains(STORES.PENDING_ORDERS)) {
        const orderStore = db.createObjectStore(STORES.PENDING_ORDERS, { keyPath: 'offlineId' })
        orderStore.createIndex('syncStatus', 'syncStatus', { unique: false })
        orderStore.createIndex('visitOfflineId', 'visitOfflineId', { unique: false })
        orderStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Store de fotos pendientes
      if (!db.objectStoreNames.contains(STORES.PENDING_PHOTOS)) {
        const photoStore = db.createObjectStore(STORES.PENDING_PHOTOS, { keyPath: 'offlineId' })
        photoStore.createIndex('syncStatus', 'syncStatus', { unique: false })
        photoStore.createIndex('visitOfflineId', 'visitOfflineId', { unique: false })
        photoStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Store de mapeo offlineId -> serverId
      if (!db.objectStoreNames.contains(STORES.OFFLINE_MAPPING)) {
        const mappingStore = db.createObjectStore(STORES.OFFLINE_MAPPING, { keyPath: 'offlineId' })
        mappingStore.createIndex('serverId', 'serverId', { unique: false })
        mappingStore.createIndex('entityType', 'entityType', { unique: false })
      }

      // Store de productos en caché
      if (!db.objectStoreNames.contains(STORES.CACHED_PRODUCTS)) {
        db.createObjectStore(STORES.CACHED_PRODUCTS, { keyPath: 'id' })
      }

      // Store de tiendas en caché
      if (!db.objectStoreNames.contains(STORES.CACHED_STORES)) {
        db.createObjectStore(STORES.CACHED_STORES, { keyPath: 'id' })
      }

      console.log('📦 IndexedDB inicializada correctamente')
    }
  })
}

const offlineDB = {
  STORES,

  // Agregar registro pendiente
  async addPending(storeName, data) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.add(data)

      request.onsuccess = () => {
        console.log(`✅ Agregado a ${storeName}:`, data.offlineId)
        resolve(request.result)
      }
      request.onerror = () => {
        console.error(`❌ Error agregando a ${storeName}:`, request.error)
        reject(request.error)
      }
    })
  },

  // Obtener todos los registros pendientes
  async getAllPending(storeName) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const index = store.index('syncStatus')
      const request = index.getAll('pending')

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  },

  // Obtener registro por offlineId
  async getByOfflineId(storeName, offlineId) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(offlineId)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  },

  // Actualizar estado de sincronización
  async updateSyncStatus(storeName, offlineId, status, error = null) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const getRequest = store.get(offlineId)

      getRequest.onsuccess = () => {
        const data = getRequest.result
        if (data) {
          data.syncStatus = status
          data.syncAttempts = (data.syncAttempts || 0) + 1
          if (error) data.error = error
          if (status === 'synced') data.syncedAt = new Date().toISOString()

          const updateRequest = store.put(data)
          updateRequest.onsuccess = () => {
            console.log(`📝 Actualizado ${storeName}/${offlineId}: ${status}`)
            resolve(updateRequest.result)
          }
          updateRequest.onerror = () => reject(updateRequest.error)
        } else {
          reject(new Error(`Record not found: ${offlineId}`))
        }
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  },

  // Eliminar registro después de sincronizar
  async deletePending(storeName, offlineId) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.delete(offlineId)

      request.onsuccess = () => {
        console.log(`🗑️ Eliminado de ${storeName}:`, offlineId)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  },

  // Guardar mapeo offlineId -> serverId
  async saveMapping(offlineId, serverId, entityType) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.OFFLINE_MAPPING], 'readwrite')
      const store = transaction.objectStore(STORES.OFFLINE_MAPPING)
      const request = store.put({
        offlineId,
        serverId,
        entityType,
        syncedAt: new Date().toISOString()
      })

      request.onsuccess = () => {
        console.log(`🔗 Mapeo guardado: ${offlineId} -> ${serverId}`)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  },

  // Obtener serverId desde offlineId
  async getServerId(offlineId) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.OFFLINE_MAPPING], 'readonly')
      const store = transaction.objectStore(STORES.OFFLINE_MAPPING)
      const request = store.get(offlineId)

      request.onsuccess = () => {
        resolve(request.result?.serverId || null)
      }
      request.onerror = () => reject(request.error)
    })
  },

  // Guardar productos en caché
  async cacheProducts(products) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_PRODUCTS], 'readwrite')
      const store = transaction.objectStore(STORES.CACHED_PRODUCTS)

      // Limpiar caché anterior
      store.clear()

      // Guardar nuevos productos
      products.forEach(product => {
        store.put(product)
      })

      transaction.oncomplete = () => {
        console.log(`💾 ${products.length} productos en caché`)
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)
    })
  },

  // Obtener productos del caché
  async getCachedProducts() {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_PRODUCTS], 'readonly')
      const store = transaction.objectStore(STORES.CACHED_PRODUCTS)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  },

  // Obtener conteo total de pendientes
  async getPendingCount() {
    try {
      const [visits, orders, photos] = await Promise.all([
        this.getAllPending(STORES.PENDING_VISITS),
        this.getAllPending(STORES.PENDING_ORDERS),
        this.getAllPending(STORES.PENDING_PHOTOS)
      ])

      return {
        visits: visits.length,
        orders: orders.length,
        photos: photos.length,
        total: visits.length + orders.length + photos.length
      }
    } catch (error) {
      console.error('Error obteniendo conteo de pendientes:', error)
      return { visits: 0, orders: 0, photos: 0, total: 0 }
    }
  },

  // Limpiar registros sincronizados antiguos (más de 7 días)
  async cleanupOldRecords() {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const cutoffDate = sevenDaysAgo.toISOString()

    const db = await openDB()
    const storeNames = [STORES.PENDING_VISITS, STORES.PENDING_ORDERS, STORES.PENDING_PHOTOS]

    for (const storeName of storeNames) {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const index = store.index('syncStatus')
      const request = index.openCursor()

      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          const record = cursor.value
          if (record.syncStatus === 'synced' && record.syncedAt < cutoffDate) {
            cursor.delete()
            console.log(`🧹 Limpiado registro antiguo: ${record.offlineId}`)
          }
          cursor.continue()
        }
      }
    }
  }
}

export default offlineDB
