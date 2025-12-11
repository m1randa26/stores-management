import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta al archivo de credenciales (para desarrollo local)
const serviceAccountPath = join(__dirname, '../../firebase-adminsdk.json');

let firebaseApp: admin.app.App | null = null;

try {
    let serviceAccount;
    
    // Primero intentar desde variable de entorno (producción)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log('📱 Firebase: usando credenciales desde variable de entorno');
    } 
    // Si no, intentar desde archivo local (desarrollo)
    else if (existsSync(serviceAccountPath)) {
        serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
        console.log('📱 Firebase: usando credenciales desde archivo local');
    } else {
        throw new Error('No se encontraron credenciales de Firebase');
    }
    
    firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('✅ Firebase Admin inicializado correctamente');
} catch (error) {
    console.error('❌ Error al inicializar Firebase Admin:', error);
    console.error('   Configura FIREBASE_SERVICE_ACCOUNT en variables de entorno o agrega firebase-adminsdk.json');
}

export { firebaseApp };
export const messaging = firebaseApp ? admin.messaging() : null;
