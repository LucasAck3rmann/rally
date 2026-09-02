// SPDX-License-Identifier: AGPL-3.0-or-later
import { Controller, Get } from "@nestjs/common";

import { PromocoesService } from "./promocoes.service";

@Controller("promocoes")
export class PromocoesController {
  constructor(private readonly promocoes: PromocoesService) {}

  @Get("destaque")
  destaque() {
    return this.promocoes.destaque();
  }
}
