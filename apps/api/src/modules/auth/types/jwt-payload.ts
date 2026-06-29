/** Conteúdo do JWT de acesso. */
export interface JwtPayload {
  sub: string; // id do usuário
  email: string;
}
