import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  anunciarGanador,
  confirmarPago,
  dosCifras,
  getConfig,
  getNumerosAdmin,
  liberar,
  pesos,
  quitarGanador,
  type ConfigRifa,
  type NumeroAdmin,
} from '../api'
import ConfirmarDialogo from '../components/ConfirmarDialogo'

const CLAVE_STORAGE = 'rifa-admin-clave'

// sessionStorage puede fallar (modo privado), por eso el try/catch
function leerClave(): string {
  try { return sessionStorage.getItem(CLAVE_STORAGE) ?? '' } catch { return '' }
}
function guardarClave(clave: string) {
  try { sessionStorage.setItem(CLAVE_STORAGE, clave) } catch { /* sin storage, se pide de nuevo */ }
}

interface Persona {
  telefono: string
  nombre: string
  numeros: NumeroAdmin[]
}

// Junta los números de una misma persona (mismo celular)
function agruparPorPersona(lista: NumeroAdmin[]): Persona[] {
  const grupos = new Map<string, Persona>()
  for (const n of lista) {
    const tel = n.telefono ?? 'sin-telefono'
    if (!grupos.has(tel)) grupos.set(tel, { telefono: tel, nombre: n.nombre ?? '', numeros: [] })
    grupos.get(tel)!.numeros.push(n)
  }
  return [...grupos.values()]
}

function haceCuanto(iso: string | null): string {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return "recién"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} días`
}

export default function Admin() {
  const [clave, setClave] = useState(leerClave)
  const [entrada, setEntrada] = useState('')
  const [numeros, setNumeros] = useState<NumeroAdmin[] | null>(null)
  const [config, setConfig] = useState<ConfigRifa | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // Persona que se va a liberar (abre la ventana de confirmación)
  const [porLiberar, setPorLiberar] = useState<Persona | null>(null)
  // Ganador: lo que se escribe en el campo y qué ventana está abierta
  const [cifrasGanador, setCifrasGanador] = useState('')
  const [dialogoGanador, setDialogoGanador] = useState<'anunciar' | 'quitar' | null>(null)
  // Mensaje corto que aparece abajo después de cada acción
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(id)
  }, [aviso])

  const cargar = useCallback(async (c: string) => {
    try {
      const [lista, conf] = await Promise.all([getNumerosAdmin(c), getConfig()])
      setNumeros(lista)
      setConfig(conf)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
      if ((e as Error).message === 'Clave incorrecta') setClave('')
    }
  }, [])

  // Mismo fondo de noche que la rifa
  useEffect(() => {
    document.body.classList.add('noche')
    return () => document.body.classList.remove('noche')
  }, [])

  useEffect(() => {
    getConfig().then(setConfig).catch(() => setError('No se pudo cargar la configuración'))
  }, [])

  useEffect(() => {
    if (!clave) return
    cargar(clave)
    const id = setInterval(() => cargar(clave), 15_000)
    return () => clearInterval(id)
  }, [clave, cargar])

  function entrar(e: FormEvent) {
    e.preventDefault()
    guardarClave(entrada)
    setClave(entrada)
  }

  // Aplica la acción a todos los números de la persona
  async function accion(tipo: 'confirmar' | 'liberar', persona: Persona) {
    const lista = persona.numeros.map((n) => dosCifras(n.numero)).join(', ')
    setOcupado(true)
    try {
      for (const n of persona.numeros) {
        await (tipo === 'confirmar' ? confirmarPago(clave, n.numero) : liberar(clave, n.numero))
      }
      setAviso(tipo === 'confirmar' ? `Pago confirmado: ${lista} de ${persona.nombre}` : `Liberados: ${lista}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
      cargar(clave)
    }
  }

  async function guardarGanador(tipo: 'anunciar' | 'quitar') {
    setDialogoGanador(null)
    setOcupado(true)
    try {
      if (tipo === 'anunciar') {
        await anunciarGanador(clave, Number(cifrasGanador))
        setAviso(`Ganador anunciado: ${cifrasGanador.padStart(2, '0')}`)
        setCifrasGanador('')
      } else {
        await quitarGanador(clave)
        setAviso('Se quitó el ganador. La rifa está abierta otra vez')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
      cargar(clave)
    }
  }

  function confirmarLiberar() {
    if (porLiberar) accion('liberar', porLiberar)
    setPorLiberar(null)
  }

  if (!clave) {
    return (
      <main className="pagina admin">
        <form className="hoja-form login" onSubmit={entrar}>
          <img src="/logo-loteria.png" alt="" className="logo-chico" width="600" height="335" />
          <h1>Panel de la rifa</h1>
          <label>
            Clave de administrador
            <input type="password" value={entrada} onChange={(e) => setEntrada(e.target.value)} required autoFocus />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-verde" type="submit">Entrar</button>
        </form>
      </main>
    )
  }

  if (!numeros || !config) {
    return <main className="pagina admin"><p className="cargando">{error ?? 'Cargando…'}</p></main>
  }

  const apartados = numeros.filter((n) => n.estado === 'apartado')
  const pagados = numeros.filter((n) => n.estado === 'pagado')
  const porConfirmar = agruparPorPersona(apartados)
  const compradores = agruparPorPersona(pagados)

  const recogido = pagados.length * config.precio
  const total = 100 * config.precio
  const faltaPremio = config.premio - recogido

  // Para el ganador: el escrito en el campo (al anunciar) o el ya guardado
  const cifrasValidas = /^\d{1,2}$/.test(cifrasGanador)
  const numeroGanador = config.ganador ?? (cifrasValidas ? Number(cifrasGanador) : null)
  const datosGanador = numeroGanador !== null ? numeros.find((n) => n.numero === numeroGanador) : undefined
  const ganadorPago = datosGanador?.estado === 'pagado'

  return (
    <main className="pagina admin">
      <header className="admin-top">
        <h1>Panel de la rifa</h1>
        <button type="button" className="btn-texto" onClick={() => { guardarClave(''); setClave('') }}>
          Salir
        </button>
      </header>


      <section className={`caja-sorteo ${config.ganador !== null ? 'con-ganador' : ''}`} aria-label="Número ganador">
        {config.ganador === null ? (
          <>
            <h2>Número ganador</h2>
            <p className="caja-nota">
              Cuando juegue el {config.loteria}, escribe las dos últimas cifras y anúncialo.
            </p>
            <form
              className="form-ganador"
              onSubmit={(e) => { e.preventDefault(); if (cifrasValidas) setDialogoGanador('anunciar') }}
            >
              <input
                className="input-ganador"
                value={cifrasGanador}
                onChange={(e) => setCifrasGanador(e.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                placeholder="00"
                aria-label="Dos últimas cifras del ganador"
              />
              <button className="btn btn-verde" type="submit" disabled={!cifrasValidas || ocupado}>
                Anunciar ganador
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="caja-titulo">Número ganador</p>
            <div className="ganador-fila">
              <span className="ganador-cifra">{dosCifras(config.ganador)}</span>
              <div className="persona-datos">
                {ganadorPago && datosGanador ? (
                  <>
                    <strong>{datosGanador.nombre}</strong>
                    <a href={`https://wa.me/${config.indicativo}${datosGanador.telefono}`} target="_blank" rel="noreferrer">
                      WhatsApp {datosGanador.telefono}
                    </a>
                  </>
                ) : (
                  <strong>Este número no se vendió</strong>
                )}
              </div>
            </div>
            <button type="button" className="btn-texto" disabled={ocupado} onClick={() => setDialogoGanador('quitar')}>
              Corregir ganador
            </button>
          </>
        )}
      </section>

      <section className="caja-plata" aria-label="Dinero recogido">
        <p className="caja-titulo">Recogido</p>
        <p className="caja-monto">{pesos(recogido)}</p>
        <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={recogido}>
          <span style={{ width: `${(recogido / total) * 100}%` }} />
          <i className="marca-premio" style={{ left: `${(config.premio / total) * 100}%` }} title="Valor del premio" />
        </div>
        <p className="caja-nota">
          {faltaPremio > 0
            ? <>Faltan <strong>{pesos(faltaPremio)}</strong> para cubrir el premio de {pesos(config.premio)}.</>
            : <>Ya se cubrió el premio. Ganancia hasta ahora: <strong>{pesos(-faltaPremio)}</strong>.</>}
          {' '}Si se venden todos: {pesos(total)}.
        </p>
      </section>

      <dl className="cuentas">
        <div className="c-vendidos"><dt>Vendidos</dt><dd>{pagados.length}</dd></div>
        <div className="c-apartados"><dt>Por confirmar</dt><dd>{apartados.length}</dd></div>
        <div className="c-libres"><dt>Libres</dt><dd>{100 - pagados.length - apartados.length}</dd></div>
      </dl>

      <div className="mini-talonario" aria-label="Mapa de los 100 números">
        {numeros.map((n) => (
          <span
            key={n.numero}
            className={`mini ${n.vencido ? 'disponible' : n.estado}`}
            title={n.nombre ? `${dosCifras(n.numero)}: ${n.nombre}` : dosCifras(n.numero)}
          >
            {dosCifras(n.numero)}
          </span>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <section>
        <h2>Por confirmar <span className="conteo">{porConfirmar.length}</span></h2>
        {porConfirmar.length === 0 && <p className="vacio">Nadie está esperando confirmación.</p>}
        <ul className="personas">
          {porConfirmar.map((p) => {
            const vencido = p.numeros.every((n) => n.vencido)
            return (
              <li key={p.telefono} className={`persona apartado ${vencido ? 'vencido' : ''}`}>
                <div className="persona-datos">
                  <strong>{p.nombre}</strong>
                  <a href={`https://wa.me/${config.indicativo}${p.telefono}`} target="_blank" rel="noreferrer">WhatsApp {p.telefono}</a>
                  <span className="fichas">
                    {p.numeros.map((n) => <span key={n.numero} className="ficha">{dosCifras(n.numero)}</span>)}
                  </span>
                  <span className="meta">
                    {pesos(p.numeros.length * config.precio)}, apartó {haceCuanto(p.numeros[0].apartadoEn)}
                    {vencido && '. Ya venció: alguien más puede tomarlos'}
                  </span>
                </div>
                <div className="persona-acciones">
                  <button className="btn btn-verde" disabled={ocupado} onClick={() => accion('confirmar', p)}>
                    Confirmar pago
                  </button>
                  <button className="btn-texto" disabled={ocupado} onClick={() => setPorLiberar(p)}>
                    Liberar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2>Vendidos <span className="conteo">{compradores.length}</span></h2>
        {compradores.length === 0 && <p className="vacio">Todavía no hay pagos confirmados.</p>}
        <ul className="personas">
          {compradores.map((p) => (
            <li key={p.telefono} className="persona pagado">
              <div className="persona-datos">
                <strong>{p.nombre}</strong>
                <a href={`https://wa.me/${config.indicativo}${p.telefono}`} target="_blank" rel="noreferrer">WhatsApp {p.telefono}</a>
                <span className="fichas">
                  {p.numeros.map((n) => <span key={n.numero} className="ficha">{dosCifras(n.numero)}</span>)}
                </span>
              </div>
              <div className="persona-acciones">
                <button className="btn-texto" disabled={ocupado} onClick={() => setPorLiberar(p)}>
                  Liberar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmarDialogo
        abierto={porLiberar !== null}
        titulo="¿Liberar estos números?"
        textoConfirmar="Sí, liberar"
        peligro
        onConfirmar={confirmarLiberar}
        onCancelar={() => setPorLiberar(null)}
      >
        {porLiberar && (
          <>
            <span className="fichas">
              {porLiberar.numeros.map((n) => <span key={n.numero} className="ficha">{dosCifras(n.numero)}</span>)}
            </span>
            <p>
              Son de <strong>{porLiberar.nombre}</strong>. Quedarán libres para que otra persona los aparte.
            </p>
            {porLiberar.numeros.some((n) => n.estado === 'pagado') && (
              <p className="dialogo-alerta">Ojo: esta persona ya pagó.</p>
            )}
          </>
        )}
      </ConfirmarDialogo>

      <ConfirmarDialogo
        abierto={dialogoGanador === 'anunciar'}
        titulo={`¿Anunciar el ${cifrasGanador.padStart(2, '0')} como ganador?`}
        textoConfirmar="Sí, anunciar"
        onConfirmar={() => guardarGanador('anunciar')}
        onCancelar={() => setDialogoGanador(null)}
      >
        <span className="ficha ficha-grande">{cifrasGanador.padStart(2, '0')}</span>
        {ganadorPago && datosGanador ? (
          <p>Lo compró <strong>{datosGanador.nombre}</strong> ({datosGanador.telefono}).</p>
        ) : datosGanador?.estado === 'apartado' && !datosGanador.vencido ? (
          <p className="dialogo-alerta">
            Está apartado por {datosGanador.nombre}, pero el pago no está confirmado.
          </p>
        ) : (
          <p className="dialogo-alerta">Este número no se vendió.</p>
        )}
        <p>La página mostrará el número ganador y ya nadie podrá apartar números.</p>
      </ConfirmarDialogo>

      <ConfirmarDialogo
        abierto={dialogoGanador === 'quitar'}
        titulo="¿Quitar el ganador?"
        textoConfirmar="Sí, quitar"
        peligro
        onConfirmar={() => guardarGanador('quitar')}
        onCancelar={() => setDialogoGanador(null)}
      >
        <p>Úsalo solo si te equivocaste al escribirlo. La rifa vuelve a quedar abierta y la gente podrá apartar números otra vez.</p>
      </ConfirmarDialogo>

      {aviso && <p className="aviso" role="status">{aviso}</p>}
    </main>
  )
}
