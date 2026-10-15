import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Numero } from './numero.entity';
import { NumerosController } from './numeros.controller';
import { NumerosService } from './numeros.service';

@Module({
  imports: [TypeOrmModule.forFeature([Numero])],
  controllers: [NumerosController],
  providers: [NumerosService],
})
export class NumerosModule {}
