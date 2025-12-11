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

  // CONSTANTES
  const MAX_PHOTOS = 3

  // 1. SANITIZACIÓN: Aseguramos que existingPhotos sea siempre un array
  const safeExistingPhotos = Array.isArray(existingPhotos) ? existingPhotos : []

  // --- NUEVA LÓGICA DE BLOQUEO ---
  // Si ya existen fotos en el servidor para esta visita, el usuario ya "gastó" su oportunidad.
  const hasPriorUploads = safeExistingPhotos.length > 0

  // 2. CÁLCULO TOTAL: Sumamos las que ya existen + las que el usuario acaba de seleccionar
  const totalCurrentPhotos = safeExistingPhotos.length + selectedFiles.length
  
  // 3. SLOTS RESTANTES para la sesión actual
  const remainingSlots = Math.max(0, MAX_PHOTOS - totalCurrentPhotos)

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
      stopCamera()
    } else {
      console.log('PhotoUploadModal abierto. Fotos existentes:', safeExistingPhotos.length)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, visita]) 

  // Cleanup: Detener cámara al desmontar
  useEffect(() => {
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Conectar stream al video
  useEffect(() => {
    if (isCameraActive && mediaStream && videoRef.current) {
      const video = videoRef.current
      video.srcObject = mediaStream
      video.play().catch(err => console.error("Error video play:", err))
    }
  }, [isCameraActive, mediaStream])

  // Generar previsualizaciones
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
        if (preview.url.startsWith('blob:')) URL.revokeObjectURL(preview.url)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles])

  // --- MANEJO DE SELECCIÓN DE ARCHIVOS ---
  const handleFileSelect = (e) => {
    // Si ya hay subidas previas, no permitir nada (seguridad extra)
    if (hasPriorUploads) return;

    const files = Array.from(e.target.files)
    setServerError('')

    if (totalCurrentPhotos >= MAX_PHOTOS) {
      setServerError(`Ya alcanzaste el límite de ${MAX_PHOTOS} fotos.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (files.length > remainingSlots) {
      setServerError(`Solo puedes agregar ${remainingSlots} foto(s) más.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const validFiles = []
    const errors = []

    files.forEach((file) => {
      if (!photoService.isValidFileType(file)) {
        errors.push(`${file.name}: Tipo no válido`)
        return
      }
      if (!photoService.isValidFileSize(file)) {
        errors.push(`${file.name}: Excede 5MB`)
        return
      }
      validFiles.push(file)
    })

    if (errors.length > 0) setServerError(errors.join('\n'))

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles])
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
    setPreviews(previews.filter((_, i) => i !== index))
    
    const newDescriptions = { ...descriptions }
    delete newDescriptions[index]
    
    const reorderedDescriptions = {}
    Object.keys(newDescriptions).forEach(key => {
        const keyNum = parseInt(key)
        if (keyNum < index) reorderedDescriptions[keyNum] = newDescriptions[keyNum]
        if (keyNum > index) reorderedDescriptions[keyNum - 1] = newDescriptions[keyNum]
    })
    setDescriptions(reorderedDescriptions)
  }

  const handleDescriptionChange = (index, value) => {
    setDescriptions({ ...descriptions, [index]: value })
  }

  const handleUpload = async () => {
    if (hasPriorUploads) {
        setServerError('Ya se han subido fotos para esta visita anteriormente.')
        return
    }

    if (selectedFiles.length === 0) {
      setServerError('Selecciona al menos una foto')
      return
    }

    if (!visita?.id) {
      setServerError('Error: ID de visita no encontrado.')
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

      setToast({ show: true, message: '✅ Fotos subidas exitosamente', type: 'success' })

      setTimeout(() => {
        if (onSuccess) onSuccess()
        onClose()
      }, 1500)
    } catch (error) {
      setServerError(error.message)
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const startCamera = async () => {
    // Bloqueo de seguridad para la cámara
    if (hasPriorUploads) return;

    try {
      setCameraError('')
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Dispositivo sin soporte de cámara')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      })
      setMediaStream(stream)
      setIsCameraActive(true)
    } catch (error) {
      console.error('Error cámara:', error)
      setCameraError('Error al acceder a la cámara.')
    }
  }

  // --- CAPTURA DE FOTO ---
  const capturePhoto = () => {
    if (hasPriorUploads) return; // Bloqueo extra

    if (totalCurrentPhotos >= MAX_PHOTOS) {
      setServerError(`Límite alcanzado (${MAX_PHOTOS} fotos).`)
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (!video || !canvas) return

    if (video.readyState < 2) {
      setServerError('Cámara iniciándose...')
      video.play().catch(e => console.log(e))
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    canvas.toBlob((blob) => {
      if (!blob) {
        setServerError('Error al generar imagen.')
        return
      }

      const file = new File([blob], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' })

      if (!photoService.isValidFileSize(file)) {
        setServerError('Foto muy pesada.')
        return
      }

      if (totalCurrentPhotos >= MAX_PHOTOS) {
         setServerError(`Límite de ${MAX_PHOTOS} fotos alcanzado.`)
         return
      }

      setSelectedFiles(prev => [...prev, file])
      stopCamera()
      setToast({ show: true, message: '✅ Capturada', type: 'success' })
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
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleClose}></div>

      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 sm:p-8">
          
          <button onClick={handleClose} disabled={isUploading} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
               {hasPriorUploads ? 'Visita completada' : 'Subir Fotos'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">Fotos para {tienda.name}</p>
          </div>

          {/* Info y Contadores */}
          <div className={`mb-6 p-4 border rounded-lg ${hasPriorUploads ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
            <h3 className="font-semibold text-gray-900">{tienda.name}</h3>
            
            {hasPriorUploads ? (
              // MENSAJE SI YA HAY FOTOS SUBIDAS
              <div className="mt-2 text-sm text-green-800 font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Ya se han cargado {safeExistingPhotos.length} fotos para esta visita.
                <span className="block text-xs font-normal text-green-700 ml-1">
                  (Solo se permite una carga por visita)
                </span>
              </div>
            ) : (
              // MENSAJE NORMAL
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-sm font-medium text-blue-700">
                  Seleccionadas: {selectedFiles.length} / {MAX_PHOTOS} 
                </span>
                
                {remainingSlots > 0 ? (
                  <span className="text-xs text-green-600 font-bold bg-green-100 px-2 py-1 rounded-full w-fit">
                    Puedes agregar {remainingSlots} más
                  </span>
                ) : (
                  <span className="text-xs text-red-600 font-bold bg-red-100 px-2 py-1 rounded-full w-fit">
                    Límite alcanzado
                  </span>
                )}
              </div>
            )}
          </div>

          {/* SOLO MOSTRAR CONTROLES SI NO HAY FOTOS PREVIAS */}
          {!hasPriorUploads && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isCameraActive ? 'Captura foto' : 'Agregar fotos'}
              </label>

              {!isCameraActive ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
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
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Seleccionar Archivos
                    </button>

                    <button
                      onClick={startCamera}
                      disabled={isUploading || remainingSlots === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Usar Cámara
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 pointer-events-none"><div className="absolute inset-4 border-2 border-white/50 rounded-lg"></div></div>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button onClick={stopCamera} disabled={isUploading} className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg">
                      Cancelar
                    </button>
                    <button onClick={capturePhoto} disabled={isUploading} className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg">
                      Capturar Foto
                    </button>
                  </div>
                </div>
              )}

              {cameraError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{cameraError}</p>
                  <button onClick={startCamera} className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium underline">Intentar nuevamente</button>
                </div>
              )}
            </div>
          )}

          {/* Previsualización de archivos seleccionados */}
          {previews.length > 0 && (
            <div className="mb-6 max-h-96 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Fotos seleccionadas para subir</h3>
              <div className="space-y-4">
                {previews.map((preview, index) => (
                  <div key={preview.id} className="flex gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <img src={preview.url} alt={preview.name} className="w-20 h-20 object-cover rounded flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{preview.name}</p>
                      <p className="text-xs text-gray-500 mb-2">{(preview.size / 1024 / 1024).toFixed(2)} MB</p>
                      <input
                        type="text"
                        placeholder="Descripción"
                        value={descriptions[index] || ''}
                        onChange={(e) => handleDescriptionChange(index, e.target.value)}
                        disabled={isUploading}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button onClick={() => handleRemoveFile(index)} disabled={isUploading} className="flex-shrink-0 text-red-600 hover:text-red-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Si ya hay fotos subidas (existingPhotos), mostramos una lista simple de solo lectura si lo deseas, o nada.
              En este código, simplemente no mostramos el área de selección y en la parte de botones solo dejamos "Cerrar" */}

          {isUploading && (
            <div className="mb-6">
              <div className="flex justify-between mb-2 text-sm text-gray-700"><span>Subiendo...</span><span>{uploadProgress}%</span></div>
              <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div></div>
            </div>
          )}

          {serverError && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 whitespace-pre-line">{serverError}</div>}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!hasPriorUploads ? (
              // BOTONES NORMALES DE SUBIDA
              <>
                <button onClick={handleUpload} disabled={isUploading || selectedFiles.length === 0} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50">
                  {isUploading ? 'Subiendo...' : `Subir ${selectedFiles.length} foto(s)`}
                </button>
                <button onClick={handleClose} disabled={isUploading} className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
              </>
            ) : (
              // BOTÓN ÚNICO DE CERRAR SI YA SE COMPLETÓ
              <button onClick={handleClose} className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg">
                Cerrar
              </button>
            )}
          </div>
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} isVisible={toast.show} onClose={() => setToast({ ...toast, show: false })} duration={3000} />
    </div>
  )
}

export default PhotoUploadModal