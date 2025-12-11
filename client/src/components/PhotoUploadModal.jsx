import { useState, useEffect, useRef } from 'react'
import { photoService } from '../services/photoService'
import Toast from './Toast'

function PhotoUploadModal({ isOpen, onClose, visita, tienda, onSuccess, existingPhotos = [] }) {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [descriptions, setDescriptions] = useState({})
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [serverError, setServerError] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const fileInputRef = useRef(null)

  // Calcular fotos restantes (máximo 3)
  const MAX_PHOTOS = 3
  const remainingSlots = MAX_PHOTOS - existingPhotos.length

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([])
      setPreviews([])
      setDescriptions({})
      setIsUploading(false)
      setUploadProgress(0)
      setServerError('')
      setToast({ show: false, message: '', type: 'success' })
    } else {
      // Debug: Mostrar estructura de la visita cuando se abre el modal
      console.log('PhotoUploadModal abierto con visita:', visita)
      console.log('Visita ID:', visita?.id)
    }
  }, [isOpen, visita])

  // Generate previews when files are selected
  useEffect(() => {
    if (selectedFiles.length === 0) {
      setPreviews([])
      return
    }

    const newPreviews = []
    selectedFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        newPreviews.push({
          id: file.name + file.lastModified,
          url: reader.result,
          name: file.name,
          size: file.size,
        })
        if (newPreviews.length === selectedFiles.length) {
          setPreviews(newPreviews)
        }
      }
      reader.readAsDataURL(file)
    })

    return () => {
      previews.forEach((preview) => {
        if (preview.url.startsWith('blob:')) {
          URL.revokeObjectURL(preview.url)
        }
      })
    }
  }, [selectedFiles])

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setServerError('')

    // Verificar límite de fotos
    const totalPhotos = existingPhotos.length + selectedFiles.length
    if (totalPhotos >= MAX_PHOTOS) {
      setServerError(`Ya alcanzaste el límite de ${MAX_PHOTOS} fotos por visita`)
      return
    }

    const slotsAvailable = MAX_PHOTOS - totalPhotos
    if (files.length > slotsAvailable) {
      setServerError(`Solo puedes agregar ${slotsAvailable} foto(s) más. Límite: ${MAX_PHOTOS} fotos por visita`)
      return
    }

    // Validar cada archivo
    const validFiles = []
    const errors = []

    files.forEach((file) => {
      if (!photoService.isValidFileType(file)) {
        errors.push(`${file.name}: Tipo de archivo no válido`)
        return
      }
      if (!photoService.isValidFileSize(file)) {
        errors.push(`${file.name}: El archivo excede 5MB`)
        return
      }
      validFiles.push(file)
    })

    if (errors.length > 0) {
      setServerError(errors.join('\n'))
    }

    if (validFiles.length > 0) {
      setSelectedFiles([...selectedFiles, ...validFiles])
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
    setPreviews(previews.filter((_, i) => i !== index))

    const newDescriptions = { ...descriptions }
    delete newDescriptions[index]
    setDescriptions(newDescriptions)
  }

  const handleDescriptionChange = (index, value) => {
    setDescriptions({
      ...descriptions,
      [index]: value,
    })
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setServerError('Debes seleccionar al menos una foto')
      return
    }

    // Validar que exista el ID de la visita
    if (!visita || !visita.id) {
      setServerError('Error: No se encontró el ID de la visita. Por favor, cierra este modal e intenta nuevamente.')
      console.error('Visita completa:', visita)
      return
    }

    setIsUploading(true)
    setServerError('')
    setUploadProgress(0)

    try {
      const totalFiles = selectedFiles.length
      let uploadedCount = 0

      console.log('Subiendo fotos para visitId:', visita.id)

      // Subir archivos uno por uno
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const description = descriptions[i] || ''

        await photoService.uploadPhoto(visita.id, file, description)

        uploadedCount++
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100))
      }

      // Mostrar toast de éxito
      setToast({
        show: true,
        message: `${uploadedCount} foto(s) subida(s) exitosamente`,
        type: 'success',
      })

      // Esperar un momento para que el usuario vea el toast
      setTimeout(() => {
        if (onSuccess) {
          onSuccess()
        }
        onClose()
      }, 1500)
    } catch (error) {
      setServerError(error.message)
      console.error('Error al subir fotos:', error)
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      setServerError('')
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
        <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 sm:p-8">
          {/* Close button */}
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
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
            <h2 className="text-2xl font-bold text-gray-900">Subir Fotos</h2>
            <p className="text-sm text-gray-600 mt-1">
              Agrega fotos a tu visita en {tienda.name}
            </p>
          </div>

          {/* Visita Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-gray-900">{tienda.name}</h3>
            <p className="text-sm text-gray-600 mt-1">
              Visita registrada: {new Date(visita.checkInTime).toLocaleString('es-MX')}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-medium text-blue-700">
                {existingPhotos.length} / {MAX_PHOTOS} fotos subidas
              </span>
              {remainingSlots > 0 && (
                <span className="text-xs text-gray-600">
                  (puedes agregar {remainingSlots} más)
                </span>
              )}
              {remainingSlots === 0 && (
                <span className="text-xs text-orange-600 font-medium">
                  (límite alcanzado)
                </span>
              )}
            </div>
          </div>

          {/* File Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar fotos (máx. 5MB cada una)
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileSelect}
                disabled={isUploading || remainingSlots === 0}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || remainingSlots === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Agregar Fotos
              </button>
              <span className="text-sm text-gray-600">
                {selectedFiles.length} foto(s) seleccionada(s)
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Formatos permitidos: JPEG, PNG, WebP. Tamaño máximo: 5MB por foto.
            </p>
          </div>

          {/* Previews */}
          {previews.length > 0 && (
            <div className="mb-6 max-h-96 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Fotos seleccionadas
              </h3>
              <div className="space-y-4">
                {previews.map((preview, index) => (
                  <div
                    key={preview.id}
                    className="flex gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    {/* Preview Image */}
                    <div className="flex-shrink-0">
                      <img
                        src={preview.url}
                        alt={preview.name}
                        className="w-20 h-20 object-cover rounded"
                      />
                    </div>

                    {/* File Info and Description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {preview.name}
                      </p>
                      <p className="text-xs text-gray-500 mb-2">
                        {(preview.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <input
                        type="text"
                        placeholder="Descripción (opcional)"
                        value={descriptions[index] || ''}
                        onChange={(e) => handleDescriptionChange(index, e.target.value)}
                        disabled={isUploading}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => handleRemoveFile(index)}
                      disabled={isUploading}
                      className="flex-shrink-0 text-red-600 hover:text-red-700 disabled:opacity-50"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Subiendo fotos...
                </span>
                <span className="text-sm text-gray-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Server Error Alert */}
          {serverError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 whitespace-pre-line">{serverError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={isUploading || selectedFiles.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
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
                  Subiendo fotos...
                </span>
              ) : (
                `Subir ${selectedFiles.length} foto(s)`
              )}
            </button>

            <button
              onClick={handleClose}
              disabled={isUploading}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

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

export default PhotoUploadModal
