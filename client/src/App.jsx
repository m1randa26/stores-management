import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Dashboard from './pages/Dashboard'
import RepartidorDashboard from './pages/RepartidorDashboard'
import StoreQRView from './pages/StoreQRView'
import StoreQRScanView from './pages/StoreQRScanView'
import NetworkIndicator from './components/NetworkIndicator'
import SyncStatus from './components/SyncStatus'
import { tokenStorage } from './utils/tokenStorage'
import syncService from './services/syncService'
import networkService from './services/networkService'

function ProtectedRoute({ children, allowedRoles }) {
  const token = tokenStorage.getToken()
  const user = tokenStorage.getUser()

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  // Si se especifican roles permitidos, validar
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirigir según el rol del usuario
    if (user.role === 'ADMIN') {
      return <Navigate to="/dashboard" replace />
    } else if (user.role === 'REPARTIDOR') {
      return <Navigate to="/repartidor" replace />
    }
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  const user = tokenStorage.getUser()

  // Inicializar servicios offline
  useEffect(() => {
    console.log('🚀 Inicializando aplicación con soporte offline...')
    console.log('🌐 Estado de red:', networkService.getStatus() ? 'Online' : 'Offline')

    // Iniciar sincronización automática
    syncService.startAutoSync()

    // Si hay conexión y usuario autenticado, sincronizar inmediatamente
    if (networkService.getStatus() && user) {
      console.log('🔄 Sincronizando datos pendientes...')
      setTimeout(() => {
        syncService.syncAll()
      }, 1000)
    }

    // Cleanup al desmontar
    return () => {
      syncService.stopAutoSync()
    }
  }, [user])

  // Función para determinar la ruta por defecto
  const getDefaultRoute = () => {
    if (!user) return '/login'
    if (user.role === 'ADMIN') return '/dashboard'
    if (user.role === 'REPARTIDOR') return '/repartidor'
    return '/login'
  }

  return (
    <BrowserRouter>
      {/* Indicador de conexión */}
      <NetworkIndicator />

      {/* Estado de sincronización (solo para usuarios autenticados) */}
      {user && <SyncStatus />}

      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Ruta pública para ver info de tienda (sin autenticación) */}
        <Route path="/stores/qr/:qrCode" element={<StoreQRView />} />
        {/* Ruta protegida para escanear y registrar visita (requiere autenticación) */}
        <Route path="/stores/scan/:qrCode" element={<StoreQRScanView />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/repartidor"
          element={
            <ProtectedRoute allowedRoles={['REPARTIDOR']}>
              <RepartidorDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
