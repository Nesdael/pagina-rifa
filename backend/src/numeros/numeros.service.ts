import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ApartarDto } from './dto/apartar.dto';
import { Accion, Movimiento } from './movimiento.entity';
import { EstadoNumero, Numero } from './numero.entity';
import { Sorteo } from './sorteo.entity';

// Máximo de números apartados SIN pagar que puede tener un mismo celular
export const MAX_APARTADOS_POR_CELULAR = 10;

// Lo que ve cualquier persona: sin teléfono y con el nombre recortado
export interface NumeroPublico {
  numero: number;
  estado: EstadoNumero;
  nombre: string | null;
}

export interface NumeroAdmin extends Numero {
  vencido: boolean;
}

@Injectable()
export class NumerosService implements OnModuleInit {
  constructor(
    @InjectRepository(Numero) private readonly repo: Repository<Numero>,
    @InjectRepository(Sorteo) private readonly sorteoRepo: Repository<Sorteo>,
    @InjectRepository(Movimiento) private readonly movimientoRepo: Repository<Movimiento>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // Al arrancar: si la tabla está vacía, crea los números del 00 al 99
  // y la fila del sorteo (sin ganador)
  async onModuleInit(): Promise<void> {
    const total = await this.repo.count();
    if (total === 0) {
      const numeros = Array.from({ length: 100 }, (_, i) => this.repo.create({ numero: i }));
      await this.repo.save(numeros);
    }
    const sorteo = await this.sorteoRepo.findOneBy({ id: 1 });
    if (!sorteo) {
      await this.sorteoRepo.save({ id: 1, ganador: null, anunciadoEn: null });
    }
  }

  // Guarda una fila en el historial (dentro de la misma transacción si se pasa el manager)
  private registrar(
    manager: EntityManager,
    accion: Accion,
    numero: number | null,
    nombre: string | null = null,
    telefono: string | null = null,
  ) {
    return manager.insert(Movimiento, { accion, numero, nombre, telefono });
  }

  // ---- Ganador del sorteo ----

  async getGanador(): Promise<number | null> {
    const sorteo = await this.sorteoRepo.findOneBy({ id: 1 });
    return sorteo?.ganador ?? null;
  }

  async anunciarGanador(numero: number): Promise<Sorteo> {
    return this.dataSource.transaction(async (manager) => {
      const comprador = await manager.findOneBy(Numero, { numero });
      const pago = comprador?.estado === 'pagado';
      await this.registrar(
        manager,
        'ganador anunciado',
        numero,
        pago ? comprador.nombre : null,
        pago ? comprador.telefono : null,
      );
      return manager.save(Sorteo, { id: 1, ganador: numero, anunciadoEn: new Date() });
    });
  }

  // Por si se equivocaron al escribirlo
  async quitarGanador(): Promise<Sorteo> {
    return this.dataSource.transaction(async (manager) => {
      const actual = await manager.findOneBy(Sorteo, { id: 1 });
      await this.registrar(manager, 'ganador quitado', actual?.ganador ?? null);
      return manager.save(Sorteo, { id: 1, ganador: null, anunciadoEn: null });
    });
  }

  // Fecha antes de la cual un apartado ya se venció
  private limiteApartado(): Date {
    const minutos = Number(this.config.get('MINUTOS_APARTADO') ?? 120);
    return new Date(Date.now() - minutos * 60_000);
  }

  private estaVencido(n: Numero, limite: Date): boolean {
    return n.estado === 'apartado' && n.apartadoEn !== null && n.apartadoEn < limite;
  }

  // "Juan Pérez Gómez" -> "Juan P."
  private recortarNombre(nombre: string | null): string | null {
    if (!nombre) return null;
    const [primero, segundo] = nombre.trim().split(/\s+/);
    return segundo ? `${primero} ${segundo[0].toUpperCase()}.` : primero;
  }

  async listarPublico(): Promise<NumeroPublico[]> {
    const numeros = await this.repo.find({ order: { numero: 'ASC' } });
    const limite = this.limiteApartado();
    return numeros.map((n) =>
      this.estaVencido(n, limite)
        ? { numero: n.numero, estado: 'disponible', nombre: null }
        : { numero: n.numero, estado: n.estado, nombre: this.recortarNombre(n.nombre) },
    );
  }

  async listarAdmin(): Promise<NumeroAdmin[]> {
    const numeros = await this.repo.find({ order: { numero: 'ASC' } });
    const limite = this.limiteApartado();
    return numeros.map((n) => ({ ...n, vencido: this.estaVencido(n, limite) }));
  }

  // Aparta todos los números o ninguno (transacción).
  // El UPDATE solo afecta la fila si sigue libre, así dos personas no pueden
  // quedarse con el mismo número aunque le den clic al mismo tiempo.
  async apartar(dto: ApartarDto): Promise<number[]> {
    if ((await this.getGanador()) !== null) {
      throw new BadRequestException('La rifa ya terminó, ya hay un número ganador');
    }
    const limite = this.limiteApartado();
    const nombre = dto.nombre.trim();

    await this.dataSource.transaction(async (manager) => {
      // Límite por celular: así nadie bloquea la rifa apartando todo sin pagar
      const yaApartados = await manager
        .createQueryBuilder(Numero, 'n')
        .where('n.telefono = :telefono', { telefono: dto.telefono })
        .andWhere("n.estado = 'apartado'")
        .andWhere('n.apartado_en >= :limite', { limite })
        .getCount();

      if (yaApartados + dto.numeros.length > MAX_APARTADOS_POR_CELULAR) {
        throw new BadRequestException(
          `Puedes tener máximo ${MAX_APARTADOS_POR_CELULAR} números apartados sin pagar. ` +
            `Ya tienes ${yaApartados}: paga esos primero para apartar más.`,
        );
      }

      for (const numero of dto.numeros) {
        const resultado = await manager
          .createQueryBuilder()
          .update(Numero)
          .set({ estado: 'apartado', nombre, telefono: dto.telefono, apartadoEn: new Date(), pagadoEn: null })
          .where('numero = :numero', { numero })
          .andWhere("(estado = 'disponible' OR (estado = 'apartado' AND apartado_en < :limite))", { limite })
          .execute();

        if (resultado.affected === 0) {
          // Al lanzar el error, la transacción deshace los que ya se habían apartado
          throw new ConflictException(`El número ${String(numero).padStart(2, '0')} ya no está disponible`);
        }
        await this.registrar(manager, 'apartado', numero, nombre, dto.telefono);
      }
    });

    return dto.numeros;
  }

  async confirmarPago(numero: number): Promise<Numero> {
    return this.dataSource.transaction(async (manager) => {
      const n = await this.buscar(manager, numero);
      if (n.estado !== 'apartado') {
        throw new BadRequestException('Solo se puede confirmar un número apartado');
      }
      n.estado = 'pagado';
      n.pagadoEn = new Date();
      await this.registrar(manager, 'pago confirmado', numero, n.nombre, n.telefono);
      return manager.save(n);
    });
  }

  async liberar(numero: number): Promise<Numero> {
    return this.dataSource.transaction(async (manager) => {
      const n = await this.buscar(manager, numero);
      // Se guarda quién lo tenía ANTES de borrar sus datos del número
      await this.registrar(manager, 'liberado', numero, n.nombre, n.telefono);
      n.estado = 'disponible';
      n.nombre = null;
      n.telefono = null;
      n.apartadoEn = null;
      n.pagadoEn = null;
      return manager.save(n);
    });
  }

  private async buscar(manager: EntityManager, numero: number): Promise<Numero> {
    const n = await manager.findOneBy(Numero, { numero });
    if (!n) throw new NotFoundException('Ese número no existe');
    return n;
  }

  // ---- Historial y respaldos ----

  listarHistorial(limite = 100): Promise<Movimiento[]> {
    return this.movimientoRepo.find({ order: { id: 'DESC' }, take: limite });
  }

  // CSV con ";" y BOM para que Excel en español lo abra bien (con tildes y columnas separadas)
  private aCsv(filas: (string | number | null)[][]): string {
    const celda = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
  }

  private fecha(d: Date | null): string {
    if (!d) return '';
    const zona = this.config.get<string>('ZONA_HORARIA') ?? 'America/Bogota';
    return d.toLocaleString('es-CO', { timeZone: zona });
  }

  async respaldoNumeros(): Promise<string> {
    const numeros = await this.listarAdmin();
    return this.aCsv([
      ['Número', 'Estado', 'Nombre', 'Celular', 'Apartado el', 'Pagado el'],
      ...numeros.map((n) => [
        String(n.numero).padStart(2, '0'),
        n.vencido ? 'apartado (vencido)' : n.estado,
        n.nombre,
        n.telefono,
        this.fecha(n.apartadoEn),
        this.fecha(n.pagadoEn),
      ]),
    ]);
  }

  async respaldoHistorial(): Promise<string> {
    const movimientos = await this.movimientoRepo.find({ order: { id: 'ASC' } });
    return this.aCsv([
      ['Fecha', 'Acción', 'Número', 'Nombre', 'Celular'],
      ...movimientos.map((m) => [
        this.fecha(m.fecha),
        m.accion,
        m.numero === null ? '' : String(m.numero).padStart(2, '0'),
        m.nombre,
        m.telefono,
      ]),
    ]);
  }
}
