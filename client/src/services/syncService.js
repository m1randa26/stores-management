import networkService from './networkService'
import { visitService } from './visitService'
import { orderService } from './orderService'
import { photoService } from './photoService'
import offlineDB from './offlineDB'

class SyncService {
  constructor() {
    this.isSyncing = false
    this.syncInterval = null
    this.listeners = []

    // Suscribirse a cambios de conexión
    networkService.subscribe(this.handleConnectionChange.bind(this))
  }

  async handleConnectionChange(isOnline) {
    if (isOnline) {
      console.log('🔄 Conexión restaurada - iniciando sincronización automática...')

      // Esperar un poco para que la conexión se estabilice
      setTimeout(async () => {
        const result = await this.syncAll()
        this.notifyListeners(result)
      }, 2000)
    } else {
      console.log('📴 Sin conexión - modo offline activado')
      this.stopAutoSync()
    }
  }

  async syncAll() {
    if (this.isSyncing) {
      console.log('⏳ Sincronización ya en progreso...')
      return { success: false, message: 'Sincronización ya en progreso' }
    }

    this.isSyncing = true

    try {
      console.log('🔄 Iniciando sincronización completa...')

      // 1. Sincronizar visitas primero (porque órdenes y fotos dependen de ellas)
      const visitResults = await visitService.syncPendingVisits()
      console.log('📊 Visitas:', visitResults)

      // 2. Sincronizar órdenes (dependen de visitas)
      const orderResults = await orderService.syncPendingOrders()
      console.log('📊 Órdenes:', orderResults)

      // 3. Sincronizar fotos (dependen de visitas)
      const photoResults = await photoService.syncPendingPhotos()
      console.log('📊 Fotos:', photoResults)

      const totalSynced = visitResults.synced + orderResults.synced + photoResults.synced
      const totalFailed = visitResults.failed + orderResults.failed + photoResults.failed

      const result = {
        success: true,
        visits: visitResults,
        orders: orderResults,
        photos: photoResults,
        totalSynced,
        totalFailed,
        message: `Sincronización completa: ${totalSynced} exitosos, ${totalFailed} fallidos`
      }

      console.log(`✅ ${result.message}`)

      // Limpiar registros antiguos (más de 7 días)
      await offlineDB.cleanupOldRecords()

      return result
    } catch (error) {
      console.error('❌ Error en sincronización:', error)
      return {
        success: false,
        error: error.message,
        message: `Error en sincronización: ${error.message}`
      }
    } finally {
      this.isSyncing = false
    }
  }

  // Sincronización automática periódica (cada 30 segundos si hay conexión)
  startAutoSync() {
    if (this.syncInterval) {
      console.log('⚠️ Auto-sincronización ya está activa')
      return
    }

    console.log('🔄 Auto-sincronización iniciada (cada 30 segundos)')

    this.syncInterval = setInterval(async () => {
      if (networkService.getStatus() && !this.isSyncing) {
        console.log('🔄 Auto-sincronización periódica...')
        const result = await this.syncAll()

        // Solo notificar si hubo cambios
        if (result.totalSynced > 0 || result.totalFailed > 0) {
          this.notifyListeners(result)
        }
      }
    }, 30000) // 30 segundos
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      console.log('⏸️ Auto-sincronización detenida')
    }
  }

  // Obtener estado de sincronización
  async getSyncStatus() {
    const pendingCount = await offlineDB.getPendingCount()

    return {
      isSyncing: this.isSyncing,
      isOnline: networkService.getStatus(),
      pending: pendingCount,
      autoSyncActive: this.syncInterval !== null
    }
  }

  // Suscribirse a notificaciones de sincronización
  subscribe(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback)
    }
  }

  notifyListeners(result) {
    this.listeners.forEach(callback => {
      try {
        callback(result)
      } catch (error) {
        console.error('Error en listener de sincronización:', error)
      }
    })
  }
}

// Exportar singleton
export default new SyncService()
