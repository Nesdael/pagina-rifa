# Página de rifa

Rifa de $150.000 con números del 00 al 99. Juega el 30 de octubre con el Sinuano Noche.

- **Backend:** NestJS + TypeORM + PostgreSQL (`backend/`)
- **Frontend:** React + TypeScript con Vite (`frontend/`)

En producción es una sola app: Nest sirve la API en `/api` y el build de React en todo lo demás.

## Cómo funciona

1. La persona abre la página, toca sus números y los aparta con su nombre y celular.
2. Se abre WhatsApp con el mensaje ya escrito para pagar.
3. El dueño entra a `/admin`, ve quién apartó y le da **Confirmar pago** o **Liberar**.
4. Si un apartado no se paga en `MINUTOS_APARTADO`, el número vuelve a quedar libre solo.

La página se refresca sola cada 10 segundos. Si dos personas piden el mismo número al mismo tiempo, solo una lo consigue (el UPDATE solo afecta filas libres y todo va en una transacción).

## Correr en local

Necesitas Node 20+ y una base de datos PostgreSQL llamada `rifa`.

```bash
# 1. Backend
cd backend
cp .env.example .env      # y ajusta DATABASE_URL con tu usuario y clave
npm install
npm run dev               # http://localhost:3000/api

# 2. Frontend (en otra terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Vite manda las llamadas de `/api` al backend (ver `vite.config.ts`).
La primera vez que arranca, el backend crea la tabla y los 100 números solo.

Panel de admin: http://localhost:5173/admin (la clave es `ADMIN_KEY` del `.env`).

## API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/config` | Precio, premio, lotería, fecha, WhatsApp y ganador |
| GET | `/api/numeros` | Los 100 números (sin teléfonos, nombre recortado) |
| POST | `/api/apartar` | `{ numeros, nombre, telefono }` → aparta o responde 409 |
| GET | `/api/admin/numeros` | Todo, con teléfonos (header `x-api-key`) |
| POST | `/api/admin/confirmar/:n` | Marca como pagado (header `x-api-key`) |
| POST | `/api/admin/liberar/:n` | Lo deja libre otra vez (header `x-api-key`) |

## Subir a Railway

1. Sube el proyecto a GitHub.
2. En Railway: **New Project → Deploy from GitHub repo** y elige el repo.
3. En el mismo proyecto: **New → Database → PostgreSQL**.
4. En el servicio de la app, pestaña **Variables**, agrega:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `ADMIN_KEY`, `PRECIO`, `PREMIO`, `LOTERIA`, `FECHA_SORTEO`, `WHATSAPP`, `MINUTOS_APARTADO` (los mismos del `.env.example`)
5. En **Settings → Networking → Generate Domain** para tener el link.

Railway usa el `package.json` de la raíz: `npm run build` compila frontend y backend, y `npm start` arranca Nest.

## El día del sorteo

Cuando juegue el Sinuano Noche, pon las dos últimas cifras en la variable `GANADOR` (ej: `07`).
La página muestra el número ganador y el nombre de quien lo compró, y ya no deja apartar más números.
