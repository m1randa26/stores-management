import { tokenStorage } from '../utils/tokenStorage'
import { API_URL } from '../config/api'

export const storeService = {
  getStores: async () => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/stores`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al obtener tiendas')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener tiendas')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  createStore: async (storeData) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/stores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(storeData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al crear tienda')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al crear tienda')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  assignStore: async (storeId, userId) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/stores/${storeId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al asignar tienda')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al asignar tienda')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  unassignStore: async (storeId, userId) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/stores/${storeId}/unassign/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al desasignar tienda')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al desasignar tienda')
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
