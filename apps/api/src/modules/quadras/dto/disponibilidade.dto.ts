import { Matches } from "class-validator";

/** Dia consultado na grade de horários (hora local do estabelecimento). */
export class DisponibilidadeDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "data deve estar no formato YYYY-MM-DD" })
  data!: string;
}
