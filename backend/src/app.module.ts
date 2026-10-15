import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { Movimiento } from './numeros/movimiento.entity';
import { Numero } from './numeros/numero.entity';
import { Sorteo } from './numeros/sorteo.entity';
import { NumerosModule } from './numeros/numeros.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Límite de peticiones (se aplica solo donde se usa ThrottlerGuard: /api/apartar)
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 5 }],
      errorMessage: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.',
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [Numero, Sorteo, Movimiento],
        // Crea/actualiza la tabla solo. Para una tabla tan simple no hacen falta migrations.
        synchronize: true,
      }),
    }),

    // Sirve el build de React (frontend/dist). Todo lo que no sea /api va al frontend.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend', 'dist'),
      exclude: ['/api/(.*)'],
    }),

    NumerosModule,
  ],
})
export class AppModule {}
