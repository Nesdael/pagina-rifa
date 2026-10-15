# Rifas 00–99

Sistema web para vender los números de una rifa. Los compradores eligen sus números del 00 al 99, los apartan y pagan por WhatsApp. El organizador confirma los pagos y anuncia el ganador desde un panel de administración.

Funciona para cualquier rifa que se juegue con las dos últimas cifras de una lotería: el premio, el precio, la lotería, la fecha y el WhatsApp se configuran con variables de entorno, sin tocar el código.

## Demo en vivo

Una rifa real de $150.000 que juega con el **Sinuano Noche** el 30 de octubre de 2026, a $5.000 el número:

- **Página de la rifa:** https://pagina-rifa-qnwk.onrender.com
- **Panel de admin:** https://pagina-rifa-qnwk.onrender.com/admin

| Rifa | Panel de admin | Día del sorteo |
|---|---|---|
| ![Página de la rifa](docs/rifa-movil.png) | ![Panel de administración](docs/admin-movil.png) | ![Número ganador anunciado](docs/ganador-movil.png) |

## Cómo funciona

1. El comprador abre el link, toca los números que quiere y le da **Apartar**.
2. Escribe su nombre y celular. Los números quedan **apartados** (amarillo) y se abre WhatsApp con el mensaje listo:
   *"Hola, aparté los números 08, 77 de la rifa a nombre de Pedro Gómez. Total: $10.000. ¿A dónde te pago?"*
3. Paga (Nequi, Daviplata, transferencia…) y manda el comprobante por ese chat.
4. El organizador entra a `/admin` y le da **Confirmar pago**. El número pasa a **vendido** (sello fucsia).
5. Si un apartado no se paga a tiempo (`MINUTOS_APARTADO`), el número **se libera solo**.
6. Cuando juega la lotería, el organizador **anuncia el ganador** desde el panel y la página lo muestra.

## Panel de administración (`/admin`)

Se entra con la clave `ADMIN_KEY`. Desde ahí se maneja toda la rifa:

- **Número ganador:** se escriben las dos cifras de la lotería y se anuncia. Antes de guardar muestra quién compró ese número; si hubo un error, se puede corregir.
- **Dinero recogido:** cuánto va, cuánto falta para cubrir el premio y cuánto se recoge si se venden todos.
- **Contadores y mapa:** vendidos, por confirmar y libres, más un mapa de los 100 números por colores.
- **Por confirmar:** cada comprador con sus números, su WhatsApp y hace cuánto apartó. Botones **Confirmar pago** y **Liberar**.
- **Vendidos:** quién compró qué, con opción de liberar si hubo un error.
- **Respaldo:** descarga en CSV (se abre en Excel) del estado de los 100 números y del historial completo. Como trae todos los celulares, vuelve a pedir la `ADMIN_KEY` antes de cada descarga.
- **Historial de movimientos:** cada apartado, pago confirmado, liberación y cambio de ganador, con nombre, celular y hora.
- Liberar y cambiar el ganador piden confirmación; cada acción muestra un aviso corto al terminar.

## Detalles técnicos que vale la pena mirar

- **Dos personas no pueden quedarse con el mismo número.** El apartado es un `UPDATE ... WHERE estado = 'disponible'` dentro de una transacción: si uno de los números ya lo tomó otro, no se aparta ninguno y la API responde `409 Conflict`. Probado con 10 peticiones simultáneas al mismo número: solo una gana.
- **El comprador se entera si le ganan un número.** La página se actualiza cada 10 segundos y vuelve a revisar justo antes de mostrar el total. Si otra persona apartó uno de los números elegidos, lo quita de la selección y lo avisa, así el total y el mensaje de WhatsApp siempre coinciden con lo que de verdad se apartó.
- **Los apartados vencidos se liberan sin cron.** Al consultar, un apartado con más de `MINUTOS_APARTADO` se trata como disponible.
- **La rifa se cierra en el servidor.** Con un ganador anunciado, `/api/apartar` rechaza cualquier apartado, aunque alguien tenga la página vieja abierta.
- **Nada se pierde al liberar.** Cada acción queda en la tabla `movimientos`, que solo crece y nunca se borra. Si alguien libera por error a un comprador que ya pagó, el historial dice quién era y su celular. Se guarda en la misma transacción que el cambio, así no puede quedar uno sin el otro.
- **Nadie puede bloquear la rifa.** Un mismo celular puede tener máximo 10 números apartados sin pagar, y `/api/apartar` acepta máximo 5 intentos por minuto por IP (`@nestjs/throttler`). Como Render está detrás de un proxy, la app usa `trust proxy` para leer la IP real de cada persona.
- **Privacidad:** la API pública nunca devuelve teléfonos y muestra el nombre recortado ("Juan P."). Los datos completos solo los ve el admin.

## Stack

| Parte | Tecnologías |
|---|---|
| Backend | NestJS 10, TypeORM, PostgreSQL, class-validator |
| Frontend | React 19 + TypeScript, Vite |
| Hosting de la demo | Render (app) + Neon (PostgreSQL) |

En producción es **una sola app**: Nest sirve la API en `/api` y el build de React (`frontend/dist`) en todo lo demás, con `@nestjs/serve-static`.

## Usarlo para otra rifa

1. Clona el repo.
2. Cambia el logo: reemplaza `frontend/public/logo-loteria.png` por el de tu lotería (se muestra sobre fondo blanco, ideal horizontal).
3. Configura las [variables de entorno](#variables-de-entorno) con los datos de tu rifa.
4. Despliega (ver [Deploy](#deploy)). La primera vez la app crea las tablas y los 100 números sola.

Para personalizar más:

- **Colores y fuentes:** al inicio de `frontend/src/index.css` (los de la demo son los del logo del Sinuano).
- **Límites contra abuso:** `MAX_APARTADOS_POR_CELULAR` en `numeros.service.ts` y el `@Throttle` de `numeros.controller.ts`.
- **Formato del celular:** la validación está en `backend/src/numeros/dto/apartar.dto.ts` y hoy acepta celulares de Colombia (10 dígitos que empiezan por 3).
- **Cantidad de números:** el sistema está pensado para 00–99 (dos cifras de la lotería).

## Variables de entorno

Van en `backend/.env` en local y en la configuración del hosting en producción.

| Variable | Ejemplo | Para qué |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/rifa` | Conexión a PostgreSQL. En Neon termina en `?sslmode=require` |
| `ADMIN_KEY` | una clave difícil | Clave del panel `/admin` |
| `PRECIO` | `5000` | Valor de cada número |
| `PREMIO` | `150000` | Valor del premio |
| `LOTERIA` | `Sinuano Noche` | Lotería con la que juega |
| `FECHA_SORTEO` | `2026-10-30` | Fecha del sorteo (para la cuenta regresiva) |
| `WHATSAPP` | `573001234567` | WhatsApp del organizador, con indicativo, sin `+` ni espacios |
| `INDICATIVO` | `57` | Indicativo del país de los compradores, para los links de WhatsApp del admin. Si no se pone, usa `57` |
| `MINUTOS_APARTADO` | `10080` | Cuánto dura un apartado sin pagar. `120` = 2 horas, `1440` = 1 día, `10080` = 1 semana (la página lo muestra en días u horas) |
| `ZONA_HORARIA` | `America/Bogota` | Zona horaria de las fechas en los CSV. Si no se pone, usa Bogotá |
| `PORT` | `3000` | Solo en local. Render lo asigna solo |

> Nunca subas el `.env` al repo (ya está en `.gitignore`).

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
- Panel de admin en local: http://localhost:5173/admin (la clave es `ADMIN_KEY` del `.env`).

## Estructura

```
paginarifa/
├── package.json                 ← scripts de build/start para el deploy
├── docs/                        ← capturas del README
├── backend/                     ← NestJS
│   └── src/
│       ├── main.ts              ← prefijo /api y ValidationPipe
│       ├── app.module.ts        ← TypeORM + ServeStatic
│       └── numeros/
│           ├── numero.entity.ts
│           ├── sorteo.entity.ts        ← guarda el número ganador
│           ├── movimiento.entity.ts    ← historial de todo lo que pasa (nunca se borra)
│           ├── numeros.service.ts      ← lógica: apartar, confirmar, liberar, ganador, respaldos
│           ├── numeros.controller.ts   ← rutas
│           ├── admin.guard.ts          ← valida el header x-api-key
│           └── dto/
│               ├── apartar.dto.ts      ← validación de lo que manda el comprador
│               └── ganador.dto.ts
└── frontend/                    ← React + Vite
    ├── public/logo-loteria.png  ← logo de la lotería (cámbialo para tu rifa)
    └── src/
        ├── api.ts               ← todas las llamadas a la API
        ├── App.tsx              ← muestra la rifa o el admin según la URL
        ├── index.css            ← estilos y colores
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
| POST | `/api/apartar` | Body `{ numeros, nombre, telefono }`. Aparta o responde `409`. Máx. 5 intentos por minuto |
| GET | `/api/admin/numeros` | Todo, con teléfonos y si el apartado venció 🔒 |
| POST | `/api/admin/confirmar/:n` | Marca el número como pagado 🔒 |
| POST | `/api/admin/liberar/:n` | Deja el número libre otra vez 🔒 |
| POST | `/api/admin/ganador` | Body `{ numero }`. Anuncia el ganador y cierra la rifa 🔒 |
| DELETE | `/api/admin/ganador` | Quita el ganador (por si hubo un error) 🔒 |
| GET | `/api/admin/historial` | Últimos 100 movimientos 🔒 |
| GET | `/api/admin/respaldo/numeros` | CSV con el estado de los 100 números 🔒 |
| GET | `/api/admin/respaldo/historial` | CSV con el historial completo 🔒 |

🔒 = necesita el header `x-api-key` con el valor de `ADMIN_KEY`.

## Deploy

La demo corre gratis en **Render** (app) + **Neon** (PostgreSQL), pero sirve cualquier hosting con Node y Postgres.

**Base de datos (Neon):** crea un proyecto y copia la cadena de conexión (*Connect*) en `DATABASE_URL`.

**App (Render):** servicio web conectado al repo.

- Build Command: `npm run build` (instala y compila frontend y backend)
- Start Command: `npm start`
- Variables: las de la tabla de arriba.
- **Auto-deploy:** cada `git push` a `main` publica la nueva versión en un par de minutos.

**Para que no se duerma:** el plan gratis de Render apaga la app tras 15 minutos sin visitas (la siguiente visita tarda ~1 minuto). Un ping cada 10 minutos a `/api/config` (por ejemplo con cron-job.org) la mantiene despierta. Las 750 horas gratis al mes se comparten con los demás servicios de la cuenta; si tienes varios, programa el ping solo en las horas que más se usa.

## Si la página se cae

Los datos **no viven en la app**, viven en PostgreSQL (Neon), que es un servicio aparte. Si Render se cae, se duerme o un deploy falla, los apartados, pagos e historial siguen guardados y aparecen igual cuando la app vuelve.

Para estar cubierto también si falla la base de datos:

1. **Descarga el respaldo cada noche** desde el panel (números + historial). Con eso puedes reconstruir la rifa aunque se pierda todo.
2. **Neon permite restaurar** la base de datos a un momento anterior (en el plan gratis, las últimas horas), desde su panel → *Restore*.
3. **Activa las alertas del ping** en cron-job.org: si `/api/config` falla, te llega un correo antes de que te escriba un comprador.
4. **Cambia la `ADMIN_KEY`** si crees que alguien más la vio. Se cambia en Render → Environment y la app se reinicia sola.

## El día del sorteo

1. Cuando juegue la lotería, entra a `/admin`, escribe las dos últimas cifras en **Número ganador** y dale **Anunciar ganador**.
2. El panel muestra quién compró ese número antes de confirmar.
3. La página pública muestra el número ganador con el nombre de quien lo compró y ya no deja apartar más números.
4. Si te equivocaste, **Corregir ganador** lo quita y la rifa vuelve a quedar abierta.

---

Hecho por **Nestor Duran**.
