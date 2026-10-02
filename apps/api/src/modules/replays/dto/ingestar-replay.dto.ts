// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/**
 * Entrega de um clipe pelo provedor de captação (RF-30, ADR-0012).
 *
 * O provedor não sabe de quem é o vídeo — ele sabe **qual quadra** e **que
 * hora**. Quem transforma isso em "clipe do Augusto" é o Rally, e é por isso
 * que `quadraId` e `gravadoEm` são obrigatórios e `clienteId` não existe no
 * contrato: aceitar um dono vindo de fora deixaria o parceiro apontar
 * qualquer clipe para qualquer pessoa.
 */
export class IngestarReplayDto {
  @IsString()
  quadraId!: string;

  /** Instante do lance, em ISO-8601 com fuso. */
  @IsISO8601()
  gravadoEm!: string;

  /** Chave do arquivo no provedor. É a chave de idempotência da entrega. */
  @IsString()
  @MinLength(3)
  @MaxLength(512)
  s3Key!: string;

  /** Quando já vem pronto para assistir. Sem URL, o clipe fica processando. */
  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7200)
  duracaoSeg?: number;
}
