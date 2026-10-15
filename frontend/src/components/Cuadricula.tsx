import { dosCifras, type NumeroPublico } from '../api'

interface Props {
  numeros: NumeroPublico[]
  seleccionados: number[]
  ganador: number | null
  onToggle: (numero: number) => void
}

// La hoja del talonario: 100 casillas
export default function Cuadricula({ numeros, seleccionados, ganador, onToggle }: Props) {
  return (
    <div className="talonario" role="group" aria-label="Números de la rifa">
      {numeros.map((n) => {
        const elegido = seleccionados.includes(n.numero)
        const libre = n.estado === 'disponible'
        const clases = ['casilla', n.estado]
        if (elegido) clases.push('elegido')
        if (ganador === n.numero) clases.push('ganador')

        return (
          <button
            key={n.numero}
            type="button"
            className={clases.join(' ')}
            disabled={!libre || ganador !== null}
            aria-pressed={elegido}
            aria-label={`Número ${dosCifras(n.numero)}, ${elegido ? 'elegido' : n.estado}`}
            onClick={() => onToggle(n.numero)}
          >
            <span className="cifra">{dosCifras(n.numero)}</span>
            {n.estado === 'pagado' && <span className="firma">{n.nombre}</span>}
          </button>
        )
      })}
    </div>
  )
}
