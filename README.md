# Rifa $150.000 — Sinuano Noche

Página web para vender los números de una rifa: la gente elige sus números del 00 al 99, los aparta y paga por WhatsApp. El dueño confirma los pagos desde un panel de administración.

**En vivo:** https://pagina-rifa-qnwk.onrender.com
**Panel de admin:** https://pagina-rifa-qnwk.onrender.com/admin

| Rifa | Panel de admin | Día del sorteo |
|---|---|---|
| ![Página de la rifa](docs/rifa-movil.png) | ![Panel de administración](docs/admin-movil.png) | ![Número ganador anunciado](docs/ganador-movil.png) |

## Datos de la rifa

- **Premio:** $150.000 en efectivo
- **Números:** del 00 al 99, a $5.000 cada uno
- **Sorteo:** viernes 30 de octubre de 2026, con las dos últimas cifras del **Sinuano Noche**

Todo esto se configura con variables de entorno, sin tocar el código (ver [Variables de entorno](#variables-de-entorno)).

## Cómo funciona

1. La persona abre el link, toca los números que quiere y le da **Apartar**.
2. Escribe su nombre y celular. Los números quedan **apartados** (amarillo) y se abre WhatsApp con el mensaje listo:
   *"Hola, aparté los números 08, 77 de la rifa a nombre de Pedro Gómez. Total: $10.000. ¿A dónde te pago?"*
3. Paga por Nequi/Daviplata y manda el comprobante.
4. El dueño entra a `/admin` y le da **Confirmar pago**. El número pasa a **vendido** (sello fucsia).
5. Si un apartado no se paga a tiempo (`MINUTOS_APARTADO`), el número **se libera solo**.
6. El día del sorteo, el dueño anuncia el número ganador desde el panel y la página lo muestra.

## Panel de administración (`/admin`)

Se entra con la clave `ADMIN_KEY`. Desde ahí el dueño maneja toda la rifa sin tocar el código ni Render:

- **Número ganador:** escribe las dos cifras del Sinuano Noche y lo anuncia. Antes de guardar le muestra quién compró ese número; si se equivoca, puede corregirlo.
- **Dinero recogido:** cuánto va, cuánto falta para cubrir el premio y cuánto se recoge si se venden todos.
- **Contadores y mapa:** vendidos, por confirmar y libres, más un mapa de los 100 números por colores.
- **Por confirmar:** cada persona con sus números, su WhatsApp y hace cuánto apartó. Botones **Confirmar pago** y **Liberar**.
- **Vendidos:** quién compró qué, con opción de liberar si hubo un error.
- Liberar y cambiar el ganador piden confirmación en una ventana propia; cada acción muestra un aviso corto al terminar.

### Detalles técnicos que vale la pena mirar

- **Dos personas no pueden quedarse con el mismo número.** El apartado es un `UPDATE ... WHERE estado = 'disponible'` dentro de una transacción: si uno de los números ya lo tomó otro, no se aparta ninguno y la API responde `409 Conflict`. Probado con 10 peticiones simultáneas al mismo número: solo una gana.
- **Los apartados vencidos se liberan sin cron.** Al consultar, un apartado con más de `MINUTOS_APARTADO` se trata como disponible.
- **La página se actualiza sola** cada 10 segundos (el panel cada 15), así nadie tiene que recargar.
- **La rifa se cierra en el servidor.** Con un ganador anunciado, `/api/apartar` rechaza cualquier apartado, aunque alguien tenga la página vieja abierta.
- **Privacidad:** la API pública nunca devuelve teléfonos y muestra el nombre recortado ("Juan P."). Los datos completos solo los ve el admin.

## Stack

| Parte | Tecnologías |
|---|---|
| Backend | NestJS 10, TypeORM, PostgreSQL, class-validator |
| Frontend | React 19 + TypeScript, Vite |
| Hosting | Render (app) + Neon (PostgreSQL) |

En producción es **una sola app**: Nest sirve la API en `/api` y el build de React (`frontend/dist`) en todo lo demás, con `@nestjs/serve-static`.

## Estructura

```
paginarifa/
├── package.json                 ← scripts de build/start para el deploy
├── backend/                     ← NestJS
│   └── src/
│       ├── main.ts              ← prefijo /api y ValidationPipe
│       ├── app.module.ts        ← TypeORM + ServeStatic
│       └── numeros/
│           ├── numero.entity.ts
│           ├── sorteo.entity.ts        ← guarda el número ganador
│           ├── numeros.service.ts      ← lógica: semilla, apartar, confirmar, liberar
│           ├── numeros.controller.ts   ← rutas
│           ├── admin.guard.ts          ← valida el header x-api-key
│           └── dto/
│               ├── apartar.dto.ts      ← validación de lo que manda el usuario
│               └── ganador.dto.ts
└── frontend/                    ← React + Vite
    ├── public/sinuano-noche.png
    └── src/
        ├── api.ts               ← todas las llamadas a la API
        ├── App.tsx              ← muestra la rifa o el admin según la URL
        ├── index.css            ← estilos (colores del logo del Sinuano)
        ├── pages/Rifa.tsx
        ├── pages/Admin.tsx
        └── components/
            ├── Cuadricula.tsx         ← los 100 números
            ├── FormApartar.tsx
            └── ConfirmarDialogo.tsx   ← ventana de confirmación del admin
```

## API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/config` | Precio, premio, lotería, fecha, WhatsApp y ganador |
| GET | `/api/numeros` | Los 100 números (sin teléfonos, nombre recortado) |
| POST | `/api/apartar` | Body `{ numeros, nombre, telefono }`. Aparta o responde `409` |
| GET | `/api/admin/numeros` | Todo, con teléfonos y si el apartado venció 🔒 |
| POST | `/api/admin/confirmar/:n` | Marca el número como pagado 🔒 |
| POST | `/api/admin/liberar/:n` | Deja el número libre otra vez 🔒 |
| POST | `/api/admin/ganador` | Body `{ numero }`. Anuncia el ganador y cierra la rifa 🔒 |
| DELETE | `/api/admin/ganador` | Quita el ganador (por si hubo un error) 🔒 |

🔒 = necesita el header `x-api-key` con el valor de `ADMIN_KEY`.

## Correr en local

Necesitas **Node 20+** y **PostgreSQL** con una base de datos llamada `rifa`.

```bash
# 1. Backend
cd backend
cp .env.example .env      # ajusta DATABASE_URL con tu usuario y clave
npm install
npm run dev               # API en http://localhost:3000/api

# 2. Frontend (otra terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

- Vite manda las llamadas de `/api` al backend (proxy en `vite.config.ts`).
- La primera vez que arranca, el backend crea la tabla y los 100 números solo.
- Panel de admin en local: http://localhost:5173/admin (la clave es `ADMIN_KEY` del `.env`).

## Variables de entorno

Van en `backend/.env` en local y en **Render → Environment** en producción.

| Variable | Ejemplo | Para qué |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/rifa` | Conexión a PostgreSQL. En Neon termina en `?sslmode=require` |
| `ADMIN_KEY` | una clave difícil | Clave del panel `/admin` |
| `PRECIO` | `5000` | Valor de cada número |
| `PREMIO` | `150000` | Valor del premio |
| `LOTERIA` | `Sinuano Noche` | Lotería con la que juega |
| `FECHA_SORTEO` | `2026-10-30` | Fecha del sorteo (para la cuenta regresiva) |
| `WHATSAPP` | `573001234567` | WhatsApp del dueño, con indicativo, sin `+` ni espacios |
| `MINUTOS_APARTADO` | `120` | Cuánto dura un apartado sin pagar |
| `PORT` | `3000` | Solo en local. Render lo asigna solo |

> Nunca subas el `.env` al repo (ya está en `.gitignore`).

## Deploy (Render + Neon)

La app está en el plan gratis de Render y la base de datos en el plan gratis de Neon.

**Base de datos (Neon):** proyecto `PaginaRifa`. La cadena de conexión está en el panel de Neon → *Connect*.

**App (Render):** servicio web `pagina-rifa` conectado a este repo.

- Build Command: `npm run build` (instala y compila frontend y backend)
- Start Command: `npm start`
- **Auto-deploy:** cada `git push` a `main` publica la nueva versión en un par de minutos.

**Para que no se duerma:** el plan gratis de Render apaga la app tras 15 minutos sin visitas (la siguiente visita tarda ~1 minuto). Un ping cada 10 minutos a `/api/config` desde cron-job.org la mantiene despierta. Las 750 horas gratis al mes se comparten con los demás servicios de la cuenta, por eso el ping va solo de 7 a. m. a 11 p. m.

## El día del sorteo

1. Cuando juegue el Sinuano Noche, entra a `/admin`, escribe las dos últimas cifras en **Número ganador** y dale **Anunciar ganador**.
2. El panel te muestra quién compró ese número antes de confirmar.
3. La página pública muestra el número ganador con el nombre de quien lo compró, y ya no deja apartar más números (la API también lo bloquea).
4. Si te equivocaste, **Corregir ganador** lo quita y la rifa vuelve a quedar abierta.

El ganador se guarda en la base de datos (tabla `sorteo`), así que no hay que tocar Render.

---

Hecho por **Nestor Duran**.
