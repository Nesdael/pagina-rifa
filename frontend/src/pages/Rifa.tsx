import { useCallback, useEffect, useState } from 'react'
import { apartar, dosCifras, fechaLarga, getConfig, getNumeros, pesos, type ConfigRifa, type NumeroPublico } from '../api'
import Cuadricula from '../components/Cuadricula'
import FormApartar from '../components/FormApartar'

type Paso = 'eligiendo' | 'formulario' | 'listo'

const REFRESCO_MS = 10_000

export default function Rifa() {
  const [config, setConfig] = useState<ConfigRifa | null>(null)
  const [numeros, setNumeros] = useState<NumeroPublico[]>([])
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [paso, setPaso] = useState<Paso>('eligiendo')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeWhatsapp, setMensajeWhatsapp] = useState('')
  const [apartados, setApartados] = useState<number[]>([])

  const cargarNumeros = useCallback(async () => {
    try {
      const lista = await getNumeros()
      setNumeros(lista)
      // Si alguien más apartó un número que yo tenía seleccionado, lo quito
      setSeleccionados((sel) => sel.filter((n) => lista[n]?.estado === 'disponible'))
    } catch {
      /* si falla un refresco, se intenta en el siguiente */
    }
  }, [])

  // Carga inicial + refresco cada 10 segundos
  useEffect(() => {
    getConfig().then(setConfig).catch(() => setError('No se pudo cargar la rifa'))
    cargarNumeros()
    const id = setInterval(cargarNumeros, REFRESCO_MS)
    return () => clearInterval(id)
  }, [cargarNumeros])

  function toggle(numero: number) {
    setSeleccionados((sel) =>
      sel.includes(numero) ? sel.filter((n) => n !== numero) : [...sel, numero].sort((a, b) => a - b),
    )
  }

  async function handleApartar(nombre: string, telefono: string) {
    if (!config) return
    setEnviando(true)
    setError(null)
    try {
      await apartar(seleccionados, nombre, telefono)
      setApartados(seleccionados)
      const lista = seleccionados.map(dosCifras)
      const texto =
        `Hola, aparté ${lista.length === 1 ? 'el número' : 'los números'} ${lista.join(', ')} ` +
        `de la rifa a nombre de ${nombre}. Total: ${pesos(lista.length * config.precio)}. ¿A dónde te pago?`
      setMensajeWhatsapp(`https://wa.me/${config.whatsapp}?text=${encodeURIComponent(texto)}`)
      setPaso('listo')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEnviando(false)
      cargarNumeros()
    }
  }

  function empezarOtraVez() {
    setSeleccionados([])
    setError(null)
    setPaso('eligiendo')
  }

  if (!config) {
    return <main className="pagina"><p className="cargando">{error ?? 'Cargando la rifa…'}</p></main>
  }

  const ganador = config.ganador !== null ? Number(config.ganador) : null
  const quedan = numeros.filter((n) => n.estado === 'disponible').length
  const horas = config.minutosApartado / 60
  const tiempoApartado = horas >= 1 ? `${horas} ${horas === 1 ? 'hora' : 'horas'}` : `${config.minutosApartado} minutos`
  const datosGanador = ganador !== null ? numeros.find((n) => n.numero === ganador) : undefined

  return (
    <main className="pagina">
      <header className="encabezado">
        <h1>
          <span className="titulo-chico">Rifa de</span>
          <span className="premio">{pesos(config.premio)}</span>
        </h1>
        <p className="detalle">
          Juega el {fechaLarga(config.fechaSorteo)} con las dos últimas cifras del {config.loteria}.
          Cada número vale <strong>{pesos(config.precio)}</strong>.
        </p>
      </header>

      {ganador !== null && (
        <section className="aviso-ganador" aria-live="polite">
          <p>Número ganador</p>
          <p className="cifra-ganadora">{dosCifras(ganador)}</p>
          <p>
            {datosGanador?.estado === 'pagado'
              ? `¡Felicitaciones, ${datosGanador.nombre}!`
              : 'Ese número no se vendió.'}
          </p>
        </section>
      )}

      {paso === 'listo' ? (
        <section className="hoja-form listo">
          <h2>¡Listo, ya son tuyos!</h2>
          <p>
            Apartaste {apartados.map(dosCifras).join(', ')}. Ahora escríbenos por WhatsApp para pagar.
            Si no pagas en {tiempoApartado}, los números se liberan.
          </p>
          <a className="btn btn-whatsapp" href={mensajeWhatsapp} target="_blank" rel="noreferrer">
            Escribir por WhatsApp
          </a>
          <button type="button" className="btn-texto" onClick={empezarOtraVez}>
            Elegir más números
          </button>
        </section>
      ) : paso === 'formulario' ? (
        <FormApartar
          seleccionados={seleccionados}
          precio={config.precio}
          enviando={enviando}
          error={error}
          onApartar={handleApartar}
          onCancelar={() => { setError(null); setPaso('eligiendo') }}
        />
      ) : (
        <>
          {ganador === null && (
            <p className="instrucciones">
              Toca los números que quieras. Quedan <strong>{quedan}</strong> de 100.
            </p>
          )}

          <Cuadricula numeros={numeros} seleccionados={seleccionados} ganador={ganador} onToggle={toggle} />

          <ul className="leyenda">
            <li><span className="muestra disponible" /> Libre</li>
            <li><span className="muestra apartado" /> Apartado, esperando pago</li>
            <li><span className="muestra pagado" /> Vendido</li>
          </ul>

          {error && <p className="error" role="alert">{error}</p>}
        </>
      )}

      {paso === 'eligiendo' && seleccionados.length > 0 && (
        <div className="barra-seleccion">
          <p>
            <strong>{seleccionados.length}</strong> {seleccionados.length === 1 ? 'número' : 'números'}
            <span> {pesos(seleccionados.length * config.precio)}</span>
          </p>
          <button type="button" className="btn" onClick={() => setPaso('formulario')}>
            Apartar
          </button>
        </div>
      )}
    </main>
  )
}
