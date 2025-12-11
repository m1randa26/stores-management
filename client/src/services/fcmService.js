import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Configuración de Firebase desde variables de entorno
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firebase Cloud Messaging
const messaging = getMessaging(app);

/**
 * Solicitar permisos de notificación y obtener token FCM
 */
export const requestNotificationPermission = async () => {
    try {
        console.log('Solicitando permiso de notificaciones...');
        
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('✅ Permiso de notificaciones concedido');
            
            // Esperar a que el Service Worker esté activo
            const registration = await navigator.serviceWorker.ready;
            console.log('✅ Service Worker listo:', registration);
            
            // Obtener el token FCM
            const token = await getToken(messaging, {
                vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: registration
            });
            
            if (token) {
                console.log('✅ Token FCM obtenido:', token);
                return token;
            } else {
                console.warn('⚠️ No se pudo obtener el token FCM');
                return null;
            }
        } else {
            console.warn('⚠️ Permiso de notificaciones denegado');
            return null;
        }
    } catch (error) {
        console.error('❌ Error al solicitar permisos:', error);
        return null;
    }
};

/**
 * Escuchar mensajes cuando la app está en primer plano
 */
export const onMessageListener = () => 
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            console.log('📩 Mensaje recibido en primer plano:', payload);
            resolve(payload);
        });
    });

export { messaging };
