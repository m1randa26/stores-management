import { useState, useEffect } from 'react'
import networkService from '../services/networkService'

function NetworkIndicator() {
  const [isOnline, setIsOnline] = useState(networkService.getStatus())
  const [showMessage, setShowMessage] = useState(!networkService.getStatus())

  useEffect(() => {
    const unsubscribe = networkService.subscribe((online) => {
      setIsOnline(online)

      if (!online) {
        // Mostrar inmediatamente cuando se pierde conexión
        setShowMessage(true)
      } else {
        // Mostrar brevemente cuando se recupera conexión
        setShowMessage(true)
        setTimeout(() => {
          setShowMessage(false)
        }, 3000) // Ocultar después de 3 segundos
      }
    })

    return unsubscribe
  }, [])

  // No mostrar nada si hay conexión y ya pasó el tiempo
  if (isOnline && !showMessage) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-300 ${
        isOnline
          ? 'bg-green-600'
          : 'bg-orange-600'
      }`}
      style={{
        padding: '12px',
        textAlign: 'center',
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}
    >
      <div className="flex items-center justify-center gap-2">
        {isOnline ? (
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
            <span>Conexión restaurada - Sincronizando datos...</span>
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
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
              />
            </svg>
            <span>Sin conexión - Modo offline activado</span>
          </>
        )}
      </div>
    </div>
  )
}

export default NetworkIndicator
