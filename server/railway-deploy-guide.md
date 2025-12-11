# Guía de Despliegue en Railway

## 1. Preparar el Proyecto

### 1.1 Crear archivo `railway.json` en la raíz del proyecto

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 1.2 Verificar `package.json`

Asegúrate de tener estos scripts:

```json
{
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "postinstall": "prisma generate"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 1.3 Crear `.railwayignore` (opcional)

```
node_modules/
.env
.git/
dist/
uploads/
*.log
```

## 2. Configurar PostgreSQL

### 2.1 Actualizar `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // Para migraciones
}
```

### 2.2 Actualizar `src/config/prisma.ts`

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Usar DATABASE_URL de Railway
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está configurada');
}

const pool = new pg.Pool({
  connectionString,
  max: 10, // Máximo de conexiones
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

## 3. Desplegar en Railway

### 3.1 Crear cuenta en Railway

1. Ve a https://railway.app
2. Regístrate con GitHub
3. Acepta los permisos

### 3.2 Crear nuevo proyecto

1. Click en "New Project"
2. Selecciona "Deploy from GitHub repo"
3. Autoriza a Railway a acceder a tus repositorios
4. Selecciona el repositorio `proyecto-abarrotes/server`

### 3.3 Agregar PostgreSQL

1. En tu proyecto, click en "+ New"
2. Selecciona "Database" → "Add PostgreSQL"
3. Railway automáticamente creará la base de datos
4. La variable `DATABASE_URL` se agregará automáticamente

### 3.4 Configurar Variables de Entorno

En la pestaña "Variables" de tu servicio, agrega:

```
NODE_ENV=production
PORT=8080
BETTER_AUTH_SECRET=tu-secret-aqui-generado-aleatorio
BETTER_AUTH_URL=https://tu-app.up.railway.app
VAPID_PUBLIC_KEY=tu-vapid-public-key
VAPID_PRIVATE_KEY=tu-vapid-private-key
VAPID_SUBJECT=mailto:admin@tuapp.com
```

**Para generar VAPID keys:**
```bash
npx web-push generate-vapid-keys
```

### 3.5 Configurar Build y Start

Railway detectará automáticamente tu proyecto, pero verifica:

**Build Command:**
```
npm install && npm run build && npx prisma migrate deploy
```

**Start Command:**
```
npm start
```

### 3.6 Configurar Dominio Público

1. En "Settings" → "Networking"
2. Click en "Generate Domain"
3. Se generará algo como: `tu-proyecto.up.railway.app`
4. Copia esta URL

## 4. Ejecutar Migraciones

### Opción 1: Desde Railway CLI (Recomendado)

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Vincular proyecto
railway link

# Ejecutar migraciones
railway run npx prisma migrate deploy

# Ver logs
railway logs
```

### Opción 2: Desde el Dashboard

1. Ve a tu servicio en Railway
2. Click en "Deployments"
3. Click en los 3 puntos del último deploy
4. Selecciona "View Logs"
5. Verifica que las migraciones se ejecutaron

## 5. Verificar el Despliegue

### 5.1 Probar la API

```bash
# Reemplaza con tu URL de Railway
curl https://tu-proyecto.up.railway.app/

# Debería responder: "Hola!"
```

### 5.2 Probar autenticación

```bash
curl -X POST https://tu-proyecto.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!",
    "name": "Test User",
    "role": "ADMIN"
  }'
```

## 6. Actualizar Frontend

Cambia la URL del API en tu frontend:

```javascript
// Antes
const API_URL = 'http://localhost:8081/api';

// Después
const API_URL = 'https://tu-proyecto.up.railway.app/api';
```

## 7. Monitoreo y Logs

### Ver logs en tiempo real:

```bash
railway logs --follow
```

### Métricas:
- Railway Dashboard → "Metrics"
- Verás: CPU, Memoria, Network, Requests

## 8. Problemas Comunes

### Error: "Cannot find module"

**Solución:** Verifica que `postinstall` en `package.json` ejecute `prisma generate`

### Error: "Port already in use"

**Solución:** Railway asigna el puerto automáticamente. Usa:

```typescript
const PORT = process.env.PORT || 8081;
```

### Error: Migraciones no se ejecutan

**Solución:** Ejecuta manualmente:

```bash
railway run npx prisma migrate deploy
```

### Error: "Connection pool exhausted"

**Solución:** Reduce conexiones en `src/config/prisma.ts`:

```typescript
const pool = new pg.Pool({
  connectionString,
  max: 5, // Reducir a 5
});
```

## 9. Costos

**Railway Free Tier:**
- $5 de crédito gratis al mes
- ~500 horas de ejecución
- PostgreSQL incluido

**Si necesitas más:**
- Plan Hobby: $5/mes por servicio
- PostgreSQL: $5/mes adicional

## 10. CI/CD Automático

Railway automáticamente despliega cuando haces push a tu rama principal:

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
```

Railway detectará el push y desplegará automáticamente.

## 11. Comandos Útiles

```bash
# Vincular proyecto
railway link

# Ver status
railway status

# Ver variables de entorno
railway variables

# Ejecutar comando en producción
railway run <comando>

# Abrir en el navegador
railway open

# Ver logs
railway logs
```

## 12. Backup de Base de Datos

```bash
# Exportar base de datos
railway run pg_dump $DATABASE_URL > backup.sql

# Importar base de datos
railway run psql $DATABASE_URL < backup.sql
```

## ✅ Checklist Final

- [ ] Repositorio en GitHub
- [ ] `railway.json` creado
- [ ] `package.json` con scripts correctos
- [ ] Variables de entorno configuradas
- [ ] PostgreSQL agregado al proyecto
- [ ] Migraciones ejecutadas
- [ ] Dominio generado
- [ ] API funcionando (probar con curl)
- [ ] Frontend actualizado con nueva URL
- [ ] Logs verificados sin errores

¡Listo! Tu backend está en producción en Railway.
