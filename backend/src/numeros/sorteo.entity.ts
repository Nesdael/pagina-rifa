import { Column, Entity, PrimaryColumn } from 'typeorm';

// Una sola fila (id = 1) con el resultado del sorteo
@Entity('sorteo')
export class Sorteo {
  @PrimaryColumn({ type: 'smallint' })
  id: number;

  // Las dos últimas cifras de la lotería (0 a 99). null = todavía no se ha jugado
  @Column({ type: 'smallint', nullable: true })
  ganador: number | null;

  @Column({ name: 'anunciado_en', type: 'timestamptz', nullable: true })
  anunciadoEn: Date | null;
}
