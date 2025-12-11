import { useState, useEffect } from 'react'
import { visitService } from '../services/visitService'
import Toast from './Toast'

function RegistrarVisitaModal({ isOpen, onClose, tienda, onSuccess, onVisitCreated }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [serverError, setServerError] = useState('')
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false)
      setIsGettingLocation(false)
      setServerError('')
      setLocation(null)
      setLocationError('')
      setToast({ show: false, message: '', type: 'success' })
    } else if (isOpen && tienda) {
      // Obtener ubicación automáticamente cuando se abre el modal
      handleGetLocation()
    }
  }, [isOpen, tienda])

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización')
      return
    }

    setIsGettingLocation(true)
    setLocationError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setLocation({ latitude, longitude, accuracy })
        setIsGettingLocation(false)
      },
      (error) => {
        setIsGettingLocation(false)

        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Permiso de ubicación denegado. Por favor, habilita el acceso a tu ubicación en la configuración del navegador.')
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError('Información de ubicación no disponible.')
            break
          case error.TIMEOUT:
            setLocationError('La solicitud de ubicación expiró. Intenta nuevamente.')
            break
          default:
            setLocationError('Error desconocido al obtener ubicación.')
            break
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    // Fórmula de Haversine para calcular distancia entre dos puntos
    const R = 6371e3 // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    const distance = R * c
    return distance
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!location) {
      setServerError('Primero debes obtener tu ubicación actual')
      return
    }

    // Validación de proximidad en frontend (opcional)
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      tienda.latitude,
      tienda.longitude
    )

    if (distance > 100) {
      setServerError(`Estás a ${Math.round(distance)} metros de la tienda. Debes estar a menos de 100 metros para registrar la visita.`)
      return
    }

    setIsLoading(true)
    setServerError('')

    try {
      const visitData = {
        storeId: tienda.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        storeName: tienda.name,
        storeAddress: tienda.address
      }

      const response = await visitService.createVisit(visitData)

      // Mostrar toast de éxito
      setToast({
        show: true,
        message: `¡Visita a ${tienda.name} registrada exitosamente!`,
        type: 'success'
      })

      // Esperar un momento para que el usuario vea el toast
      setTimeout(() => {
        if (onSuccess) {
          onSuccess()
        }

        // Si hay callback para crear pedido, llamarlo con los datos de la visita
        if (onVisitCreated && response.data) {
          onVisitCreated(response.data)
        }

        onClose()
      }, 1500)
    } catch (error) {
      setServerError(error.message)
      console.error('Error al registrar visita:', error)
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading && !isGettingLocation) {
      setServerError('')
      onClose()
    }
  }

  if (!isOpen || !tienda) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8">
          {/* Close button */}
          <button
            onClick={handleClose}
            disabled={isLoading || isGettingLocation}
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
            <h2 className="text-2xl font-bold text-gray-900">Registrar Visita</h2>
            <p className="text-sm text-gray-600 mt-1">
              Confirma tu ubicación para registrar la visita
            </p>
          </div>

          {/* Tienda Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-gray-900">{tienda.name}</h3>
            <p className="text-sm text-gray-600 mt-1 flex items-start gap-1">
              <svg
                className="w-4 h-4 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {tienda.address}
            </p>
          </div>

          {/* Location Status */}
          <div className="mb-6">
            {isGettingLocation && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <svg
                    className="animate-spin h-5 w-5 text-yellow-600"
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
                  <p className="text-sm text-yellow-800">Obteniendo tu ubicación...</p>
                </div>
              </div>
            )}

            {locationError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{locationError}</p>
                <button
                  onClick={handleGetLocation}
                  className="mt-3 text-sm text-red-700 hover:text-red-800 font-medium underline"
                >
                  Intentar nuevamente
                </button>
              </div>
            )}

            {location && !isGettingLocation && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-green-600 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm text-green-800 font-medium mb-2">Ubicación obtenida</p>
                    <div className="text-xs text-green-700 space-y-1">
                      <p>Lat: {location.latitude.toFixed(6)}</p>
                      <p>Lng: {location.longitude.toFixed(6)}</p>
                      <p>Precisión: ±{Math.round(location.accuracy)}m</p>
                    </div>
                  </div>
                  <button
                    onClick={handleGetLocation}
                    className="text-green-700 hover:text-green-800"
                    title="Actualizar ubicación"
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{serverError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isGettingLocation || !location || !!locationError}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
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
                  Registrando visita...
                </span>
              ) : (
                'Registrar Visita'
              )}
            </button>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading || isGettingLocation}
              className="w-full px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </form>
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

export default RegistrarVisitaModal
