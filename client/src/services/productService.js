import { tokenStorage } from '../utils/tokenStorage'
import { API_URL } from '../config/api'

// Función para sanitizar el input de búsqueda
const sanitizeSearchQuery = (query) => {
  if (!query) return ''

  // Eliminar caracteres potencialmente peligrosos
  // Permitir solo letras, números, espacios y algunos caracteres seguros
  const sanitized = query
    .replace(/[^\w\s\-áéíóúñÁÉÍÓÚÑ]/g, '') // Solo alfanuméricos, espacios, guiones y letras con acentos
    .trim()
    .slice(0, 100) // Limitar longitud máxima

  return sanitized
}

export const productService = {
  // Obtener productos activos (para catálogo de pedidos)
  getActiveProducts: async () => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/products/active`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al obtener productos activos')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener productos activos')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  getProducts: async (searchQuery = '') => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      // Sanitizar y codificar el query de búsqueda
      const sanitizedQuery = sanitizeSearchQuery(searchQuery)
      const encodedQuery = encodeURIComponent(sanitizedQuery)

      // Construir URL con parámetro de búsqueda si existe
      const url = sanitizedQuery
        ? `${API_URL}/products?search=${encodedQuery}`
        : `${API_URL}/products`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al obtener productos')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener productos')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  createProduct: async (productData) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(productData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al crear producto')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al crear producto')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  deleteProduct: async (productId) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al eliminar producto')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al eliminar producto')
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
