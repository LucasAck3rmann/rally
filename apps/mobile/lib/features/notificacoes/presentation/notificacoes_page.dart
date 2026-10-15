// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/formato.dart";
import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/brand_bar.dart";
import "../../../core/widgets/rally_icon.dart";
import "../../../core/widgets/secao.dart";
import "../domain/notificacao.dart";
import "notificacoes_providers.dart";

/// Caixa de avisos do cliente (RF-16), agrupada como no Figma: Hoje, Esta
/// semana e Antes. As não lidas ficam marcadas até serem tocadas.
class NotificacoesPage extends ConsumerWidget {
  const NotificacoesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final caixa = ref.watch(caixaDeAvisosProvider);

    return Scaffold(
      body: RefreshIndicator(
        color: AppColors.coral,
        onRefresh: () async => ref.invalidate(caixaDeAvisosProvider),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            HeaderCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const BrandBar(rotuloDireita: "Notificações"),
                  const SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Avisos", style: AppText.titulo(24)),
                            const SizedBox(height: 3),
                            Text(
                              _resumo(caixa.valueOrNull),
                              style: AppText.corpo(
                                13,
                                cor: AppColors.gray,
                                peso: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if ((caixa.valueOrNull?.naoLidas ?? 0) > 0)
                        TextButton(
                          onPressed: () => _lerTodas(context, ref),
                          style: TextButton.styleFrom(
                            minimumSize: const Size(44, 44),
                          ),
                          child: Text(
                            "Marcar lidas",
                            style: AppText.corpo(
                              13,
                              cor: AppColors.coralDeep,
                              peso: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: caixa.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.coral),
                  ),
                ),
                error: (erro, _) => EstadoErro(
                  mensagem: erro.toString(),
                  onTentarDeNovo: () => ref.invalidate(caixaDeAvisosProvider),
                ),
                data: (dados) => _lista(dados),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _resumo(CaixaDeAvisos? caixa) {
    if (caixa == null) return "Carregando";
    if (caixa.naoLidas == 0) return "Tudo em dia por aqui";
    return caixa.naoLidas == 1
        ? "1 aviso não lido"
        : "${caixa.naoLidas} avisos não lidos";
  }

  Future<void> _lerTodas(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(notificacoesRepositoryProvider).lerTodas();
      ref.invalidate(caixaDeAvisosProvider);
    } catch (erro) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: AppColors.ink,
            content: Text(erro.toString()),
          ),
        );
    }
  }

  Widget _lista(CaixaDeAvisos caixa) {
    if (caixa.itens.isEmpty) {
      return const EstadoVazio(
        titulo: "Nenhum aviso ainda",
        descricao: "Quando uma reserva for confirmada, o aviso aparece aqui.",
      );
    }

    final grupos = _agrupar(caixa.itens);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final grupo in grupos.entries) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 10, top: 4),
            child: Text(grupo.key.toUpperCase(), style: AppText.rotulo(11)),
          ),
          for (final aviso in grupo.value) ...[
            _CartaoAviso(aviso: aviso),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 8),
        ],
      ],
    );
  }

  /// Hoje · Esta semana · Antes, na ordem em que a lista já vem (mais novo
  /// primeiro). Um `LinkedHashMap` preserva essa ordem.
  Map<String, List<Notificacao>> _agrupar(List<Notificacao> itens) {
    final agora = DateTime.now();
    final hoje = DateTime(agora.year, agora.month, agora.day);
    final semana = hoje.subtract(const Duration(days: 7));

    final grupos = <String, List<Notificacao>>{};
    for (final aviso in itens) {
      final chave = !aviso.criadaEm.isBefore(hoje)
          ? "Hoje"
          : !aviso.criadaEm.isBefore(semana)
              ? "Esta semana"
              : "Antes";
      grupos.putIfAbsent(chave, () => []).add(aviso);
    }
    return grupos;
  }
}

class _CartaoAviso extends ConsumerWidget {
  const _CartaoAviso({required this.aviso});

  final Notificacao aviso;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Material(
      color: aviso.lida ? AppColors.white : AppColors.sand,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _abrir(context, ref),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.white,
                  shape: BoxShape.circle,
                ),
                child: RallyIcon(aviso.tipo.icone, tamanho: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(aviso.titulo, style: AppText.titulo(15)),
                    const SizedBox(height: 3),
                    Text(
                      aviso.corpo,
                      style: AppText.corpo(13, cor: AppColors.gray),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      Formato.diaCurto(aviso.criadaEm).toUpperCase(),
                      style: AppText.rotulo(10),
                    ),
                  ],
                ),
              ),
              if (!aviso.lida) ...[
                const SizedBox(width: 8),
                Semantics(
                  label: "Não lido",
                  child: Container(
                    width: 9,
                    height: 9,
                    margin: const EdgeInsets.only(top: 5),
                    decoration: const BoxDecoration(
                      color: AppColors.coral,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// Tocar marca como lido e, quando há destino, leva até ele. A marcação é
  /// otimista: se falhar, o aviso continua não lido na próxima carga.
  Future<void> _abrir(BuildContext context, WidgetRef ref) async {
    final destino = aviso.destino;
    if (!aviso.lida) {
      try {
        await ref.read(notificacoesRepositoryProvider).marcarLida(aviso.id);
        ref.invalidate(caixaDeAvisosProvider);
      } catch (_) {
        // Silencioso de propósito: marcar como lido não é o que o cliente
        // pediu ao tocar; ele quer chegar ao destino.
      }
    }
    if (destino != null && context.mounted) {
      context.push(destino);
    }
  }
}
