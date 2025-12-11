import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tokenStorage } from '../utils/tokenStorage'
import { storeService } from '../services/storeService'
import { visitService } from '../services/visitService'
import { orderService } from '../services/orderService'
import { requestNotificationPermission, onMessageListener } from '../services/fcmService'
import RegistrarVisitaModal from '../components/RegistrarVisitaModal'
import CrearPedidoModal from '../components/CrearPedidoModal'
import PhotoUploadModal from '../components/PhotoUploadModal'
import PhotoGalleryModal from '../components/PhotoGalleryModal'

function RepartidorDashboard() {
  const [activeTab, setActiveTab] = useState('asignaciones')
  const [user, setUser] = useState(null)
  const [tiendas, setTiendas] = useState([])
  const [visitas, setVisitas] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(true)
  const [isLoadingVisitas, setIsLoadingVisitas] = useState(true)
  const [isLoadingOrdenes, setIsLoadingOrdenes] = useState(true)
  const [errorTiendas, setErrorTiendas] = useState('')
  const [errorVisitas, setErrorVisitas] = useState('')
  const [errorOrdenes, setErrorOrdenes] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const storedUser = tokenStorage.getUser()
    const token = tokenStorage.getToken()

    if (!storedUser || !token) {
      navigate('/login')
      return
    }

    // Verificar que sea repartidor
    if (storedUser.role !== 'REPARTIDOR') {
      navigate('/dashboard')
      return
    }

    setUser(storedUser)
    
    // Solicitar permiso de notificaciones y guardar token FCM
    requestNotificationPermission().then(async (fcmToken) => {
      if (fcmToken) {
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081'
          const response = await fetch(`${API_URL}/api/fcm/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              token: fcmToken,
              deviceInfo: navigator.userAgent
            })
          })
          
          if (response.ok) {
            console.log('✅ Token FCM guardado en el servidor')
          } else {
            console.error('❌ Error al guardar token FCM')
          }
        } catch (error) {
          console.error('❌ Error al enviar token FCM al servidor:', error)
        }
      }
    })

    // Escuchar notificaciones en primer plano
    onMessageListener()
      .then((payload) => {
        console.log('📩 Notificación recibida:', payload)
        // Mostrar notificación nativa del navegador
        if (Notification.permission === 'granted') {
          new Notification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/icon-192x192.png',
            data: payload.data
          })
        }
      })
      .catch((err) => console.error('Error al escuchar mensajes:', err))
  }, [navigate])

  const fetchTiendasAsignadas = async () => {
    try {
      setIsLoadingTiendas(true)
      setErrorTiendas('')
      const response = await storeService.getStores()

      // Filtrar solo las tiendas asignadas al usuario actual
      const tiendasAsignadas = response.data.filter(tienda =>
        tienda.assignments && tienda.assignments.some(assignment => assignment.userId === user?.id)
      )

      setTiendas(tiendasAsignadas)
    } catch (error) {
      setErrorTiendas(error.message)
      console.error('Error al cargar tiendas asignadas:', error)
    } finally {
      setIsLoadingTiendas(false)
    }
  }

  const fetchVisitas = async (filters = {}) => {
    try {
      setIsLoadingVisitas(true)
      setErrorVisitas('')
      const response = await visitService.getMyVisits(filters)
      setVisitas(response.data)
    } catch (error) {
      setErrorVisitas(error.message)
      console.error('Error al cargar visitas:', error)
    } finally {
      setIsLoadingVisitas(false)
    }
  }

  const fetchOrdenes = async (filters = {}) => {
    try {
      setIsLoadingOrdenes(true)
      setErrorOrdenes('')
      const response = await orderService.getMyOrders(filters)
      setOrdenes(response.data)
    } catch (error) {
      setErrorOrdenes(error.message)
      console.error('Error al cargar órdenes:', error)
    } finally {
      setIsLoadingOrdenes(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchTiendasAsignadas()
      fetchVisitas()
      fetchOrdenes()
    }
  }, [user])

  const handleLogout = () => {
    tokenStorage.clearAll()
    navigate('/login')
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Panel de Repartidor
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Bienvenido, {user.name}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Toggle Tabs */}
        <div className="bg-white rounded-xl shadow-sm p-2 mb-6">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setActiveTab('asignaciones')}
              className={`py-3 px-2 rounded-lg font-medium text-xs sm:text-base transition-all duration-200 ${
                activeTab === 'asignaciones'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="hidden sm:inline">Asignaciones de Tiendas</span>
              <span className="sm:hidden">Tiendas</span>
            </button>
            <button
              onClick={() => setActiveTab('visitas')}
              className={`py-3 px-2 rounded-lg font-medium text-xs sm:text-base transition-all duration-200 ${
                activeTab === 'visitas'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="hidden sm:inline">Mis Visitas</span>
              <span className="sm:hidden">Visitas</span>
            </button>
            <button
              onClick={() => setActiveTab('ordenes')}
              className={`py-3 px-2 rounded-lg font-medium text-xs sm:text-base transition-all duration-200 ${
                activeTab === 'ordenes'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="hidden sm:inline">Mis Órdenes</span>
              <span className="sm:hidden">Órdenes</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'asignaciones' ? (
            <AsignacionesTab
              tiendas={tiendas}
              isLoading={isLoadingTiendas}
              error={errorTiendas}
              onReload={fetchTiendasAsignadas}
              onVisitRegistered={fetchVisitas}
              onOrderCreated={fetchOrdenes}
            />
          ) : activeTab === 'visitas' ? (
            <VisitasTab
              visitas={visitas}
              isLoading={isLoadingVisitas}
              error={errorVisitas}
              onReload={fetchVisitas}
            />
          ) : (
            <OrdenesTab
              ordenes={ordenes}
              isLoading={isLoadingOrdenes}
              error={errorOrdenes}
              onReload={fetchOrdenes}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function AsignacionesTab({ tiendas, isLoading, error, onReload, onVisitRegistered, onOrderCreated }) {
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false)
  const [isPedidoModalOpen, setIsPedidoModalOpen] = useState(false)
  const [selectedTienda, setSelectedTienda] = useState(null)
  const [currentVisita, setCurrentVisita] = useState(null)

  const handleRegistrarVisita = (tienda) => {
    setSelectedTienda(tienda)
    setIsVisitModalOpen(true)
  }

  const handleVisitSuccess = () => {
    if (onReload) {
      onReload()
    }
    if (onVisitRegistered) {
      onVisitRegistered()
    }
  }

  const handleVisitCreated = (visitaData) => {
    // Guardar los datos de la visita para crear el pedido
    setCurrentVisita(visitaData)
    // Abrir modal de pedido
    setIsPedidoModalOpen(true)
  }

  const handlePedidoSuccess = () => {
    if (onOrderCreated) {
      onOrderCreated()
    }
    if (onVisitRegistered) {
      onVisitRegistered()
    }
  }

  return (
    <div>
      <RegistrarVisitaModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        tienda={selectedTienda}
        onSuccess={handleVisitSuccess}
        onVisitCreated={handleVisitCreated}
      />

      <CrearPedidoModal
        isOpen={isPedidoModalOpen}
        onClose={() => {
          setIsPedidoModalOpen(false)
          setCurrentVisita(null)
        }}
        visita={currentVisita}
        tienda={selectedTienda}
        onSuccess={handlePedidoSuccess}
      />

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Mis Tiendas Asignadas</h2>
        <button
          onClick={onReload}
          className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
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
          Actualizar
        </button>
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
      {error && !isLoading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 text-center">{error}</p>
        </div>
      )}

      {/* Grid de tiendas */}
      {!isLoading && !error && tiendas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiendas.map((tienda) => (
            <div
              key={tienda.id}
              className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
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
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                </div>
                <span
                  className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    tienda.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {tienda.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 text-lg">
                {tienda.name}
              </h3>
              <p className="text-sm text-gray-500 mb-3 flex items-start gap-1">
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

              {/* Coordenadas */}
              <div className="text-xs text-gray-500 mb-4 space-y-1">
                <p className="flex items-center gap-1">
                  <span className="font-medium">Lat:</span> {tienda.latitude}
                </p>
                <p className="flex items-center gap-1">
                  <span className="font-medium">Lng:</span> {tienda.longitude}
                </p>
              </div>

              {/* Botón de registrar visita */}
              <button
                onClick={() => handleRegistrarVisita(tienda)}
                disabled={!tienda.isActive}
                className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Registrar Visita
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && tiendas.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No tienes tiendas asignadas
          </h3>
          <p className="text-gray-500 text-sm">
            Actualmente no tienes tiendas asignadas para realizar visitas.
            <br />
            Contacta con el administrador si crees que es un error.
          </p>
        </div>
      )}
    </div>
  )
}

function VisitasTab({ visitas, isLoading, error, onReload }) {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    hasOrder: ''
  })
  const [isPhotoUploadModalOpen, setIsPhotoUploadModalOpen] = useState(false)
  const [isPhotoGalleryModalOpen, setIsPhotoGalleryModalOpen] = useState(false)
  const [selectedVisita, setSelectedVisita] = useState(null)
  const [selectedTienda, setSelectedTienda] = useState(null)

  const handleFilterChange = (filterName, value) => {
    const newFilters = { ...filters, [filterName]: value }
    setFilters(newFilters)

    // Aplicar filtros
    const appliedFilters = {}
    if (newFilters.startDate) appliedFilters.startDate = newFilters.startDate
    if (newFilters.endDate) appliedFilters.endDate = newFilters.endDate
    if (newFilters.hasOrder !== '') appliedFilters.hasOrder = newFilters.hasOrder === 'true'

    if (onReload) {
      onReload(appliedFilters)
    }
  }

  const handleClearFilters = () => {
    setFilters({ startDate: '', endDate: '', hasOrder: '' })
    if (onReload) {
      onReload()
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleUploadPhotos = (visita) => {
    setSelectedVisita(visita)
    setSelectedTienda(visita.store)
    setIsPhotoUploadModalOpen(true)
  }

  const handleViewPhotos = (visita) => {
    setSelectedVisita(visita)
    setSelectedTienda(visita.store)
    setIsPhotoGalleryModalOpen(true)
  }

  const handlePhotoUploadSuccess = () => {
    if (onReload) {
      onReload()
    }
  }

  return (
    <div>
      <PhotoUploadModal
        isOpen={isPhotoUploadModalOpen}
        onClose={() => {
          setIsPhotoUploadModalOpen(false)
          setSelectedVisita(null)
          setSelectedTienda(null)
        }}
        visita={selectedVisita}
        tienda={selectedTienda}
        existingPhotos={selectedVisita?.photos || []}
        onSuccess={handlePhotoUploadSuccess}
      />

      <PhotoGalleryModal
        isOpen={isPhotoGalleryModalOpen}
        onClose={() => {
          setIsPhotoGalleryModalOpen(false)
          setSelectedVisita(null)
          setSelectedTienda(null)
        }}
        visita={selectedVisita}
        tienda={selectedTienda}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900">Historial de Visitas</h2>
        <button
          onClick={() => onReload()}
          className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
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
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha inicio
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha fin
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Con orden
            </label>
            <select
              value={filters.hasOrder}
              onChange={(e) => handleFilterChange('hasOrder', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            >
              <option value="">Todas</option>
              <option value="true">Con orden</option>
              <option value="false">Sin orden</option>
            </select>
          </div>
        </div>
        {(filters.startDate || filters.endDate || filters.hasOrder) && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Limpiar filtros
          </button>
        )}
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
      {error && !isLoading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 text-center">{error}</p>
        </div>
      )}

      {/* Lista de visitas */}
      {!isLoading && !error && visitas.length > 0 && (
        <div className="space-y-3">
          {visitas.map((visita) => (
            <div
              key={visita.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {visita.store?.name || 'Tienda sin nombre'}
                    </h3>
                    {visita.isOffline && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                        Pendiente de sincronizar
                      </span>
                    )}
                    {visita.order && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        Con orden
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {visita.store?.address || 'Dirección no disponible'}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {formatDate(visita.visitedAt)}
                    </span>
                    {visita._count?.photos > 0 && (
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
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
                        {visita._count.photos} {visita._count.photos === 1 ? 'foto' : 'fotos'}
                      </span>
                    )}
                  </div>
                </div>
                {visita.order && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      ${parseFloat(visita.order.total).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {visita.order.status}
                    </p>
                  </div>
                )}
              </div>

              {/* Photo Actions */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                <button
                  onClick={() => handleUploadPhotos(visita)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <svg
                    className="w-4 h-4"
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
                  Subir Fotos
                </button>
                <button
                  onClick={() => handleViewPhotos(visita)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                >
                  <svg
                    className="w-4 h-4"
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
                  Ver Galería ({visita._count?.photos || 0})
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && visitas.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay visitas registradas
          </h3>
          <p className="text-gray-500 text-sm">
            {filters.startDate || filters.endDate || filters.hasOrder
              ? 'No hay visitas que coincidan con los filtros seleccionados.'
              : 'Aún no has registrado ninguna visita. Ve a la pestaña de Asignaciones para registrar tu primera visita.'}
          </p>
        </div>
      )}
    </div>
  )
}

function OrdenesTab({ ordenes, isLoading, error, onReload }) {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: ''
  })

  const handleFilterChange = (filterName, value) => {
    const newFilters = { ...filters, [filterName]: value }
    setFilters(newFilters)

    // Aplicar filtros
    const appliedFilters = {}
    if (newFilters.startDate) appliedFilters.startDate = newFilters.startDate
    if (newFilters.endDate) appliedFilters.endDate = newFilters.endDate
    if (newFilters.status) appliedFilters.status = newFilters.status

    if (onReload) {
      onReload(appliedFilters)
    }
  }

  const handleClearFilters = () => {
    setFilters({ startDate: '', endDate: '', status: '' })
    if (onReload) {
      onReload()
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status) => {
    const badges = {
      'PENDING': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendiente' },
      'SYNCED': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sincronizada' },
      'PROCESSING': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Procesando' },
      'COMPLETED': { bg: 'bg-green-100', text: 'text-green-700', label: 'Completada' },
      'CANCELLED': { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelada' }
    }
    return badges[status] || badges['PENDING']
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900">Mis Órdenes</h2>
        <button
          onClick={() => onReload()}
          className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
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
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha inicio
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha fin
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            >
              <option value="">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="SYNCED">Sincronizada</option>
              <option value="PROCESSING">Procesando</option>
              <option value="COMPLETED">Completada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </div>
        </div>
        {(filters.startDate || filters.endDate || filters.status) && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Limpiar filtros
          </button>
        )}
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
      {error && !isLoading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 text-center">{error}</p>
        </div>
      )}

      {/* Lista de órdenes */}
      {!isLoading && !error && ordenes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ordenes.map((orden) => {
            const statusBadge = getStatusBadge(orden.status)
            return (
              <div
                key={orden.id}
                className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {orden.store?.name || 'Tienda sin nombre'}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {orden.store?.address || 'Dirección no disponible'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(orden.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {orden.isOffline && (
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                        Pendiente de sincronizar
                      </span>
                    )}
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">
                      {orden._count.items} {orden._count.items === 1 ? 'producto' : 'productos'}
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      ${parseFloat(orden.total).toFixed(2)}
                    </span>
                  </div>

                  {/* Productos en la orden */}
                  {orden.items && orden.items.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {orden.items.slice(0, 3).map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-xs text-gray-600">
                          <span className="truncate">
                            {item.quantity}x {item.product?.name || 'Producto sin nombre'}
                          </span>
                          <span className="ml-2 flex-shrink-0">
                            ${(item.quantity * parseFloat(item.unitPrice)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {orden.items.length > 3 && (
                        <p className="text-xs text-gray-500 italic">
                          +{orden.items.length - 3} productos más...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && ordenes.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay órdenes registradas
          </h3>
          <p className="text-gray-500 text-sm">
            {filters.startDate || filters.endDate || filters.status
              ? 'No hay órdenes que coincidan con los filtros seleccionados.'
              : 'Aún no has creado ninguna orden. Registra una visita y crea tu primera orden.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default RepartidorDashboard
