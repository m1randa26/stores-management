import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

function QRScannerModal({ isOpen, onClose, onScan }) {
  const [error, setError] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState(null)
  const html5QrCodeRef = useRef(null)
  const scannerContainerId = 'qr-reader-container'

  const getErrorMessage = useCallback((err) => {
    const errorName = err?.name || ''
    const errorMessage = err?.message || ''

    if (errorName === 'NotAllowedError' || errorMessage.includes('Permission denied')) {
      return 'Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración de tu navegador.'
    }
    if (errorName === 'NotFoundError' || errorMessage.includes('Requested device not found')) {
      return 'No se encontró ninguna cámara en el dispositivo.'
    }
    if (errorName === 'NotReadableError' || errorMessage.includes('Could not start video source')) {
      return 'La cámara está siendo usada por otra aplicación.'
    }
    if (errorMessage.includes('SSL') || errorMessage.includes('https')) {
      return 'El escáner QR requiere una conexión segura (HTTPS).'
    }
    return 'Error al acceder a la cámara. Intenta de nuevo.'
  }, [])

  const extractQRCode = useCallback((text) => {
    if (text.includes('/stores/scan/')) {
      const parts = text.split('/stores/scan/')
      const code = parts[1]?.split('?')[0]?.split('/')[0]
      return code || null
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(text)) {
      return text
    }
    return null
  }, [])

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState()
        if (state === 2) {
          await html5QrCodeRef.current.stop()
        }
        html5QrCodeRef.current.clear()
      } catch (err) {
        console.warn('Error al detener escáner:', err)
      }
      html5QrCodeRef.current = null
    }
    setIsScanning(false)
  }, [])

  const handleScanSuccess = useCallback(async (decodedText) => {
    console.log('📷 QR detectado:', decodedText)

    if (navigator.vibrate) {
      navigator.vibrate(200)
    }

    await stopScanner()

    const qrCode = extractQRCode(decodedText)

    if (qrCode) {
      console.log('✅ Código QR extraído:', qrCode)
      onScan(qrCode)
    } else {
      setError('Código QR no válido para esta aplicación')
    }
  }, [stopScanner, extractQRCode, onScan])

  const handleScanError = useCallback((errorMessage) => {
    if (!errorMessage.includes('No QR code found') && 
        !errorMessage.includes('NotFoundException')) {
      console.warn('Error de escaneo:', errorMessage)
    }
  }, [])

  const startScanner = useCallback(async () => {
    try {
      setError('')
      setIsScanning(false)
      setHasPermission(null)

      const container = document.getElementById(scannerContainerId)
      if (!container) {
        console.error('Container no encontrado')
        return
      }

      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop()
        } catch {
          // Ignorar
        }
        html5QrCodeRef.current = null
      }

      html5QrCodeRef.current = new Html5Qrcode(scannerContainerId)

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        handleScanSuccess,
        handleScanError
      )

      setIsScanning(true)
      setHasPermission(true)
      console.log('✅ Escáner QR iniciado')
    } catch (err) {
      console.error('Error al iniciar escáner:', err)
      setHasPermission(false)
      setError(getErrorMessage(err))
      setIsScanning(false)
    }
  }, [handleScanSuccess, handleScanError, getErrorMessage])

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startScanner()
      }, 100)
      return () => clearTimeout(timer)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      stopScanner()
    }
  }, [isOpen, startScanner, stopScanner])

  const handleClose = async () => {
    await stopScanner()
    setError('')
    onClose()
  }

  const handleRetry = () => {
    setError('')
    startScanner()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
              Escanear Código QR
            </h2>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scanner Area */}
        <div className="p-4">
          <div className="relative">
            <div
              id={scannerContainerId}
              className="w-full aspect-square bg-gray-900 rounded-xl overflow-hidden"
            />

            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-white/50 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
                  <div className="absolute inset-x-4 h-0.5 bg-green-400 animate-pulse top-1/2" />
                </div>
              </div>
            )}
          </div>

          {isScanning && (
            <p className="text-center text-gray-600 mt-4 text-sm">
              Apunta la cámara al código QR de la tienda
            </p>
          )}

          {!isScanning && !error && hasPermission === null && (
            <div className="mt-4 flex flex-col items-center justify-center gap-3 py-4">
              <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-gray-600 text-sm">Iniciando cámara...</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="bg-red-100 rounded-full p-2 flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={handleRetry}
                    className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Intentar de nuevo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={handleClose}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default QRScannerModal
