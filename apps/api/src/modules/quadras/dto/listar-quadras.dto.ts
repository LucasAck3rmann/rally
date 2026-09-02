import { IsOptional, IsString, MaxLength } from "class-validator";

/** Filtros da busca de quadras (chips de modalidade + campo de busca da Home). */
export class ListarQuadrasDto {
  /** Nome da modalidade, ex.: "Beach Tennis". */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  modalidade?: string;

  /** Texto livre: nome da quadra, do estabelecimento ou bairro. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busca?: string;
}
