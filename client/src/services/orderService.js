import { tokenStorage } from '../utils/tokenStorage'
import offlineDB from './offlineDB'
import networkService from './networkService'
import { v4 as uuidv4 } from 'uuid'
import { API_URL } from '../config/api'

export const orderService = {
  // Crear nueva orden (con soporte offline)
  createOrder: async (orderData) => {
    const offlineId = uuidv4()

    if (networkService.getStatus()) {
      // Modo ONLINE - intentar enviar directamente
      try {
        const token = tokenStorage.getToken()

        if (!token) {
          throw new Error('No hay token de autenticación')
        }

        const response = await fetch(`${API_URL}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(orderData),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Error al crear orden')
        }

        if (!data.success) {
          throw new Error(data.message || 'Error al crear orden')
        }

        console.log('✅ Orden creada online:', data.data.id)

        return {
          ...data,
          data: {
            ...data.data,
            isOffline: false
          }
        }
      } catch (error) {
        console.error('Error en modo online, guardando offline:', error)
        return orderService.saveOrderOffline(orderData, offlineId)
      }
    } else {
      // Modo OFFLINE - guardar localmente
      console.log('📴 Sin conexión - guardando orden offline')
      return orderService.saveOrderOffline(orderData, offlineId)
    }
  },

  // Guardar orden offline
  saveOrderOffline: async (orderData, offlineId) => {
    // Calcular total localmente
    const total = orderData.items.reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice),
      0
    )

    const pendingOrder = {
      offlineId,
      visitOfflineId: orderData.visitId, // Puede ser offlineId si la visita también es offline
      items: orderData.items,
      total,
      syncStatus: 'pending',
      syncAttempts: 0,
      createdAt: new Date().toISOString(),
      // Guardar info de la tienda si está disponible
      storeId: orderData.storeId || null,
      storeName: orderData.storeName || null,
      storeAddress: orderData.storeAddress || null
    }

    await offlineDB.addPending(offlineDB.STORES.PENDING_ORDERS, pendingOrder)

    console.log('📴 Orden guardada offline:', offlineId)

    // Formatear items con estructura de producto para compatibilidad con UI
    const formattedItems = orderData.items.map(item => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      product: {
        id: item.productId,
        name: item.productName || 'Producto sin nombre'
      }
    }))

    return {
      success: true,
      message: 'Orden guardada localmente (se sincronizará automáticamente)',
      data: {
        id: offlineId,
        offlineId,
        visitId: orderData.visitId,
        items: formattedItems,
        total,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        isOffline: true,
        syncStatus: 'pending',
        store: orderData.storeName ? {
          id: orderData.storeId,
          name: orderData.storeName,
          address: orderData.storeAddress
        } : null,
        _count: { items: orderData.items.length }
      }
    }
  },

  // Sincronizar órdenes pendientes
  syncPendingOrders: async () => {
    const pending = await offlineDB.getAllPending(offlineDB.STORES.PENDING_ORDERS)

    console.log(`🔄 Sincronizando ${pending.length} órdenes pendientes...`)

    const results = {
      synced: 0,
      failed: 0,
      errors: []
    }

    for (const order of pending) {
      try {
        await offlineDB.updateSyncStatus(
          offlineDB.STORES.PENDING_ORDERS,
          order.offlineId,
          'syncing'
        )

        // Obtener visitId del servidor (si la visita ya fue sincronizada)
        const visitServerId = await offlineDB.getServerId(order.visitOfflineId)

        if (!visitServerId) {
          throw new Error('La visita aún no ha sido sincronizada')
        }

        const token = tokenStorage.getToken()

        if (!token) {
          throw new Error('No hay token de autenticación')
        }

        const response = await fetch(`${API_URL}/orders/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            offlineId: order.offlineId,
            visitId: visitServerId,
            items: order.items
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || `HTTP ${response.status}`)
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.message || 'Error al sincronizar orden')
        }

        await offlineDB.saveMapping(order.offlineId, data.data.id, 'order')
        await offlineDB.deletePending(offlineDB.STORES.PENDING_ORDERS, order.offlineId)

        console.log(`✅ Orden sincronizada: ${order.offlineId} -> ${data.data.id}`)
        results.synced++
      } catch (error) {
        console.error(`❌ Error sincronizando orden ${order.offlineId}:`, error)

        // Marcar como error (máximo 3 intentos)
        if (order.syncAttempts < 3) {
          await offlineDB.updateSyncStatus(
            offlineDB.STORES.PENDING_ORDERS,
            order.offlineId,
            'pending',
            error.message
          )
        } else {
          await offlineDB.updateSyncStatus(
            offlineDB.STORES.PENDING_ORDERS,
            order.offlineId,
            'error',
            error.message
          )
        }

        results.failed++
        results.errors.push({
          offlineId: order.offlineId,
          error: error.message
        })
      }
    }

    return results
  },

  // Obtener mis órdenes (con soporte offline)
  getMyOrders: async (filters = {}) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      // Construir query params
      const params = new URLSearchParams()
      if (filters.storeId) params.append('storeId', filters.storeId)
      if (filters.status) params.append('status', filters.status)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const queryString = params.toString()
      const url = queryString ? `${API_URL}/orders/my-orders?${queryString}` : `${API_URL}/orders/my-orders`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al obtener órdenes')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener órdenes')
      }

      // Agregar órdenes pendientes offline
      const pendingOrders = await offlineDB.getAllPending(offlineDB.STORES.PENDING_ORDERS)

      const offlineOrdersFormatted = pendingOrders.map(order => {
        // Formatear items con estructura de producto para compatibilidad con UI
        const formattedItems = order.items.map(item => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          product: {
            id: item.productId,
            name: item.productName || 'Producto sin nombre'
          }
        }))

        return {
          id: order.offlineId,
          offlineId: order.offlineId,
          visitId: order.visitOfflineId,
          items: formattedItems,
          total: order.total,
          status: 'PENDING',
          createdAt: order.createdAt,
          isOffline: true,
          syncStatus: order.syncStatus,
          store: order.storeName ? {
            id: order.storeId,
            name: order.storeName,
            address: order.storeAddress
          } : null,
          _count: { items: order.items.length }
        }
      })

      return {
        ...data,
        data: [...offlineOrdersFormatted, ...data.data]
      }
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        // Si no hay conexión, devolver solo las órdenes offline
        console.log('📴 Sin conexión - mostrando solo órdenes offline')
        const pendingOrders = await offlineDB.getAllPending(offlineDB.STORES.PENDING_ORDERS)

        const offlineOrdersFormatted = pendingOrders.map(order => {
          // Formatear items con estructura de producto para compatibilidad con UI
          const formattedItems = order.items.map(item => ({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            product: {
              id: item.productId,
              name: item.productName || 'Producto sin nombre'
            }
          }))

          return {
            id: order.offlineId,
            offlineId: order.offlineId,
            visitId: order.visitOfflineId,
            items: formattedItems,
            total: order.total,
            status: 'PENDING',
            createdAt: order.createdAt,
            isOffline: true,
            syncStatus: order.syncStatus,
            store: order.storeName ? {
              id: order.storeId,
              name: order.storeName,
              address: order.storeAddress
            } : null,
            _count: { items: order.items.length }
          }
        })

        return {
          success: true,
          data: offlineOrdersFormatted
        }
      }
      throw error
    }
  },

  // Obtener orden específica
  getOrder: async (orderId) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al obtener orden')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener orden')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  // Actualizar estado de orden
  updateOrderStatus: async (orderId, status) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al actualizar estado')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al actualizar estado')
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
