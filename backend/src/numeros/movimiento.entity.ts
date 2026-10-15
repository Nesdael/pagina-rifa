import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type Accion = 'apartado' | 'pago confirmado' | 'liberado' | 'ganador anunciado' | 'ganador quitado';

// Historial de todo lo que pasa en la rifa. Solo se agregan filas, nunca se borran:
// si alguien libera un número por error, aquí queda quién lo tenía.
@Entity('movimientos')
export class Movimiento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  accion: Accion;

  // null en los movimientos que no son de un número (no aplica hoy, pero queda abierto)
  @Column({ type: 'smallint', nullable: true })
  numero: number | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  nombre: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  telefono: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha: Date;
}
