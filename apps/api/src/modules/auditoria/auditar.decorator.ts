// SPDX-License-Identifier: AGPL-3.0-or-later
import { SetMetadata } from "@nestjs/common";

export const ACAO_AUDITADA = "acao_auditada";

/** O que fica registrado na trilha: o verbo e a entidade afetada. */
export type DescricaoDaAcao = {
  /** Verbo no infinitivo, como o dono leria: "pausar quadra". */
  acao: string;
  /** A entidade afetada, para filtrar a trilha: "Quadra". */
  entidade: string;
  /**
   * Parâmetro da rota que identifica o registro afetado, quando existe.
   *
   * Fica como **nome do parâmetro** e não como valor porque o decorador é
   * avaliado uma vez, na carga do módulo, e o valor muda a cada requisição.
   */
  parametro?: string;
};

/**
 * Marca a rota como **ação sensível**, para a trilha de auditoria (RN-05).
 *
 * A RN-05 pede que ações sensíveis sejam auditadas, e a entidade `AuditLog`
 * existia no esquema desde junho **sem que nada escrevesse nela** — o
 * requisito estava no papel e não no sistema. Pior: a §5.1 do relatório
 * afirmava, no presente, que *"a trilha de auditoria registra quem executou
 * cada ação sensível"*, o que não era verdade.
 *
 * **O decorador existe para que a lista de ações sensíveis fique na própria
 * rota**, e não numa lista paralela em outro arquivo. Lista paralela é a
 * quarta forma de duas cópias de uma verdade, e este projeto já teve as
 * outras três: os tokens de cor, a regra de permissão e a cópia do esquema.
 * Rota nova sem o decorador não é auditada — e é isso que o teste do módulo
 * cobra, percorrendo os controladores de gestão.
 */
export const Auditar = (descricao: DescricaoDaAcao) => SetMetadata(ACAO_AUDITADA, descricao);
