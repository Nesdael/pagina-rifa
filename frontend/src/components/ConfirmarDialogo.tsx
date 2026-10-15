import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  abierto: boolean
  titulo: string
  children: ReactNode
  textoConfirmar: string
  peligro?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

// Ventana de confirmación con el estilo de la rifa.
// Usa <dialog> del navegador: ya trae fondo oscuro, foco y cierre con Esc.
export default function ConfirmarDialogo({
  abierto,
  titulo,
  children,
  textoConfirmar,
  peligro = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      className="dialogo"
      onCancel={(e) => { e.preventDefault(); onCancelar() }}
      // Clic fuera de la tarjeta = cancelar
      onClick={(e) => { if (e.target === ref.current) onCancelar() }}
    >
      <div className="dialogo-tarjeta">
        <h2>{titulo}</h2>
        <div className="dialogo-texto">{children}</div>
        <div className="dialogo-acciones">
          <button type="button" className="btn-texto" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className={`btn ${peligro ? 'btn-peligro' : 'btn-verde'}`} onClick={onConfirmar} autoFocus>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </dialog>
  )
}
