import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tokenStorage } from '../utils/tokenStorage'
import { visitService } from '../services/visitService'
import Toast from '../components/Toast'

function StoreQRScanView() {
  const { qrCode } = useParams()
  const navigate = useNavigate()
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [user, setUser] = useState(null)

  // Verificar autenticación
  useEffect(() => {
    const storedUser = tokenStorage.getUser()
    const token = tokenStorage.getToken()

    if (!storedUser || !token) {
      // Guardar el QR para redirigir después del login
      sessionStorage.setItem('pendingQRCode', qrCode)
      navigate('/login')
      return
    }

    if (storedUser.role !== 'REPARTIDOR') {
      setError('Solo los repartidores pueden registrar visitas')
      setLoading(false)
      return
    }

    setUser(storedUser)
  }, [navigate, qrCode])

  // Cargar información de la tienda
  useEffect(() => {
    if (!user) return

    const fetchStore = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api'
        const token = tokenStorage.getToken()
        const response = await fetch(`${API_URL}/stores/qr/${qrCode}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const data = await response.json()

        if (data.success) {
          setStore(data.data)
          // Obtener ubicación automáticamente al cargar la tienda
          handleGetLocation()
        } else {
          setError(data.message || 'Tienda no encontrada')
        }
      } catch (err) {
        setError('Error al cargar la información')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchStore()
  }, [qrCode, user])

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
            setLocationError('Permiso de ubicación denegado. Por favor, habilita el acceso a tu ubicación.')
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
    const R = 6371e3 // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
  }

  const handleMarkAsVisited = async () => {
    if (!location) {
      setToast({
        show: true,
        message: 'Primero debes obtener tu ubicación actual',
        type: 'error'
      })
      return
    }

    if (!store) {
      setToast({
        show: true,
        message: 'No se pudo cargar la información de la tienda',
        type: 'error'
      })
      return
    }

    // Validación de proximidad en frontend (opcional)
    if (store.latitude && store.longitude) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        store.latitude,
        store.longitude
      )

      if (distance > 100) {
        setToast({
          show: true,
          message: `Estás a ${Math.round(distance)} metros de la tienda. Debes estar a menos de 100 metros.`,
          type: 'error'
        })
        return
      }
    }

    setIsRegistering(true)

    try {
      const visitData = {
        storeId: store.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        storeName: store.name,
        storeAddress: store.address
      }

      await visitService.createVisit(visitData)

      setToast({
        show: true,
        message: `¡Visita a ${store.name} registrada exitosamente!`,
        type: 'success'
      })

      // Redirigir al dashboard después de 2 segundos
      setTimeout(() => {
        navigate('/repartidor')
      }, 2000)
    } catch (error) {
      setToast({
        show: true,
        message: error.message || 'Error al registrar la visita',
        type: 'error'
      })
      console.error('Error al registrar visita:', error)
    } finally {
      setIsRegistering(false)
    }
  }

  const openMap = () => {
    if (store) {
      const url = `https://www.google.com/maps?q=${store.latitude},${store.longitude}`
      window.open(url, '_blank')
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
            <p className="mt-4 text-gray-600 font-medium">Cargando información...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="flex flex-col items-center text-center">
            <div className="bg-red-100 rounded-full p-4 mb-4">
              <svg
                className="w-12 h-12 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/repartidor')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Ir al Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!store || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-6 transform hover:scale-[1.02] transition-transform duration-300">
          {/* Hero Section */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-center mb-2">{store.name}</h1>
            <div className="flex items-center justify-center">
              <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold ${
                store.isActive 
                  ? 'bg-green-400/30 text-white' 
                  : 'bg-red-400/30 text-white'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  store.isActive ? 'bg-green-200' : 'bg-red-200'
                }`}></span>
                {store.isActive ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Address */}
            <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="flex-shrink-0 mt-1">
                <div className="bg-blue-100 rounded-lg p-2">
                  <svg
                    className="w-6 h-6 text-blue-600"
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
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-500 mb-1">Dirección</p>
                <p className="text-base text-gray-900 font-medium">{store.address}</p>
              </div>
            </div>

            {/* Coordinates */}
            {store.latitude && store.longitude && (
              <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex-shrink-0 mt-1">
                  <div className="bg-green-100 rounded-lg p-2">
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-500 mb-1">Coordenadas GPS</p>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Latitud:</span> {store.latitude}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Longitud:</span> {store.longitude}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Location Status */}
            <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
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
                Tu Ubicación
              </h3>

              {isGettingLocation && (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
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
              )}

              {locationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{locationError}</p>
                  <button
                    onClick={handleGetLocation}
                    className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium underline"
                  >
                    Intentar nuevamente
                  </button>
                </div>
              )}

              {location && !isGettingLocation && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
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
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Marcar como Visitada */}
          <button
            onClick={handleMarkAsVisited}
            disabled={isRegistering || isGettingLocation || !location || !!locationError || !store.isActive}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isRegistering ? (
              <>
                <svg
                  className="animate-spin h-6 w-6"
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
                <span>Registrando visita...</span>
              </>
            ) : (
              <>
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Marcar como Visitada</span>
              </>
            )}
          </button>

          {/* Ver en Mapa */}
          {store.latitude && store.longitude && (
            <button
              onClick={openMap}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 flex items-center justify-center space-x-3 border-2 border-gray-200"
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
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <span>Ver en Google Maps</span>
            </button>
          )}

          {/* Volver al Dashboard */}
          <button
            onClick={() => navigate('/repartidor')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-2xl transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Escaneado desde código QR • Usuario: {user.name}
          </p>
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

export default StoreQRScanView
