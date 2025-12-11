import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta al archivo de credenciales
const serviceAccountPath = join(__dirname, '../../firebase-adminsdk.json');

let firebaseApp: admin.app.App;

try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('✅ Firebase Admin inicializado correctamente');
} catch (error) {
    console.error('❌ Error al inicializar Firebase Admin:', error);
    console.error('   Asegúrate de que el archivo firebase-adminsdk.json existe en la carpeta server/');
}

export { firebaseApp };
export const messaging = admin.messaging();
