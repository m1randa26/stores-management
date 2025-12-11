class NetworkService {
  constructor() {
    this.isOnline = navigator.onLine
    this.listeners = []

    // Escuchar eventos de conexión
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))

    console.log(`🌐 Network Service iniciado - Estado: ${this.isOnline ? '🟢 Online' : '🔴 Offline'}`)
  }

  handleOnline() {
    console.log('🟢 Conexión restaurada')
    this.isOnline = true
    this.notifyListeners(true)
  }

  handleOffline() {
    console.log('🔴 Sin conexión - Modo offline activado')
    this.isOnline = false
    this.notifyListeners(false)
  }

  // Suscribirse a cambios de conexión
  subscribe(callback) {
    this.listeners.push(callback)
    // Retornar función de unsubscribe
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback)
    }
  }

  notifyListeners(isOnline) {
    this.listeners.forEach(callback => {
      try {
        callback(isOnline)
      } catch (error) {
        console.error('Error en listener de red:', error)
      }
    })
  }

  getStatus() {
    return this.isOnline
  }

  // Verificar conectividad haciendo una petición al servidor
  async checkConnectivity(apiUrl = 'http://localhost:8081/api') {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache'
      })

      clearTimeout(timeout)

      return response.ok
    } catch (error) {
      console.warn('Verificación de conectividad falló:', error.message)
      return false
    }
  }
}

// Exportar singleton
export default new NetworkService()
