import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

function QRModal({ isOpen, onClose, tienda }) {
  const qrRef = useRef(null)
  // Generar URL que apunta a la ruta de escaneo protegida
  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin
  const qrUrl = tienda ? `${baseUrl}/stores/scan/${tienda.qrCode}` : ''

  const handleDownload = () => {
    if (qrRef.current) {
      const canvas = qrRef.current.querySelector('canvas')
      if (canvas) {
        const url = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        link.download = `QR-${tienda.name.replace(/\s+/g, '-')}.png`
        link.href = url
        link.click()
      }
    }
  }

  if (!isOpen || !tienda) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
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
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900">{tienda.name}</h2>
            <p className="text-sm text-gray-600 mt-1">{tienda.address}</p>
          </div>

          {/* QR Code */}
          <div
            ref={qrRef}
            className="flex justify-center items-center bg-white p-6 rounded-xl border-2 border-gray-200 mb-6"
          >
            <QRCodeCanvas
              value={qrUrl}
              size={256}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* QR Code Value */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">URL del código QR:</p>
            <p className="text-sm font-mono text-gray-900 break-all">
              {qrUrl}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Descargar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QRModal
