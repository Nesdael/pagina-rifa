import { IsInt, Max, Min } from 'class-validator';

export class GanadorDto {
  @IsInt({ message: 'El ganador debe ser un número' })
  @Min(0, { message: 'Los números van del 00 al 99' })
  @Max(99, { message: 'Los números van del 00 al 99' })
  numero: number;
}
