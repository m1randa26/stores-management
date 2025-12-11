import { API_URL } from '../config/api'

const AUTH_URL = `${API_URL}/auth`

export const authService = {
  login: async (email, password) => {
    try {
      const response = await fetch(`${AUTH_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al iniciar sesión')
      }

      if (!data.success) {
        throw new Error(data.message || 'Credenciales inválidas')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  logout: () => {
    // Aquí puedes agregar lógica para invalidar el token en el backend si es necesario
    return Promise.resolve()
  },

  register: async (userData) => {
    try {
      const response = await fetch(`${AUTH_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al registrar usuario')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al registrar usuario')
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
