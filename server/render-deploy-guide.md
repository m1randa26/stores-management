# Guía de Despliegue en Render (Alternativa)

## Ventajas de Render
- ✅ Tier gratuito generoso
- ✅ PostgreSQL gratis (con límites)
- ✅ Deploy desde GitHub automático
- ✅ SSL gratis
- ✅ Más simple que Railway

## 1. Preparar el Proyecto

### 1.1 Crear `render.yaml` (opcional)

```yaml
services:
  - type: web
    name: abarrotes-api
    env: node
    plan: free
    buildCommand: npm install && npm run build && npx prisma generate
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: abarrotes-db
          property: connectionString

databases:
  - name: abarrotes-db
    plan: free
    databaseName: abarrotes
    user: abarrotes
```

### 1.2 Actualizar `package.json`

```json
{
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "postinstall": "prisma generate"
  },
  "engines": {
    "node": "18.x"
  }
}
```

## 2. Desplegar en Render

### 2.1 Crear cuenta

1. Ve a https://render.com
2. Sign up con GitHub
3. Autoriza Render

### 2.2 Crear PostgreSQL Database

1. Dashboard → "New" → "PostgreSQL"
2. Name: `abarrotes-db`
3. Plan: Free
4. Region: Oregon (o la más cercana)
5. Click "Create Database"
6. **Espera 2-3 minutos** a que se cree
7. Copia el "Internal Database URL"

### 2.3 Crear Web Service

1. Dashboard → "New" → "Web Service"
2. Conecta tu repositorio GitHub
3. Selecciona `proyecto-abarrotes` (o el nombre de tu repo)
4. Configura:
   - **Name:** `abarrotes-api`
   - **Region:** Same as database
   - **Branch:** `main`
   - **Root Directory:** `server` (si tu server está en subcarpeta)
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build && npx prisma generate && npx prisma migrate deploy`
   - **Start Command:** `npm start`
   - **Plan:** Free

### 2.4 Configurar Variables de Entorno

En "Environment" tab, agrega:

```
NODE_ENV=production
PORT=10000
DATABASE_URL=[copia desde tu PostgreSQL database en Render]
BETTER_AUTH_SECRET=tu-secret-aqui-64-caracteres-aleatorio
BETTER_AUTH_URL=https://abarrotes-api.onrender.com
VAPID_PUBLIC_KEY=BN...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@tuapp.com
```

**Generar BETTER_AUTH_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generar VAPID keys:**
```bash
npx web-push generate-vapid-keys
```

### 2.5 Deploy

Click "Create Web Service" - Render automáticamente:
1. Clonará tu repo
2. Ejecutará `npm install`
3. Ejecutará `npm run build`
4. Generará Prisma Client
5. Ejecutará migraciones
6. Iniciará el servidor

## 3. Verificar Despliegue

Tu app estará en: `https://tu-servicio.onrender.com`

```bash
# Probar
curl https://tu-servicio.onrender.com/

# Debería responder: "Hola!"
```

## 4. Problemas Comunes

### Free tier se duerme después de 15 min de inactividad

**Solución:** Primera request tardará ~30 segundos (cold start)

### Migraciones fallan

**Solución:** Ejecuta manualmente desde Render Shell:

1. Dashboard → Tu servicio → "Shell"
2. Ejecuta:
```bash
npx prisma migrate deploy
```

### Error de conexión a PostgreSQL

**Solución:** Verifica que `DATABASE_URL` sea el "Internal Database URL"

## 5. Actualizar Frontend

```javascript
const API_URL = 'https://tu-servicio.onrender.com/api';
```

## 6. Costos

**Render Free Tier:**
- 750 horas/mes de Web Service (suficiente para 1 app)
- PostgreSQL: 90 días gratis, luego $7/mes
- Se duerme después de 15 min sin actividad
- Cold start: ~30 segundos

## ✅ Checklist

- [ ] Repositorio en GitHub
- [ ] PostgreSQL database creada en Render
- [ ] Web Service creado
- [ ] Variables de entorno configuradas
- [ ] Build exitoso
- [ ] Migraciones ejecutadas
- [ ] API funcionando
- [ ] Frontend actualizado
