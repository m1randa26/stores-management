import { tokenStorage } from '../utils/tokenStorage'
import offlineDB from './offlineDB'
import networkService from './networkService'
import { v4 as uuidv4 } from 'uuid'
import { API_URL } from '../config/api'

// Función para validar el tipo de archivo
const validateFileType = (file) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  return allowedTypes.includes(file.type)
}

// Función para validar el tamaño del archivo (max 5MB)
const validateFileSize = (file) => {
  const maxSize = 5 * 1024 * 1024 // 5MB en bytes
  return file.size <= maxSize
}

// Convertir File a Base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Convertir Base64 a File
const base64ToFile = (base64, filename) => {
  const arr = base64.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }

  return new File([u8arr], filename, { type: mime })
}

export const photoService = {
  // Subir foto a una visita (con soporte offline)
  uploadPhoto: async (visitId, file, description = '') => {
    const offlineId = uuidv4()

    // Validar archivo antes de cualquier cosa
    if (!validateFileType(file)) {
      throw new Error('Tipo de archivo no válido. Solo se permiten imágenes JPEG, PNG o WebP.')
    }

    if (!validateFileSize(file)) {
      throw new Error('El archivo es demasiado grande. El tamaño máximo es 5MB.')
    }

    if (!visitId) {
      throw new Error('El ID de la visita es requerido')
    }

    if (networkService.getStatus()) {
      // Modo ONLINE - intentar enviar directamente
      try {
        const token = tokenStorage.getToken()

        if (!token) {
          throw new Error('No hay token de autenticación')
        }

        console.log('visitId recibido en uploadPhoto:', visitId, 'tipo:', typeof visitId)

        const formData = new FormData()
        formData.append('photo', file)
        formData.append('visitId', visitId)
        if (description) {
          formData.append('description', description)
        }

        console.log('Datos de foto a enviar:')
        console.log('- visitId:', visitId)
        console.log('- file:', file.name, file.size, file.type)
        console.log('- description:', description)

        const response = await fetch(`${API_URL}/photos`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Error al subir foto')
        }

        if (!data.success) {
          throw new Error(data.message || 'Error al subir foto')
        }

        console.log('✅ Foto subida online:', data.data.id)

        return {
          ...data,
          data: {
            ...data.data,
            isOffline: false
          }
        }
      } catch (error) {
        console.error('Error en modo online, guardando offline:', error)
        return photoService.savePhotoOffline(visitId, file, description, offlineId)
      }
    } else {
      // Modo OFFLINE - guardar localmente
      console.log('📴 Sin conexión - guardando foto offline')
      return photoService.savePhotoOffline(visitId, file, description, offlineId)
    }
  },

  // Guardar foto offline
  savePhotoOffline: async (visitId, file, description, offlineId) => {
    // Convertir imagen a Base64
    const photoData = await fileToBase64(file)

    const pendingPhoto = {
      offlineId,
      visitOfflineId: visitId,
      photoData, // Base64
      filename: file.name,
      description,
      syncStatus: 'pending',
      syncAttempts: 0,
      createdAt: new Date().toISOString()
    }

    await offlineDB.addPending(offlineDB.STORES.PENDING_PHOTOS, pendingPhoto)

    console.log('📴 Foto guardada offline:', offlineId)

    return {
      success: true,
      message: 'Foto guardada localmente (se sincronizará automáticamente)',
      data: {
        id: offlineId,
        offlineId,
        visitId,
        filename: file.name,
        description,
        photoData, // Para mostrar preview localmente
        isOffline: true,
        syncStatus: 'pending',
        createdAt: new Date().toISOString()
      }
    }
  },

  // Sincronizar fotos pendientes
  syncPendingPhotos: async () => {
    const pending = await offlineDB.getAllPending(offlineDB.STORES.PENDING_PHOTOS)

    console.log(`🔄 Sincronizando ${pending.length} fotos pendientes...`)

    const results = {
      synced: 0,
      failed: 0,
      errors: []
    }

    for (const photo of pending) {
      try {
        await offlineDB.updateSyncStatus(
          offlineDB.STORES.PENDING_PHOTOS,
          photo.offlineId,
          'syncing'
        )

        // Obtener visitId del servidor
        const visitServerId = await offlineDB.getServerId(photo.visitOfflineId)

        if (!visitServerId) {
          throw new Error('La visita aún no ha sido sincronizada')
        }

        const token = tokenStorage.getToken()

        if (!token) {
          throw new Error('No hay token de autenticación')
        }

        // Convertir Base64 a File
        const file = base64ToFile(photo.photoData, photo.filename)

        const formData = new FormData()
        formData.append('offlineId', photo.offlineId)
        formData.append('visitId', visitServerId)
        formData.append('filename', photo.filename || file.name)
        formData.append('photo', file)
        if (photo.description) {
          formData.append('description', photo.description)
        }

        const response = await fetch(`${API_URL}/photos/sync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || `HTTP ${response.status}`)
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.message || 'Error al sincronizar foto')
        }

        await offlineDB.saveMapping(photo.offlineId, data.data.id, 'photo')
        await offlineDB.deletePending(offlineDB.STORES.PENDING_PHOTOS, photo.offlineId)

        console.log(`✅ Foto sincronizada: ${photo.offlineId} -> ${data.data.id}`)
        results.synced++
      } catch (error) {
        console.error(`❌ Error sincronizando foto ${photo.offlineId}:`, error)

        // Marcar como error (máximo 3 intentos)
        if (photo.syncAttempts < 3) {
          await offlineDB.updateSyncStatus(
            offlineDB.STORES.PENDING_PHOTOS,
            photo.offlineId,
            'pending',
            error.message
          )
        } else {
          await offlineDB.updateSyncStatus(
            offlineDB.STORES.PENDING_PHOTOS,
            photo.offlineId,
            'error',
            error.message
          )
        }

        results.failed++
        results.errors.push({
          offlineId: photo.offlineId,
          error: error.message
        })
      }
    }

    return results
  },

  // Obtener fotos de una visita (con soporte offline)
  getPhotosByVisit: async (visitId) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/photos/visit/${visitId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al obtener fotos')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener fotos')
      }

      // Agregar fotos pendientes offline para esta visita
      const pendingPhotos = await offlineDB.getAllPending(offlineDB.STORES.PENDING_PHOTOS)
      const visitPendingPhotos = pendingPhotos.filter(p => p.visitOfflineId === visitId)

      const offlinePhotosFormatted = visitPendingPhotos.map(photo => ({
        id: photo.offlineId,
        offlineId: photo.offlineId,
        visitId,
        filename: photo.filename,
        description: photo.description,
        photoData: photo.photoData, // Base64 para preview
        isOffline: true,
        syncStatus: photo.syncStatus,
        createdAt: photo.createdAt
      }))

      return {
        ...data,
        data: [...offlinePhotosFormatted, ...data.data]
      }
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        // Si no hay conexión, devolver solo fotos offline
        console.log('📴 Sin conexión - mostrando solo fotos offline')
        const pendingPhotos = await offlineDB.getAllPending(offlineDB.STORES.PENDING_PHOTOS)
        const visitPendingPhotos = pendingPhotos.filter(p => p.visitOfflineId === visitId)

        const offlinePhotosFormatted = visitPendingPhotos.map(photo => ({
          id: photo.offlineId,
          offlineId: photo.offlineId,
          visitId,
          filename: photo.filename,
          description: photo.description,
          photoData: photo.photoData,
          isOffline: true,
          syncStatus: photo.syncStatus,
          createdAt: photo.createdAt
        }))

        return {
          success: true,
          data: offlinePhotosFormatted
        }
      }
      throw error
    }
  },

  // Obtener URL de archivo de foto
  getPhotoFileUrl: (photoId) => {
    const token = tokenStorage.getToken()
    return `${API_URL}/photos/${photoId}/file?token=${token}`
  },

  // Eliminar foto
  deletePhoto: async (photoId) => {
    try {
      const token = tokenStorage.getToken()

      if (!token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`${API_URL}/photos/${photoId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al eliminar foto')
      }

      if (!data.success) {
        throw new Error(data.message || 'Error al eliminar foto')
      }

      return data
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor')
      }
      throw error
    }
  },

  // Validaciones expuestas
  isValidFileType: validateFileType,
  isValidFileSize: validateFileSize,
}
