import { Column, Entity, PrimaryColumn } from 'typeorm';

export type EstadoNumero = 'disponible' | 'apartado' | 'pagado';

@Entity('numeros')
export class Numero {
  // El número de la rifa: 0 a 99 (en pantalla se muestra como 00, 01, ...)
  @PrimaryColumn({ type: 'smallint' })
  numero: number;

  @Column({ type: 'varchar', length: 20, default: 'disponible' })
  estado: EstadoNumero;

  @Column({ type: 'varchar', length: 60, nullable: true })
  nombre: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  telefono: string | null;

  @Column({ name: 'apartado_en', type: 'timestamptz', nullable: true })
  apartadoEn: Date | null;

  @Column({ name: 'pagado_en', type: 'timestamptz', nullable: true })
  pagadoEn: Date | null;
}
