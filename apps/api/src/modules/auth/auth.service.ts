import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash, verify } from "@node-rs/argon2";

import { PrismaService } from "../../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtPayload } from "./types/jwt-payload";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    // Mensagem genérica de propósito (não revela se o e-mail existe).
    if (!user || !user.senhaHash || !(await verify(user.senhaHash, dto.senha))) {
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }
    return this.tokenResponse(user.id, user.email, user.nome);
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException("E-mail já cadastrado.");
    }
    const user = await this.prisma.usuario.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senhaHash: await hash(dto.senha),
      },
    });
    return this.tokenResponse(user.id, user.email, user.nome);
  }

  async me(userId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, nome: true, email: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  private async tokenResponse(id: string, email: string, nome: string) {
    const payload: JwtPayload = { sub: id, email };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: { id, nome, email } };
  }
}
