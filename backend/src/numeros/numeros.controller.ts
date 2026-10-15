import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminGuard } from './admin.guard';
import { ApartarDto } from './dto/apartar.dto';
import { NumerosService } from './numeros.service';

@Controller()
export class NumerosController {
  constructor(
    private readonly numerosService: NumerosService,
    private readonly config: ConfigService,
  ) {}

  // Datos de la rifa que el frontend necesita mostrar
  @Get('config')
  getConfig() {
    return {
      precio: Number(this.config.get('PRECIO')),
      premio: Number(this.config.get('PREMIO')),
      loteria: this.config.get<string>('LOTERIA'),
      fechaSorteo: this.config.get<string>('FECHA_SORTEO'),
      whatsapp: this.config.get<string>('WHATSAPP'),
      minutosApartado: Number(this.config.get('MINUTOS_APARTADO')),
      ganador: this.config.get<string>('GANADOR') || null,
    };
  }

  @Get('numeros')
  listar() {
    return this.numerosService.listarPublico();
  }

  @Post('apartar')
  apartar(@Body() dto: ApartarDto) {
    return this.numerosService.apartar(dto);
  }

  // ---- Rutas del admin (necesitan el header x-api-key) ----

  @UseGuards(AdminGuard)
  @Get('admin/numeros')
  listarAdmin() {
    return this.numerosService.listarAdmin();
  }

  @UseGuards(AdminGuard)
  @Post('admin/confirmar/:numero')
  confirmar(@Param('numero', ParseIntPipe) numero: number) {
    return this.numerosService.confirmarPago(numero);
  }

  @UseGuards(AdminGuard)
  @Post('admin/liberar/:numero')
  liberar(@Param('numero', ParseIntPipe) numero: number) {
    return this.numerosService.liberar(numero);
  }
}
