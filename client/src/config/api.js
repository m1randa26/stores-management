// Configuración de la API
// En desarrollo usa localhost, en producción usa la variable de entorno VITE_API_URL

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api'
