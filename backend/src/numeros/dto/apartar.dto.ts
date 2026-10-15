import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class ApartarDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos un número' })
  @ArrayMaxSize(10, { message: 'Máximo 10 números por vez' })
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true, message: 'Los números van del 00 al 99' })
  @Max(99, { each: true, message: 'Los números van del 00 al 99' })
  numeros: number[];

  @IsString()
  @Length(3, 60, { message: 'El nombre debe tener entre 3 y 60 letras' })
  nombre: string;

  // Celular colombiano: 10 dígitos y empieza por 3
  @Matches(/^3\d{9}$/, { message: 'El celular debe tener 10 dígitos y empezar por 3' })
  telefono: string;
}
