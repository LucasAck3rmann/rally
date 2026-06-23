import { z } from "zod";

export const reservaStatus = [
  "PENDENTE_PAGAMENTO",
  "CONFIRMADA",
  "CANCELADA",
  "CONCLUIDA",
  "NO_SHOW",
  "BLOQUEIO",
] as const;
export type ReservaStatus = (typeof reservaStatus)[number];

/** Entrada para criar uma reserva (validada na borda — ver Requisitos RF-08). */
export const criarReservaSchema = z
  .object({
    quadraId: z.string().min(1),
    inicio: z.coerce.date(),
    fim: z.coerce.date(),
  })
  .refine((r) => r.fim > r.inicio, {
    message: "o fim deve ser depois do início",
    path: ["fim"],
  });

export type CriarReserva = z.infer<typeof criarReservaSchema>;
