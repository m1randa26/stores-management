import { tokenStorage } from '../utils/tokenStorage'
import offlineDB from './offlineDB'
import networkService from './networkService'
import { v4 as uuidv4 } from 'uuid'
import { API_URL } from '../config/api'

export const visitService = {
  // Registrar nueva visita (con soporte offline)
  createVisit: async (visitData) => {
    const offlineId = uuidv4()

    if (networkService.getStatus()) {
      // Modo ONLINE - intentar enviar directamente
      try {
        const token = tokenStorage.getToken()

        if (!token) {
          throw new Error('No hay token de autenticación')
        }

        const response = await fetch(`${API_URL}/visits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(visitData),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Error al registrar visita')
        }

        if (!data.success) {
          throw new Error(data.message || 'Error al registrar visita')
        }

        console.log('✅ Visita creada online:', data.data.id)

        return {
          ...data,
          data: {
            ...data.data,
            isOffline: false
          }
        }
      } catch (error) {
        console.error('Error en modo online, guardando offline:', error)
        // Si falla, guardar offline
        return visitService.saveVisitOffline(visitData, offlineId)
      }
    } else {
      // Modo OFFLINE - guardar localmente
      console.log('📴 Sin conexión - guardando visita offline')
      return visitService.saveVisitOffline(visitData, offlineId)
    }
  },

  // Guardar visita offline
  saveVisitOffline: async (visitData, offlineId) => {
    const pendingVisit = {
      offlineId,
      ...visitData,
      visitedAt: visitData.visitedAt || new Date().toISOString(),
      syncStatus: 'pending',
      syncAttempts: 0,
      createdAt: new Date().toISOString(),
      // Guardar info de la tienda si está disponible
      storeName: visitData.storeName || null,
      storeAddress: visitData.storeAddress || null
    }

    await offlineDB.addPending(offlineDB.STORES.PENDING_VISITS, pendingVisit)

    console.log('📴 Visita guardada offline:', offlineId)

    return {
      success: true,
      message: 'Visita guardada localmente (se sincronizará automáticamente)',
      data: {
        id: offlineId,
        offlineId,
        ...visitData,
        checkInTime: visitData.visitedAt || new Date().toISOString(),
        visitedAt: visitData.visitedAt || new Date().toISOString(),
        isOffline: true,
        syncStatus: 'pending',
        store: visitData.storeName ? {
          id: visitData.storeId,
          name: visitData.storeName,
          address: visitData.storeAddress
        } : null
      }
    }
  },

  // Sincronizar visitas pendientes
  syncPendingVisits: async () => {
    const pending = await offlineDB.getAllPending(offlineDB.STORES.PENDING_VISITS)

    console.log(`🔄 Sincronizando ${pending.length} visitas pendientes...`)

    const results = {
      synced: 0,
      failed: 0,
      errors: []
    }

    for (const visit of pending) {
      try {
        // Marcar como "syncing"
        await offlineDB.updateSyncStatus(
          offlineDB.STORES.PENDING_VISITS,
          visit.offlineId,
          'syncing'
        )

        const token = tokenStorage.getToken()

        if (!token) {
          throw new Error('No hay token de autenticación')
        }

        // Enviar al servidor
        const response = await fetch(`${API_URL}/visits/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            offlineId: visit.offlineId,
            storeId: visit.storeId,
            latitude: visit.latitude,
            longitude: visit.longitude,
            accuracy: visit.accuracy,
            visitedAt: visit.visitedAt
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || `HTTP ${response.status}`)
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.message || 'Error al sincronizar visita')
        }

        // Guardar mapeo offlineId -> serverId
        await offlineDB.saveMapping(visit.offlineId, data.data.id, 'visit')

        // Eliminar de pendientes
        await offlineDB.deletePending(offlineDB.STORES.PENDING_VISITS, visit.offlineId)

        console.log(`✅ Visita sincronizada: ${visit.offlineId} -> ${data.data.id}`)
        results.synced++
      } catch (error) {
        console.error(`❌ Error sincronizando visita ${visit.offlineId}:`, error)

        // Marcar como error (máximo 3 intentos)
        if (visit.syncAttempts < 3) {
          await offlineDB.updateSyncStatus(
            offlineDB.STORES.PENDING_VISITS,
            visit.offlineId,
            'pending', // Volver a pending para reintentar
            error.message
          )
        } else {
          await offlineDB.updateSyncStatus(
            offlineDB.STORES.PENDING_VISITS,
            visit.offlineId,
            'error',
            error.message
          )
        }

        results.failed++
        results.errors.push({
          offlineId: visit.offlineId,
          error: error.message
        })
      }
    }

    return results
  },

  // Obtener mis visitas (con soporte offline)
  getMyVisits: async (filters = {}) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      // Construir query params
      const params = new URLSearchParams()
      if (filters.storeId) params.append('storeId', filters.storeId)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.hasOrder !== undefined) params.append('hasOrder', filters.hasOrder)

      const queryString = params.toString()
      const url = queryString ? `${API_URL}/visits/my-visits?${queryString}` : `${API_URL}/visits/my-visits`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al obtener visitas')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener visitas')
      }

      // Agregar visitas pendientes offline
      const pendingVisits = await offlineDB.getAllPending(offlineDB.STORES.PENDING_VISITS)

      const offlineVisitsFormatted = pendingVisits.map(visit => ({
        id: visit.offlineId,
        offlineId: visit.offlineId,
        storeId: visit.storeId,
        latitude: visit.latitude,
        longitude: visit.longitude,
        visitedAt: visit.visitedAt,
        checkInTime: visit.visitedAt,
        isOffline: true,
        syncStatus: visit.syncStatus,
        store: visit.storeName ? {
          id: visit.storeId,
          name: visit.storeName,
          address: visit.storeAddress
        } : null,
        order: null,
        _count: { photos: 0 }
      }))

      return {
        ...data,
        data: [...offlineVisitsFormatted, ...data.data]
      }
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        // Si no hay conexión, devolver solo las visitas offline
        console.log('📴 Sin conexión - mostrando solo visitas offline')
        const pendingVisits = await offlineDB.getAllPending(offlineDB.STORES.PENDING_VISITS)

        const offlineVisitsFormatted = pendingVisits.map(visit => ({
          id: visit.offlineId,
          offlineId: visit.offlineId,
          storeId: visit.storeId,
          latitude: visit.latitude,
          longitude: visit.longitude,
          visitedAt: visit.visitedAt,
          checkInTime: visit.visitedAt,
          isOffline: true,
          syncStatus: visit.syncStatus,
          store: visit.storeName ? {
            id: visit.storeId,
            name: visit.storeName,
            address: visit.storeAddress
          } : null,
          order: null,
          _count: { photos: 0 }
        }))

        return {
          success: true,
          data: offlineVisitsFormatted
        }
      }
      throw error
    }
  },

  // Obtener visita específica
  getVisit: async (visitId) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/visits/${visitId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al obtener visita')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener visita')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  // Obtener estadísticas (ADMIN)
  getStatistics: async (filters = {}) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      // Construir query params
      const params = new URLSearchParams()
      if (filters.userId) params.append('userId', filters.userId)
      if (filters.storeId) params.append('storeId', filters.storeId)

      const queryString = params.toString()
      const url = queryString ? `${API_URL}/visits/statistics?${queryString}` : `${API_URL}/visits/statistics`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al obtener estadísticas')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener estadísticas')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  // Obtener todas las visitas (solo ADMIN)
  getAllVisits: async (filters = {}) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      // Construir query params
      const params = new URLSearchParams()
      if (filters.userId) params.append('userId', filters.userId)
      if (filters.storeId) params.append('storeId', filters.storeId)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await fetch(`${API_URL}/visits?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al obtener visitas')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener visitas')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  }
}
