import { useState, useEffect, useCallback, useRef } from 'react'
import syncService from '../services/syncService'
import offlineDB from '../services/offlineDB'
import networkService from '../services/networkService'

function SyncStatus() {
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [isOnline, setIsOnline] = useState(networkService.getStatus())
  const mountedRef = useRef(true)

  const loadPendingCount = useCallback(async () => {
    const counts = await offlineDB.getPendingCount()
    if (mountedRef.current) {
      setPendingCount(counts.total)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    loadPendingCount()

    // Actualizar conteo cada 5 segundos
    const interval = setInterval(loadPendingCount, 5000)

    // Suscribirse a cambios de red
    const unsubscribeNetwork = networkService.subscribe((online) => {
      if (mountedRef.current) {
        setIsOnline(online)
      }
      if (online) {
        loadPendingCount()
      }
    })

    // Suscribirse a resultados de sincronización
    const unsubscribeSync = syncService.subscribe((result) => {
      if (mountedRef.current) {
        setLastSyncResult(result)
      }
      loadPendingCount()

      // Auto-ocultar después de 5 segundos
      setTimeout(() => {
        if (mountedRef.current) {
          setLastSyncResult(null)
        }
      }, 5000)
    })

    return () => {
      mountedRef.current = false
      clearInterval(interval)
      unsubscribeNetwork()
      unsubscribeSync()
    }
  }, [loadPendingCount])

  async function handleManualSync() {
    if (!isOnline) {
      alert('No hay conexión a internet. La sincronización se realizará automáticamente cuando se recupere la conexión.')
      return
    }

    setSyncing(true)
    const result = await syncService.syncAll()
    setLastSyncResult(result)
    await loadPendingCount()
    setSyncing(false)
  }

  // No mostrar nada si no hay elementos pendientes y no hay resultado reciente
  if (pendingCount === 0 && !lastSyncResult) return null

  return (
    <>
      {/* Botón flotante */}
      <div
        className="fixed bottom-6 right-6 z-50"
        style={{
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
        }}
      >
        <button
          onClick={() => pendingCount > 0 ? handleManualSync() : setShowDetails(!showDetails)}
          disabled={syncing}
          className={`flex items-center gap-3 px-5 py-3 rounded-full font-medium text-white transition-all ${
            syncing
              ? 'bg-gray-500 cursor-wait'
              : pendingCount > 0
              ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              : 'bg-green-600 hover:bg-green-700 cursor-pointer'
          }`}
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          {syncing ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
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
              <span className="text-sm">Sincronizando...</span>
            </>
          ) : pendingCount > 0 ? (
            <>
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
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm">
                {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                {isOnline ? ' - Click para sincronizar' : ' - Sin conexión'}
              </span>
            </>
          ) : (
            <>
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm">Todo sincronizado</span>
            </>
          )}
        </button>
      </div>

      {/* Resultado de sincronización */}
      {lastSyncResult && (
        <div
          className={`fixed bottom-24 right-6 z-50 max-w-sm rounded-lg shadow-lg p-4 ${
            lastSyncResult.success ? 'bg-white border border-gray-200' : 'bg-red-50 border border-red-200'
          }`}
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          <div className="flex items-start gap-3">
            {lastSyncResult.success ? (
              <svg
                className="w-6 h-6 text-green-600 flex-shrink-0"
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
            ) : (
              <svg
                className="w-6 h-6 text-red-600 flex-shrink-0"
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
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${lastSyncResult.success ? 'text-gray-900' : 'text-red-900'}`}>
                {lastSyncResult.message}
              </p>
              {lastSyncResult.success && (
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  {lastSyncResult.visits && lastSyncResult.visits.synced > 0 && (
                    <p>✅ Visitas: {lastSyncResult.visits.synced}</p>
                  )}
                  {lastSyncResult.orders && lastSyncResult.orders.synced > 0 && (
                    <p>✅ Órdenes: {lastSyncResult.orders.synced}</p>
                  )}
                  {lastSyncResult.photos && lastSyncResult.photos.synced > 0 && (
                    <p>✅ Fotos: {lastSyncResult.photos.synced}</p>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setLastSyncResult(null)}
              className="text-gray-400 hover:text-gray-600"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default SyncStatus
