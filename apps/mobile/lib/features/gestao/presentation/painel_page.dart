// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/formato.dart";
import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/brand_bar.dart";
import "../../../core/widgets/rally_chip.dart";
import "../../../core/widgets/secao.dart";
import "../domain/painel.dart";
import "gestao_providers.dart";

/// Painel do dono: ocupação, receita e próximos jogos (RF-22).
class PainelPage extends ConsumerStatefulWidget {
  const PainelPage({super.key, required this.estabelecimentoId});

  final String estabelecimentoId;

  @override
  ConsumerState<PainelPage> createState() => _PainelPageState();
}

class _PainelPageState extends ConsumerState<PainelPage> {
  static const _periodos = [
    (dias: 7, rotulo: "7 dias"),
    (dias: 30, rotulo: "30 dias"),
    (dias: 90, rotulo: "90 dias"),
  ];

  int _dias = 7;

  ({String estabelecimentoId, int dias}) get _chave =>
      (estabelecimentoId: widget.estabelecimentoId, dias: _dias);

  @override
  Widget build(BuildContext context) {
    final painel = ref.watch(painelProvider(_chave));

    return Scaffold(
      body: RefreshIndicator(
        color: AppColors.coral,
        onRefresh: () async => ref.invalidate(painelProvider(_chave)),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            HeaderCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      BotaoVoltarCircular(onTap: () => context.pop()),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: BrandBar(
                          rotuloDireita: "Gestão",
                          sufixo: "· painel",
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text("Painel", style: AppText.titulo(24)),
                  const SizedBox(height: 3),
                  Text(
                    "Como está indo a arena",
                    style: AppText.corpo(
                      13,
                      cor: AppColors.gray,
                      peso: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Rola na horizontal como os chips da Home: três rótulos
                  // juntos não cabem em tela estreita com fonte ampliada.
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (final p in _periodos) ...[
                          RallyChip(
                            rotulo: p.rotulo,
                            ativo: _dias == p.dias,
                            onTap: () => setState(() => _dias = p.dias),
                          ),
                          const SizedBox(width: 8),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: painel.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.coral),
                  ),
                ),
                error: (erro, _) => EstadoErro(
                  mensagem: erro.toString(),
                  onTentarDeNovo: () => ref.invalidate(painelProvider(_chave)),
                ),
                data: _conteudo,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _conteudo(Painel painel) {
    if (painel.vazio) {
      return const EstadoVazio(
        titulo: "Nenhum movimento no período",
        descricao:
            "Quando entrarem reservas, os números e os próximos jogos aparecem aqui.",
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _receita(painel.receita),
        const SizedBox(height: 14),
        _numeros(painel),
        const SizedBox(height: 22),
        const CabecalhoSecao(titulo: "Por quadra"),
        const SizedBox(height: 12),
        if (painel.quadras.isEmpty)
          Text(
            "Nenhuma quadra ativa.",
            style: AppText.corpo(13, cor: AppColors.gray),
          )
        else
          for (final q in painel.quadras) ...[
            _LinhaQuadra(quadra: q),
            const SizedBox(height: 10),
          ],
        const SizedBox(height: 12),
        const CabecalhoSecao(titulo: "Próximos jogos"),
        const SizedBox(height: 12),
        if (painel.proximosJogos.isEmpty)
          Text(
            "Nada agendado daqui para frente.",
            style: AppText.corpo(13, cor: AppColors.gray),
          )
        else
          for (final jogo in painel.proximosJogos) ...[
            _LinhaJogo(jogo: jogo),
            const SizedBox(height: 10),
          ],
      ],
    );
  }

  /// O card do dinheiro. Caixa e a receber ficam **separados**: juntos, um
  /// Pix pendente pareceria dinheiro que já entrou.
  Widget _receita(ReceitaPainel receita) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.ink,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("RECEBIDO NO PERÍODO",
              style: AppText.rotulo(10, cor: AppColors.onInkMuted)),
          const SizedBox(height: 6),
          Text(
            Formato.moeda(receita.paga),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.titulo(30, cor: AppColors.white),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _parDoCard("A receber", Formato.moeda(receita.aReceber)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _parDoCard(
                  "Ticket médio",
                  receita.ticketMedio == null
                      ? "—"
                      : Formato.moeda(receita.ticketMedio!),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _parDoCard(String rotulo, String valor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          rotulo.toUpperCase(),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppText.rotulo(9, cor: AppColors.onInkMuted),
        ),
        const SizedBox(height: 3),
        Text(
          valor,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppText.titulo(16, cor: AppColors.white),
        ),
      ],
    );
  }

  Widget _numeros(Painel painel) {
    return Row(
      children: [
        Expanded(
          child: _Metrica(
            valor: painel.ocupacao.percentual == null
                ? "—"
                : "${_semZeroAtoa(painel.ocupacao.percentual!)}%",
            rotulo: "ocupação",
            // Sem horário de funcionamento não há denominador; dizer "0%"
            // afirmaria que a arena está vazia.
            apoio: painel.ocupacao.percentual == null
                ? "sem horário cadastrado"
                : "${_semZeroAtoa(painel.ocupacao.horasVendidas)}h de "
                    "${_semZeroAtoa(painel.ocupacao.horasDisponiveis)}h",
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _Metrica(
            valor: "${painel.contagem.vendidas}",
            rotulo: "reservas",
            apoio: painel.contagem.bloqueios == 0
                ? null
                : "${painel.contagem.bloqueios} bloqueio"
                    "${painel.contagem.bloqueios > 1 ? "s" : ""}",
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _Metrica(
            valor: painel.contagem.taxaCancelamento == null
                ? "—"
                : "${_semZeroAtoa(painel.contagem.taxaCancelamento!)}%",
            rotulo: "cancelamento",
            apoio: painel.contagem.canceladas == 0
                ? null
                : "${painel.contagem.canceladas} cancelada"
                    "${painel.contagem.canceladas > 1 ? "s" : ""}",
          ),
        ),
      ],
    );
  }
}

/// "14" em vez de "14.0"; "14,3" em vez de "14.3".
String _semZeroAtoa(double valor) {
  final texto =
      valor % 1 == 0 ? valor.toStringAsFixed(0) : valor.toStringAsFixed(1);
  return texto.replaceAll(".", ",");
}

class _Metrica extends StatelessWidget {
  const _Metrica({required this.valor, required this.rotulo, this.apoio});

  final String valor;
  final String rotulo;
  final String? apoio;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            valor,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.titulo(20),
          ),
          const SizedBox(height: 3),
          Text(
            rotulo.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.rotulo(9),
          ),
          if (apoio != null) ...[
            const SizedBox(height: 3),
            Text(
              apoio!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.corpo(10, cor: AppColors.gray),
            ),
          ],
        ],
      ),
    );
  }
}

class _LinhaQuadra extends StatelessWidget {
  const _LinhaQuadra({required this.quadra});

  final QuadraNoPainel quadra;

  @override
  Widget build(BuildContext context) {
    final parado = quadra.reservas == 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  quadra.nome,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.titulo(15),
                ),
                const SizedBox(height: 3),
                Text(
                  parado
                      // Quadra parada é o achado que o dono precisa ver, e
                      // por isso ela aparece em vez de sumir da lista.
                      ? "Nenhuma reserva no período"
                      : "${quadra.reservas} reserva"
                          "${quadra.reservas > 1 ? "s" : ""}"
                          "${quadra.ocupacao == null ? "" : " · ${_semZeroAtoa(quadra.ocupacao!)}% de ocupação"}",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.corpo(12, cor: AppColors.gray),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            Formato.moeda(quadra.receita),
            style: AppText.titulo(15,
                cor: parado ? AppColors.gray : AppColors.ink),
          ),
        ],
      ),
    );
  }
}

class _LinhaJogo extends StatelessWidget {
  const _LinhaJogo({required this.jogo});

  final ProximoJogo jogo;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(jogo.horaInicio, style: AppText.titulo(15)),
              const SizedBox(height: 2),
              Text(Formato.diaCurto(jogo.inicio), style: AppText.rotulo(9)),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  jogo.clienteNome ?? "Reserva de balcão",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.corpo(14, peso: FontWeight.w600),
                ),
                const SizedBox(height: 3),
                Text(
                  jogo.quadraNome,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.corpo(12, cor: AppColors.gray),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              color: jogo.pago ? AppColors.sand : AppColors.coralSoft,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              jogo.pago ? "PAGO" : "A PAGAR",
              style: AppText.rotulo(
                9,
                cor: jogo.pago ? AppColors.ink : AppColors.coralDeep,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
