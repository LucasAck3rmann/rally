import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

import { JwtPayload } from "../types/jwt-payload";

/// Injeta o payload do JWT (usuário autenticado) num handler protegido.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();
    return req.user;
  },
);
