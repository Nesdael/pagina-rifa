import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApartarDto } from './dto/apartar.dto';
import { EstadoNumero, Numero } from './numero.entity';

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
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // Al arrancar: si la tabla está vacía, crea los números del 00 al 99
  async onModuleInit(): Promise<void> {
    const total = await this.repo.count();
    if (total === 0) {
      const numeros = Array.from({ length: 100 }, (_, i) => this.repo.create({ numero: i }));
      await this.repo.save(numeros);
    }
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
    const limite = this.limiteApartado();

    await this.dataSource.transaction(async (manager) => {
      for (const numero of dto.numeros) {
        const resultado = await manager
          .createQueryBuilder()
          .update(Numero)
          .set({
            estado: 'apartado',
            nombre: dto.nombre.trim(),
            telefono: dto.telefono,
            apartadoEn: new Date(),
            pagadoEn: null,
          })
          .where('numero = :numero', { numero })
          .andWhere(
            "(estado = 'disponible' OR (estado = 'apartado' AND apartado_en < :limite))",
            { limite },
          )
          .execute();

        if (resultado.affected === 0) {
          // Al lanzar el error, la transacción deshace los que ya se habían apartado
          throw new ConflictException(
            `El número ${String(numero).padStart(2, '0')} ya no está disponible`,
          );
        }
      }
    });

    return dto.numeros;
  }

  async confirmarPago(numero: number): Promise<Numero> {
    const n = await this.buscar(numero);
    if (n.estado !== 'apartado') {
      throw new BadRequestException('Solo se puede confirmar un número apartado');
    }
    n.estado = 'pagado';
    n.pagadoEn = new Date();
    return this.repo.save(n);
  }

  async liberar(numero: number): Promise<Numero> {
    const n = await this.buscar(numero);
    n.estado = 'disponible';
    n.nombre = null;
    n.telefono = null;
    n.apartadoEn = null;
    n.pagadoEn = null;
    return this.repo.save(n);
  }

  private async buscar(numero: number): Promise<Numero> {
    const n = await this.repo.findOneBy({ numero });
    if (!n) throw new NotFoundException('Ese número no existe');
    return n;
  }
}
