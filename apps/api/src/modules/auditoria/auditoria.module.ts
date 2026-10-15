// SPDX-License-Identifier: AGPL-3.0-or-later
import { Global, Module } from "@nestjs/common";

import { AuditoriaInterceptor } from "./auditoria.interceptor";
import { AuditoriaService } from "./auditoria.service";

/**
 * Trilha de auditoria (RN-05).
 *
 * `@Global` e sem importar nada, pela mesma razão do `EmailModule`: auditoria
 * é infraestrutura, e um módulo que não importa ninguém pode ser consumido
 * por qualquer um sem fechar ciclo. Foi a lição do #85, em que a porta de
 * e-mail nasceu dentro de `notificacoes` e o segundo consumidor revelou a
 * dependência circular — corrigida com módulo próprio e **não** com
 * `forwardRef`, que calaria o sintoma mantendo o acoplamento.
 *
 * O interceptor **não** é registrado como `APP_INTERCEPTOR` global de
 * propósito: ele é barato, mas aplicá-lo a todas as rotas faria o `Reflector`
 * procurar metadado em cada requisição pública do site. Ele é declarado nos
 * controladores de gestão, que são as rotas que a RN-05 alcança.
 */
@Global()
@Module({
  providers: [AuditoriaService, AuditoriaInterceptor],
  exports: [AuditoriaService, AuditoriaInterceptor],
})
export class AuditoriaModule {}
