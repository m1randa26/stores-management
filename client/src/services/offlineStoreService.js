/**
 * Servicio para manejo de tiendas asignadas en cache (IndexedDB)
 * Permite funcionalidad offline para escaneo de códigos QR
 */

const DB_NAME = 'abarrotesDB'
const DB_VERSION = 2
const STORE_NAME = 'assignedStores'

/**
 * Abrir conexión a IndexedDB
 */
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Guardar tiendas asignadas en cache
 * @param {Array} stores - Array de tiendas asignadas
 */
export const cacheAssignedStores = async (stores) => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    // Limpiar cache anterior
    await new Promise((resolve, reject) => {
      const clearRequest = store.clear()
      clearRequest.onsuccess = () => resolve()
      clearRequest.onerror = () => reject(clearRequest.error)
    })

    // Guardar nuevas tiendas
    for (const tienda of stores) {
      await new Promise((resolve, reject) => {
        const putRequest = store.put({
          ...tienda,
          cachedAt: new Date().toISOString()
        })
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      })
    }

    console.log(`✅ [OfflineStore] ${stores.length} tiendas cacheadas`)
    return { success: true, count: stores.length }
  } catch (error) {
    console.error('❌ [OfflineStore] Error al cachear tiendas:', error)
    throw error
  }
}

/**
 * Obtener todas las tiendas cacheadas
 * @returns {Array} Array de tiendas
 */
export const getCachedStores = async () => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        console.log(`📦 [OfflineStore] ${request.result?.length || 0} tiendas en cache`)
        resolve(request.result || [])
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('❌ [OfflineStore] Error al obtener tiendas:', error)
    return []
  }
}

/**
 * Buscar tienda por código QR
 * @param {string} qrCode - Código QR de la tienda
 * @returns {Object|null} Tienda encontrada o null
 */
export const findStoreByQRCode = async (qrCode) => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('qrCode')

    return new Promise((resolve, reject) => {
      const request = index.get(qrCode)
      request.onsuccess = () => {
        if (request.result) {
          console.log(`✅ [OfflineStore] Tienda encontrada por QR: ${request.result.name}`)
        } else {
          console.log(`⚠️ [OfflineStore] No se encontró tienda con QR: ${qrCode}`)
        }
        resolve(request.result || null)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('❌ [OfflineStore] Error al buscar por QR:', error)
    return null
  }
}

/**
 * Buscar tienda por ID
 * @param {string} storeId - ID de la tienda
 * @returns {Object|null} Tienda encontrada o null
 */
export const findStoreById = async (storeId) => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.get(storeId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('❌ [OfflineStore] Error al buscar por ID:', error)
    return null
  }
}

/**
 * Verificar si hay tiendas en cache
 * @returns {boolean}
 */
export const hasCachedStores = async () => {
  const stores = await getCachedStores()
  return stores.length > 0
}

/**
 * Obtener la fecha del último cache
 * @returns {string|null} Fecha ISO o null
 */
export const getLastCacheDate = async () => {
  const stores = await getCachedStores()
  if (stores.length === 0) return null
  
  // Retornar la fecha más reciente
  const dates = stores.map(s => s.cachedAt).filter(Boolean)
  return dates.length > 0 ? dates[0] : null
}

/**
 * Limpiar cache de tiendas
 */
export const clearStoresCache = async () => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => {
        console.log('🗑️ [OfflineStore] Cache de tiendas limpiado')
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('❌ [OfflineStore] Error al limpiar cache:', error)
    throw error
  }
}

export default {
  cacheAssignedStores,
  getCachedStores,
  findStoreByQRCode,
  findStoreById,
  hasCachedStores,
  getLastCacheDate,
  clearStoresCache
}
