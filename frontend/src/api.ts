// Todas las llamadas al backend en un solo lugar

export type Estado = 'disponible' | 'apartado' | 'pagado'

export interface NumeroPublico {
  numero: number
  estado: Estado
  nombre: string | null
}

export interface NumeroAdmin {
  numero: number
  estado: Estado
  nombre: string | null
  telefono: string | null
  apartadoEn: string | null
  pagadoEn: string | null
  vencido: boolean
}

export interface ConfigRifa {
  precio: number
  premio: number
  loteria: string
  fechaSorteo: string
  whatsapp: string
  indicativo: string
  minutosApartado: number
  ganador: number | null
}

// Si el backend responde con error, sacamos el mensaje para mostrarlo
async function pedir<T>(url: string, opciones?: RequestInit): Promise<T> {
  const res = await fetch(url, opciones)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = data?.message
    throw new Error(Array.isArray(msg) ? msg[0] : msg ?? 'Algo falló, intenta de nuevo')
  }
  return data as T
}

export const getConfig = () => pedir<ConfigRifa>('/api/config')

export const getNumeros = () => pedir<NumeroPublico[]>('/api/numeros')

export const apartar = (numeros: number[], nombre: string, telefono: string) =>
  pedir<number[]>('/api/apartar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numeros, nombre, telefono }),
  })

// ---- Admin ----
const adminHeaders = (clave: string) => ({ 'x-api-key': clave })

export const getNumerosAdmin = (clave: string) =>
  pedir<NumeroAdmin[]>('/api/admin/numeros', { headers: adminHeaders(clave) })

export const confirmarPago = (clave: string, numero: number) =>
  pedir<NumeroAdmin>(`/api/admin/confirmar/${numero}`, {
    method: 'POST',
    headers: adminHeaders(clave),
  })

export const liberar = (clave: string, numero: number) =>
  pedir<NumeroAdmin>(`/api/admin/liberar/${numero}`, {
    method: 'POST',
    headers: adminHeaders(clave),
  })

export const anunciarGanador = (clave: string, numero: number) =>
  pedir<unknown>('/api/admin/ganador', {
    method: 'POST',
    headers: { ...adminHeaders(clave), 'Content-Type': 'application/json' },
    body: JSON.stringify({ numero }),
  })

export const quitarGanador = (clave: string) =>
  pedir<unknown>('/api/admin/ganador', { method: 'DELETE', headers: adminHeaders(clave) })

export interface Movimiento {
  id: number
  accion: string
  numero: number | null
  nombre: string | null
  telefono: string | null
  fecha: string
}

export const getHistorial = (clave: string) =>
  pedir<Movimiento[]>('/api/admin/historial', { headers: adminHeaders(clave) })

// Descarga el CSV (va con la clave en el header, por eso no basta un link normal)
export async function descargarRespaldo(clave: string, tipo: 'numeros' | 'historial') {
  const res = await fetch(`/api/admin/respaldo/${tipo}`, { headers: adminHeaders(clave) })
  if (!res.ok) throw new Error('No se pudo descargar el respaldo')
  const url = URL.createObjectURL(await res.blob())
  const hoy = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `rifa-${tipo}-${hoy}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---- Utilidades de formato ----
export const dosCifras = (n: number) => String(n).padStart(2, '0')

export const pesos = (valor: number) =>
  '$' + valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })

export const fechaLarga = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
