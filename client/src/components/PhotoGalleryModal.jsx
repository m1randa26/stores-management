import { useState, useEffect } from 'react'
import { photoService } from '../services/photoService'
import Toast from './Toast'

function PhotoGalleryModal({ isOpen, onClose, visita, tienda }) {
  const [photos, setPhotos] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [deletingPhotoId, setDeletingPhotoId] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Cargar fotos cuando se abre el modal
  useEffect(() => {
    if (isOpen && visita) {
      loadPhotos()
    }
  }, [isOpen, visita])

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPhotos([])
      setError('')
      setSelectedPhoto(null)
      setDeletingPhotoId(null)
      setToast({ show: false, message: '', type: 'success' })
    }
  }, [isOpen])

  const loadPhotos = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await photoService.getPhotosByVisit(visita.id)
      setPhotos(response.data || [])
    } catch (err) {
      setError(err.message)
      console.error('Error al cargar fotos:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePhoto = async (photoId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta foto?')) {
      return
    }

    setDeletingPhotoId(photoId)

    try {
      await photoService.deletePhoto(photoId)

      // Remover foto de la lista local
      setPhotos(photos.filter((photo) => photo.id !== photoId))

      // Si la foto eliminada estaba seleccionada, cerrar vista detallada
      if (selectedPhoto && selectedPhoto.id === photoId) {
        setSelectedPhoto(null)
      }

      setToast({
        show: true,
        message: 'Foto eliminada exitosamente',
        type: 'success',
      })
    } catch (err) {
      setToast({
        show: true,
        message: err.message,
        type: 'error',
      })
      console.error('Error al eliminar foto:', err)
    } finally {
      setDeletingPhotoId(null)
    }
  }

  const handleClose = () => {
    if (!deletingPhotoId) {
      setError('')
      onClose()
    }
  }

  if (!isOpen || !visita || !tienda) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          {/* Close button */}
          <button
            onClick={handleClose}
            disabled={deletingPhotoId !== null}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 z-10"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Galería de Fotos</h2>
            <p className="text-sm text-gray-600 mt-1">
              Fotos de la visita a {tienda.name}
            </p>
          </div>

          {/* Visita Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-gray-900">{tienda.name}</h3>
            <p className="text-sm text-gray-600 mt-1">
              Visita registrada: {new Date(visita.checkInTime).toLocaleString('es-MX')}
            </p>
            <p className="text-sm text-gray-600">
              Total de fotos: {photos.length}
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <svg
                className="animate-spin h-8 w-8 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={loadPhotos}
                className="mt-3 text-sm text-red-700 hover:text-red-800 font-medium underline"
              >
                Intentar nuevamente
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && photos.length === 0 && (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="mt-4 text-gray-600">No hay fotos en esta visita</p>
            </div>
          )}

          {/* Photo Grid */}
          {!isLoading && !error && photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition-colors"
                >
                  {/* Photo */}
                  <div
                    className="aspect-square bg-gray-100 cursor-pointer"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <img
                      src={photoService.getPhotoFileUrl(photo.id)}
                      alt={photo.description || 'Foto de visita'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    {/* View button */}
                    <button
                      onClick={() => setSelectedPhoto(photo)}
                      className="p-2 bg-white rounded-full text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Ver foto"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Description */}
                  {photo.description && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2">
                      <p className="truncate">{photo.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Close Button */}
          <div className="mt-6">
            <button
              onClick={handleClose}
              disabled={deletingPhotoId !== null}
              className="w-full px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex flex-col">
            {/* Close button */}
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Image */}
            <div className="flex-1 flex items-center justify-center">
              <img
                src={photoService.getPhotoFileUrl(selectedPhoto.id)}
                alt={selectedPhoto.description || 'Foto de visita'}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Info */}
            {selectedPhoto.description && (
              <div
                className="mt-4 bg-white rounded-lg p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-gray-900 font-medium">{selectedPhoto.description}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Subida: {new Date(selectedPhoto.createdAt).toLocaleString('es-MX')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        duration={3000}
      />
    </div>
  )
}

export default PhotoGalleryModal
