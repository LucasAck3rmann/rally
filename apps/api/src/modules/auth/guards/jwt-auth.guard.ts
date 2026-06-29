import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

import { JwtPayload } from "../types/jwt-payload";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token ausente.");
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado.");
    }
  }
}
