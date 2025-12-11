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
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [mediaStream, setMediaStream] = useState(null)

  // Calcular fotos restantes (máximo 3)
  const MAX_PHOTOS = 3
  const remainingSlots = MAX_PHOTOS - existingPhotos.length

  // Función para detener la cámara
  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      setMediaStream(null)
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    
    setIsCameraActive(false)
    setCameraError('')
    console.log('📷 Cámara detenida')
  }

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
      stopCamera() // Detener cámara al cerrar
    } else {
      console.log('PhotoUploadModal abierto con visita:', visita)
    }
  }, [isOpen, visita])

  // Cleanup: Detener cámara cuando se desmonta el componente
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // CORRECCIÓN PRINCIPAL: Conectar el stream al video cuando el componente se renderiza
  useEffect(() => {
    if (isCameraActive && mediaStream && videoRef.current) {
      console.log('🔗 Conectando stream al elemento de video')
      const video = videoRef.current
      video.srcObject = mediaStream
      
      // Intentar reproducir explícitamente
      video.play().catch(err => {
        console.error("Error al reproducir video:", err)
      })
    }
  }, [isCameraActive, mediaStream])

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

    if (!visita || !visita.id) {
      setServerError('Error: No se encontró el ID de la visita. Por favor, cierra este modal e intenta nuevamente.')
      return
    }

    setIsUploading(true)
    setServerError('')
    setUploadProgress(0)

    try {
      const totalFiles = selectedFiles.length
      let uploadedCount = 0

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const description = descriptions[i] || ''

        await photoService.uploadPhoto(visita.id, file, description)

        uploadedCount++
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100))
      }

      setToast({
        show: true,
        message: `${uploadedCount} foto(s) subida(s) exitosamente`,
        type: 'success',
      })

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

  // Funciones para cámara (MODIFICADA)
  const startCamera = async () => {
    try {
      setCameraError('')
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Tu dispositivo no soporta acceso a la cámara')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      })

      // Aquí SOLO guardamos el estado. El useEffect se encargará de asignar el srcObject
      setMediaStream(stream)
      setIsCameraActive(true)
      console.log('✅ Cámara activada (Esperando renderizado)')

    } catch (error) {
      console.error('Error al acceder a la cámara:', error)
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraError('Permiso de cámara denegado. Por favor, habilita el acceso a la cámara en la configuración de tu navegador.')
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraError('No se encontró ninguna cámara en tu dispositivo.')
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setCameraError('La cámara está siendo usada por otra aplicación.')
      } else {
        setCameraError('Error al acceder a la cámara. Intenta nuevamente.')
      }
    }
  }

  // MODIFICADA: Validación más robusta
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      setServerError('Error al capturar foto. Elementos no encontrados.')
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    
    // Validar readyState (2 = HAVE_CURRENT_DATA) para asegurar que hay imagen
    if (video.readyState < 2) {
      setServerError('El video aún no está listo. Espera un momento e intenta nuevamente.')
      // Intentamos forzar play por si acaso se detuvo
      video.play().catch(e => console.log(e))
      return
    }

    // Doble verificación de dimensiones
    if (!video.videoWidth || !video.videoHeight) {
      setServerError('Dimensiones de video no válidas.')
      return
    }
    
    // Configurar canvas con dimensiones del video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // Dibujar frame actual del video en el canvas
    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Convertir canvas a Blob y luego a File
    canvas.toBlob((blob) => {
      if (!blob) {
        setServerError('Error al generar la imagen. Intenta nuevamente.')
        return
      }

      const timestamp = Date.now()
      const filename = `captura-${timestamp}.jpg`
      const file = new File([blob], filename, { type: 'image/jpeg' })

      if (!photoService.isValidFileType(file)) {
        setServerError('Error al capturar foto: tipo de archivo no válido')
        return
      }

      if (!photoService.isValidFileSize(file)) {
        setServerError('La foto capturada es demasiado grande. Intenta alejarte un poco o cambiar la iluminación.')
        return
      }

      const totalPhotos = existingPhotos.length + selectedFiles.length
      if (totalPhotos >= MAX_PHOTOS) {
        setServerError(`Ya alcanzaste el límite de ${MAX_PHOTOS} fotos por visita`)
        return
      }

      setSelectedFiles([...selectedFiles, file])
      stopCamera()
      
      setToast({
        show: true,
        message: '✅ Foto capturada exitosamente',
        type: 'success'
      })

      console.log('📸 Foto capturada:', filename, file.size, 'bytes')
    }, 'image/jpeg', 0.9)
  }

  const handleClose = () => {
    if (!isUploading) {
      stopCamera()
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
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

          {/* File Input & Camera Controls */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isCameraActive ? 'Captura foto del stand' : 'Agregar fotos del stand'}
            </label>

            {/* Botones de acción */}
            {!isCameraActive ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Input oculto para seleccionar archivos */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleFileSelect}
                    disabled={isUploading || remainingSlots === 0}
                    className="hidden"
                  />
                  
                  {/* Botón: Seleccionar archivos */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || remainingSlots === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Seleccionar Archivos
                  </button>

                  {/* Botón: Usar cámara */}
                  <button
                    onClick={startCamera}
                    disabled={isUploading || remainingSlots === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Usar Cámara
                  </button>

                  <span className="text-sm text-gray-600">
                    {selectedFiles.length} foto(s) seleccionada(s)
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Formatos permitidos: JPEG, PNG, WebP. Tamaño máximo: 5MB por foto.
                </p>
              </div>
            ) : (
              /* Vista de cámara activa */
              <div className="space-y-3">
                {/* Video preview */}
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Canvas oculto para captura */}
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Overlay con guías */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-4 border-2 border-white/50 rounded-lg"></div>
                  </div>
                </div>

                {/* Botones de cámara */}
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={stopCamera}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancelar
                  </button>

                  <button
                    onClick={capturePhoto}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 shadow-lg"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Capturar Foto
                  </button>
                </div>
                
                <p className="text-xs text-center text-gray-500">
                  Posiciona el stand dentro del recuadro y presiona "Capturar Foto"
                </p>
              </div>
            )}

            {/* Error de cámara */}
            {cameraError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium underline"
                >
                  Intentar nuevamente
                </button>
              </div>
            )}
          </div>

          {/* Previews */}
          {previews.length > 0 && (
            <div className="mb-6 max-h-96 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Fotos seleccionadas
              </h3>
              <div className="space-y-4">
                {previews.map((preview, index) => (
                  <div key={preview.id} className="flex gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-shrink-0">
                      <img src={preview.url} alt={preview.name} className="w-20 h-20 object-cover rounded" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{preview.name}</p>
                      <p className="text-xs text-gray-500 mb-2">{(preview.size / 1024 / 1024).toFixed(2)} MB</p>
                      <input
                        type="text"
                        placeholder="Descripción (opcional)"
                        value={descriptions[index] || ''}
                        onChange={(e) => handleDescriptionChange(index, e.target.value)}
                        disabled={isUploading}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <button onClick={() => handleRemoveFile(index)} disabled={isUploading} className="flex-shrink-0 text-red-600 hover:text-red-700 disabled:opacity-50">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                <span className="text-sm font-medium text-gray-700">Subiendo fotos...</span>
                <span className="text-sm text-gray-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
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
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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