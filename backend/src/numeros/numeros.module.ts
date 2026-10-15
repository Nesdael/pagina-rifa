import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movimiento } from './movimiento.entity';
import { Numero } from './numero.entity';
import { Sorteo } from './sorteo.entity';
import { NumerosController } from './numeros.controller';
import { NumerosService } from './numeros.service';

@Module({
  imports: [TypeOrmModule.forFeature([Numero, Sorteo, Movimiento])],
  controllers: [NumerosController],
  providers: [NumerosService],
})
export class NumerosModule {}
