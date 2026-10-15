import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

// Deja pasar solo si el header x-api-key coincide con ADMIN_KEY del .env
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const clave = req.header('x-api-key');
    if (!clave || clave !== this.config.get<string>('ADMIN_KEY')) {
      throw new UnauthorizedException('Clave incorrecta');
    }
    return true;
  }
}
