import { useState, useRef, useEffect } from 'react'
import { storeService } from '../services/storeService'
import Toast from './Toast'

function AsignarRepartidorModal({ isOpen, onClose, tienda, repartidores, onSuccess }) {
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [actionUserId, setActionUserId] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const prevIsOpenRef = useRef(isOpen)

  // Reset error when modal closes (using ref to detect transition)
  useEffect(() => {
    // Only reset when transitioning from open to closed
    if (prevIsOpenRef.current && !isOpen) {
      setIsLoading(false)
      setServerError('')
      setActionUserId(null)
      setToast({ show: false, message: '', type: 'success' })
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen])

  const handleAssign = async (userId) => {
    setIsLoading(true)
    setActionUserId(userId)
    setServerError('')

    try {
      await storeService.assignStore(tienda.id, userId)

      // Obtener nombre del repartidor
      const repartidor = repartidores.find(r => r.id === userId)
      const repartidorName = repartidor?.name || 'Repartidor'

      // Mostrar toast de éxito
      setToast({
        show: true,
        message: `¡${repartidorName} ha sido asignado exitosamente a ${tienda.name}!`,
        type: 'success'
      })

      // Esperar un momento para que el usuario vea el toast
      setTimeout(() => {
        // Llamar callback de éxito
        if (onSuccess) {
          onSuccess()
        }
        // Cerrar modal
        onClose()
      }, 1500)
    } catch (error) {
      setServerError(error.message)
      console.error('Error al asignar tienda:', error)
      setIsLoading(false)
      setActionUserId(null)
    }
  }

  const handleUnassign = async (userId) => {
    setIsLoading(true)
    setActionUserId(userId)
    setServerError('')

    try {
      await storeService.unassignStore(tienda.id, userId)

      // Obtener nombre del repartidor
      const repartidor = repartidores.find(r => r.id === userId)
      const repartidorName = repartidor?.name || 'Repartidor'

      // Mostrar toast de éxito
      setToast({
        show: true,
        message: `¡${repartidorName} ha sido desasignado exitosamente de ${tienda.name}!`,
        type: 'success'
      })

      // Esperar un momento para que el usuario vea el toast
      setTimeout(() => {
        // Llamar callback de éxito
        if (onSuccess) {
          onSuccess()
        }
        // Cerrar modal
        onClose()
      }, 1500)
    } catch (error) {
      setServerError(error.message)
      console.error('Error al desasignar tienda:', error)
      setIsLoading(false)
      setActionUserId(null)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setServerError('')
      onClose()
    }
  }

  if (!isOpen || !tienda) return null

  // Verificar si hay un repartidor asignado (solo puede haber uno)
  const assignedRepartidor = tienda.assignments && tienda.assignments.length > 0
    ? repartidores.find(r => r.id === tienda.assignments[0].userId)
    : null

  // Filtrar repartidores disponibles (solo si NO hay asignación)
  const availableRepartidores = !assignedRepartidor
    ? repartidores
    : []

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          {/* Close button */}
          <button
            onClick={handleClose}
            disabled={isLoading}
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
            <h2 className="text-2xl font-bold text-gray-900">
              {assignedRepartidor ? 'Repartidor Asignado' : 'Asignar Repartidor'}
            </h2>
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-gray-900">{tienda.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{tienda.address}</p>
            </div>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{serverError}</p>
            </div>
          )}

          {/* Repartidor Asignado */}
          {assignedRepartidor && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Repartidor Actual
              </h3>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
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
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{assignedRepartidor.name}</p>
                      <p className="text-sm text-gray-600">{assignedRepartidor.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center text-green-600">
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>

                {/* Botón de desasignar */}
                <button
                  onClick={() => handleUnassign(assignedRepartidor.id)}
                  disabled={isLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading && actionUserId === assignedRepartidor.id ? (
                    <span className="flex items-center">
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
                      Desasignando...
                    </span>
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
                          d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"
                        />
                      </svg>
                      Quitar asignación
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Available Repartidores (solo si NO hay asignación) */}
          {!assignedRepartidor && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Repartidores Disponibles
              </h3>

              {availableRepartidores.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-lg">
                  <svg
                    className="w-12 h-12 mx-auto text-gray-400 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <p className="text-gray-600">
                    No hay repartidores disponibles para asignar
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableRepartidores.map((repartidor) => (
                    <div
                      key={repartidor.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
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
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{repartidor.name}</p>
                          <p className="text-sm text-gray-600 truncate">{repartidor.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssign(repartidor.id)}
                        disabled={isLoading}
                        className="ml-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading && actionUserId === repartidor.id ? (
                          <span className="flex items-center">
                            <svg
                              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                            Asignando...
                          </span>
                        ) : (
                          'Asignar'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Close button */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="w-full px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cerrar
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

export default AsignarRepartidorModal
