import { tokenStorage } from '../utils/tokenStorage'
import { API_URL } from '../config/api'

export const userService = {
  getUsers: async () => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al obtener usuarios')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener usuarios')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  getRepartidores: async () => {
    try {
      const data = await userService.getUsers()

      // Filtrar solo los usuarios con rol REPARTIDOR
      const repartidores = data.data.filter(user => user.role === 'REPARTIDOR')

      return {
        success: true,
        data: repartidores,
        total: repartidores.length
      }
    } finally {
      // Cleanup if needed
    }
  },

  deleteUser: async (userId) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al eliminar usuario')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al eliminar usuario')
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
