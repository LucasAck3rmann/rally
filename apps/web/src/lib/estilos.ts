// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Altura mínima de qualquer alvo de toque.
 *
 * O RNF-08 e a seção 5.2 do relatório prometem 44 px — que é o critério 2.5.5
 * da WCAG (nível AAA) e a recomendação das duas plataformas móveis, mais
 * exigente que os 24 px do 2.5.8 no nível AA. O aplicativo **mede** esse
 * número desde o PR #57; a web passou a declará-lo aqui, num lugar só, porque
 * altura que nasce de preenchimento mais tamanho de fonte não é decisão: é
 * acidente, e muda quando alguém troca o `text-[14px]` por `text-[13px]`.
 *
 * `inline-flex` com centralização acompanha o `min-h`: sem isso o conteúdo
 * encosta no topo quando a altura mínima passa a valer.
 */
export const ALVO_MINIMO = "min-h-[44px]";

/**
 * Campo de texto dos formulários de conta e de gestão.
 *
 * **Estava copiado em três arquivos** — entrada, recuperação e redefinição —
 * com a string idêntica nos três. É o terceiro caso do mesmo tipo no projeto:
 * os tokens de cor divergiram em 30/09 depois de ficarem "em sincronia" por
 * comentário, e a regra de permissão estava repetida em quatro páginas antes
 * do `podeAdministrar`. Uma regra, um lugar.
 */
export const CAMPO =
  `w-full ${ALVO_MINIMO} rounded-button border border-line bg-white px-4 py-3 ` +
  "text-[15px] text-ink transition focus:border-coral " +
  "focus:ring-2 focus:ring-coral/30";

/** Campo compacto das barras de filtro, onde o rótulo fica fora do controle. */
export const CAMPO_COMPACTO =
  `${ALVO_MINIMO} rounded-button border border-line bg-white px-3 py-2 ` +
  "text-[14px] text-ink transition focus:border-coral";
