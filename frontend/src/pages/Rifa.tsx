import { useCallback, useEffect, useRef, useState } from 'react'
import { apartar, dosCifras, fechaLarga, getConfig, getNumeros, pesos, type ConfigRifa, type NumeroPublico } from '../api'
import Cuadricula from '../components/Cuadricula'
import FormApartar from '../components/FormApartar'

type Paso = 'eligiendo' | 'formulario' | 'listo'

const REFRESCO_MS = 10_000

// "Faltan 15 días para el sorteo"
function textoFaltan(fechaSorteo: string): string {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const sorteo = new Date(fechaSorteo + 'T00:00:00')
  const dias = Math.round((sorteo.getTime() - hoy.getTime()) / 86_400_000)
  if (dias > 1) return `Faltan ${dias} días para el sorteo`
  if (dias === 1) return '¡El sorteo es mañana!'
  if (dias === 0) return '¡Hoy es el sorteo!'
  return 'Esperando el resultado del sorteo'
}

export default function Rifa() {
  const [config, setConfig] = useState<ConfigRifa | null>(null)
  const [numeros, setNumeros] = useState<NumeroPublico[]>([])
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [paso, setPaso] = useState<Paso>('eligiendo')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeWhatsapp, setMensajeWhatsapp] = useState('')
  const [apartados, setApartados] = useState<number[]>([])
  // Números que tenía elegidos y que otra persona apartó primero (para avisar)
  const [quitados, setQuitados] = useState<number[]>([])

  // Copia de la selección para leerla dentro de cargarNumeros sin recrearla
  const seleccionadosRef = useRef<number[]>([])
  seleccionadosRef.current = seleccionados

  // Trae los números y devuelve los que se me quitaron porque alguien más los apartó
  const cargarNumeros = useCallback(async (): Promise<number[]> => {
    try {
      const lista = await getNumeros()
      setNumeros(lista)
      const sel = seleccionadosRef.current
      const ocupados = sel.filter((n) => lista[n]?.estado !== 'disponible')
      if (ocupados.length > 0) {
        const quedan = sel.filter((n) => !ocupados.includes(n))
        seleccionadosRef.current = quedan
        setSeleccionados(quedan)
        setQuitados(ocupados)
      }
      return ocupados
    } catch {
      return [] // si falla un refresco, se intenta en el siguiente
    }
  }, [])

  // Si me quitaron todos los números mientras llenaba el formulario, vuelvo a la cuadrícula
  useEffect(() => {
    if (paso === 'formulario' && seleccionados.length === 0) setPaso('eligiendo')
  }, [paso, seleccionados])

  // Antes de mostrar el formulario reviso que lo elegido siga libre,
  // así el total que ve la persona es el real
  async function irAlFormulario() {
    setQuitados([])
    await cargarNumeros()
    if (seleccionadosRef.current.length > 0) setPaso('formulario')
  }

  // Fondo de noche solo en la página de la rifa (el admin queda claro)
  useEffect(() => {
    document.body.classList.add('noche')
    return () => document.body.classList.remove('noche')
  }, [])

  // Carga inicial + refresco cada 10 segundos
  useEffect(() => {
    getConfig().then(setConfig).catch(() => setError('No se pudo cargar la rifa'))
    cargarNumeros()
    const id = setInterval(cargarNumeros, REFRESCO_MS)
    return () => clearInterval(id)
  }, [cargarNumeros])

  function toggle(numero: number) {
    setQuitados([])
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
      cargarNumeros()
    } catch (e) {
      // Si fue porque alguien apartó uno primero, el aviso de "quitados" ya lo explica
      const ocupados = await cargarNumeros()
      if (ocupados.length === 0) setError((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  function empezarOtraVez() {
    setSeleccionados([])
    setQuitados([])
    setError(null)
    setPaso('eligiendo')
  }

  if (!config) {
    return <main className="pagina"><p className="cargando">{error ?? 'Cargando la rifa…'}</p></main>
  }

  const ganador = config.ganador
  const quedan = numeros.filter((n) => n.estado === 'disponible').length
  const horas = config.minutosApartado / 60
  const tiempoApartado = horas >= 1 ? `${horas} ${horas === 1 ? 'hora' : 'horas'}` : `${config.minutosApartado} minutos`
  const datosGanador = ganador !== null ? numeros.find((n) => n.numero === ganador) : undefined

  return (
    <main className="pagina">
      <header className="portada">
        <div className="boleta">
          <div className="boleta-talon" aria-hidden="true">
            <span>N.º 00 al 99</span>
          </div>
          <div className="boleta-cuerpo">
            <h1>
              <span className="gana">¡Gánate</span>
              <span className="premio">{pesos(config.premio)}</span>
              <span className="efectivo">en efectivo!</span>
            </h1>
            <div className="juega">
              <img src="/logo-loteria.png" alt={`Lotería ${config.loteria}`} width="600" height="335" />
              <p>
                Juega el <strong>{fechaLarga(config.fechaSorteo)}</strong> con las dos últimas cifras del {config.loteria}.
              </p>
            </div>
          </div>
        </div>
        <p className="sticker">
          <strong>{pesos(config.precio)}</strong> el número
        </p>
      </header>

      {ganador === null && (
        <section className="marcador" aria-label="Cómo va la rifa">
          <p className="faltan">{textoFaltan(config.fechaSorteo)}</p>
          <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100 - quedan}>
            <span style={{ width: `${100 - quedan}%` }} />
          </div>
          <p className="quedan">
            {quedan === 0 ? '¡Se vendieron todos!' : <>Quedan <strong>{quedan}</strong> de 100 números</>}
          </p>
        </section>
      )}

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

      {quitados.length > 0 && paso !== 'listo' && (
        <p className="aviso-quitados" role="alert">
          {quitados.length === 1
            ? `Otra persona acaba de apartar el ${dosCifras(quitados[0])}. Lo quitamos de tu selección.`
            : `Otra persona acaba de apartar los números ${quitados.map(dosCifras).join(', ')}. Los quitamos de tu selección.`}
          {seleccionados.length === 0 && ' Elige otros números.'}
        </p>
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
            <p className="instrucciones">Toca los números que quieras y apártalos.</p>
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
          <button type="button" className="btn" onClick={irAlFormulario}>
            Apartar
          </button>
        </div>
      )}
    </main>
  )
}
