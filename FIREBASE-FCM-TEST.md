# 🔔 Prueba de Push Notifications con Firebase FCM

## Estado del Sistema

✅ **Backend:**
- Firebase Admin SDK configurado
- Modelo FcmToken en base de datos
- Endpoints FCM creados:
  - `POST /api/fcm/token` - Guardar token
  - `GET /api/fcm/tokens` - Obtener tokens del usuario
  - `DELETE /api/fcm/token/:tokenId` - Eliminar token
  - `DELETE /api/fcm/tokens` - Eliminar todos los tokens
  - `POST /api/fcm/send` - Enviar notificación (solo ADMIN)
- Integración en `assignUserToStore()` para enviar notificación automática

✅ **Frontend:**
- Firebase SDK configurado
- Service Worker `firebase-messaging-sw.js` registrado
- `fcmService.js` con `requestNotificationPermission()`
- `RepartidorDashboard` solicita permisos al cargar y guarda token en backend

---

## 🧪 Pasos para Probar

### 1. Iniciar Aplicación

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Cliente
cd client
npm run dev
```

### 2. Preparar Usuario REPARTIDOR

1. Abrir navegador (Chrome o Edge recomendado)
2. Ir a `http://localhost:5173/login`
3. Iniciar sesión con usuario REPARTIDOR:
   - Email: `isaac@example.com`
   - Password: `123456`

### 3. Verificar Permisos de Notificaciones

Al entrar al dashboard del repartidor:

1. **Debe aparecer popup** solicitando permiso de notificaciones
2. Hacer clic en **"Permitir"**
3. Verificar en consola del navegador:
   ```
   ✅ Permiso de notificaciones concedido
   ✅ Token FCM obtenido: [token largo]
   ✅ Token FCM guardado en el servidor
   ```
4. Verificar en consola del servidor:
   ```
   ✅ Token FCM guardado para usuario Isaac
   ```

### 4. Asignar Tienda (Como ADMIN)

1. Abrir **nueva pestaña** en modo incógnito o usar otro perfil
2. Ir a `http://localhost:5173/login`
3. Iniciar sesión con usuario ADMIN:
   - Email: `admin@example.com`
   - Password: `123456`
4. En el dashboard:
   - Hacer clic en una tienda sin asignar
   - Clic en **"Asignar Repartidor"**
   - Seleccionar **"Isaac"**
   - Confirmar

### 5. Verificar Notificación

**En la pestaña del REPARTIDOR debe aparecer:**

1. 🔔 **Notificación del navegador** (arriba a la derecha)
   - Título: "🏪 Nueva tienda asignada"
   - Cuerpo: "Te han asignado la tienda [nombre] en [dirección]"

2. **En consola del navegador:**
   ```
   📩 Mensaje recibido en primer plano: {...}
   ```

3. **En consola del servidor:**
   ```
   📤 Enviando notificación FCM a 1 dispositivo(s)...
   📨 Enviando a Isaac (isaac@example.com)...
   ✅ Notificación enviada exitosamente: projects/...
   📊 Resultado: 1 enviadas, 0 fallidas, 0 tokens eliminados
   ✅ Notificación FCM enviada a Isaac
   ```

---

## 🔍 Verificaciones Adicionales

### Comprobar Token en Base de Datos

```sql
SELECT * FROM "FcmToken";
```

Debe mostrar:
- `userId`: ID del usuario Isaac
- `token`: Token largo de FCM
- `deviceInfo`: User agent del navegador

### Probar con App en Segundo Plano

1. Minimizar la pestaña del repartidor
2. Asignar otra tienda
3. **Debe aparecer notificación del sistema operativo**

### Probar Envío Manual (Como ADMIN)

```bash
# Con Thunder Client, Postman, o curl
POST http://localhost:8081/api/fcm/send
Authorization: Bearer [token_admin]
Content-Type: application/json

{
  "title": "Prueba Manual",
  "body": "Esta es una prueba de notificación FCM",
  "userIds": ["[id_de_isaac]"]
}
```

---

## 🐛 Solución de Problemas

### No aparece popup de permisos

- Verificar que el navegador soporta Notifications API
- Revisar configuración del navegador: Configuración → Privacidad → Notificaciones
- Probar en modo incógnito

### Token no se guarda en el servidor

- Verificar en Network tab que se hace POST a `/api/fcm/token`
- Revisar que el token JWT es válido
- Verificar logs del servidor

### Notificación enviada pero no recibida

- Verificar que el Service Worker está activo:
  ```
  chrome://serviceworker-internals/
  ```
- Verificar que el token FCM es válido en Firebase Console
- Revisar consola del Service Worker (F12 → Application → Service Workers)

### Error: "messaging/invalid-registration-token"

- Token FCM expiró o es inválido
- Eliminar y generar nuevo token:
  ```
  DELETE /api/fcm/tokens
  ```
- Recargar página del repartidor

---

## 📊 Flujos Implementados

### 🏪 Asignación de Tienda
```
ADMIN asigna tienda → stores.service.ts → sendFcmNotification()
                                         ↓
                              "🏪 Nueva tienda asignada"
                                         ↓
                              REPARTIDOR recibe notificación
```

### 📦 Nueva Orden
```
REPARTIDOR crea orden → orders.service.ts → sendFcmNotification()
                                           ↓
                                "📦 Nueva orden recibida"
                                           ↓
                                ADMIN recibe notificación
```

### 📍 Nueva Visita
```
REPARTIDOR registra visita → visits.service.ts → sendFcmNotification()
                                                ↓
                                     "📍 Visita registrada"
                                                ↓
                                     ADMIN recibe notificación
```

### 🔔 Recepción de Notificaciones
```
┌─────────────────────────────────────────────────────────────┐
│ Firebase Cloud Messaging envía notificación                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
┌──────────────────┐                  ┌──────────────────┐
│ App ABIERTA      │                  │ App MINIMIZADA   │
│ (Primer plano)   │                  │ (Segundo plano)  │
├──────────────────┤                  ├──────────────────┤
│ onMessage()      │                  │ Service Worker   │
│ Dashboard.jsx o  │                  │ onBackground     │
│ Repartidor       │                  │ Message()        │
│ Dashboard.jsx    │                  │                  │
│                  │                  │ showNotification │
│ new Notification │                  │ del sistema      │
└──────────────────┘                  └──────────────────┘
```

---

## ✅ Criterios de Éxito

### Para REPARTIDOR:
- [ ] Popup de permisos aparece al entrar como REPARTIDOR
- [ ] Token FCM se guarda en base de datos
- [ ] Al asignar tienda, aparece notificación "🏪 Nueva tienda asignada"
- [ ] Funciona con app en primer y segundo plano

### Para ADMIN:
- [ ] Popup de permisos aparece al entrar como ADMIN
- [ ] Token FCM se guarda en base de datos
- [ ] Al crear orden, aparece notificación "📦 Nueva orden recibida"
- [ ] Al registrar visita, aparece notificación "📍 Visita registrada"
- [ ] Funciona con app en primer y segundo plano

### General:
- [ ] Notificaciones muestran título y cuerpo correctos
- [ ] Logs del servidor confirman envío exitoso
- [ ] Al hacer clic en notificación, abre la app
- [ ] Tokens inválidos se eliminan automáticamente

---

## 🔗 Enlaces Útiles

- [Firebase Console](https://console.firebase.google.com/project/pushnotification-55e77)
- [Service Worker DevTools](chrome://serviceworker-internals/)
- [Notification Permissions](chrome://settings/content/notifications)

---

**Fecha:** 10 de diciembre de 2025  
**Implementado por:** GitHub Copilot  
**Stack:** Firebase Cloud Messaging + React + Express + PostgreSQL
