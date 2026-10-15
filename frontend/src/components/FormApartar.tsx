import { useState, type FormEvent } from 'react'
import { dosCifras, pesos } from '../api'

interface Props {
  seleccionados: number[]
  precio: number
  enviando: boolean
  error: string | null
  onApartar: (nombre: string, telefono: string) => void
  onCancelar: () => void
}

export default function FormApartar({ seleccionados, precio, enviando, error, onApartar, onCancelar }: Props) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')

  function enviar(e: FormEvent) {
    e.preventDefault()
    onApartar(nombre.trim(), telefono.replace(/\D/g, ''))
  }

  return (
    <form className="hoja-form" onSubmit={enviar}>
      <h2>Aparta tus números</h2>
      <p className="resumen">
        {seleccionados.map(dosCifras).join(', ')} por <strong>{pesos(seleccionados.length * precio)}</strong>
      </p>

      <label>
        Tu nombre
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="name"
          minLength={3}
          maxLength={60}
          required
          autoFocus
        />
      </label>

      <label>
        Tu celular
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="300 123 4567"
          required
        />
      </label>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="acciones">
        <button type="button" className="btn-texto" onClick={onCancelar}>
          Volver
        </button>
        <button type="submit" className="btn" disabled={enviando}>
          {enviando ? 'Apartando…' : 'Apartar números'}
        </button>
      </div>
    </form>
  )
}
