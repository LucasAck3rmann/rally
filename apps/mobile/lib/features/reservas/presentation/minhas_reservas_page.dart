import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/brand_bar.dart";
import "../../../core/formato.dart";
import "../../../core/widgets/secao.dart";
import "../domain/reserva.dart";
import "reservas_providers.dart";

/// Aba "Reservas": histórico do cliente, com os jogos que ainda vêm no topo.
///
/// Não há frame desta tela no Figma; ela reusa os componentes do sistema
/// (cabeçalho branco, cards com filete e rótulos em Space Mono).
class MinhasReservasPage extends ConsumerWidget {
  const MinhasReservasPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reservas = ref.watch(minhasReservasProvider);

    return RefreshIndicator(
      color: AppColors.coral,
      onRefresh: () async => ref.invalidate(minhasReservasProvider),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          HeaderCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BrandBar(rotuloDireita: "Reservas"),
                const SizedBox(height: 16),
                Text("Minhas reservas", style: AppText.titulo(24)),
                const SizedBox(height: 3),
                Text(
                  "Seus horários confirmados e o que está por vir",
                  style: AppText.corpo(
                    13,
                    cor: AppColors.gray,
                    peso: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: reservas.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.coral),
                ),
              ),
              error: (erro, _) => EstadoErro(
                mensagem: erro.toString(),
                onTentarDeNovo: () => ref.invalidate(minhasReservasProvider),
              ),
              data: (lista) {
                if (lista.isEmpty) {
                  return const EstadoVazio(
                    titulo: "Nenhuma reserva ainda",
                    descricao: "Escolha uma quadra na Home e garanta seu horário.",
                  );
                }
                return Column(
                  children: [
                    for (final reserva in lista) ...[
                      _CardReserva(reserva: reserva),
                      const SizedBox(height: 12),
                    ],
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _CardReserva extends StatelessWidget {
  const _CardReserva({required this.reserva});

  final Reserva reserva;

  @override
  Widget build(BuildContext context) {
    final aguardando = reserva.status == ReservaStatus.pendentePagamento;

    return Material(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push(
          aguardando
              ? "/reservas/${reserva.id}/pagamento"
              : "/reservas/${reserva.id}/confirmacao",
        ),
        child: Container(
          padding: const EdgeInsets.fromLTRB(10, 10, 14, 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 64,
                  height: 64,
                  child: reserva.foto == null
                      ? const ColoredBox(color: AppColors.sand)
                      : Image.network(
                          reserva.foto!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const ColoredBox(color: AppColors.sand),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      reserva.estabelecimentoNome,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.titulo(15),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      "${Formato.diaCurto(reserva.inicio)} · ${reserva.faixaHoraria}"
                          .toUpperCase(),
                      style: AppText.rotulo(11),
                    ),
                    const SizedBox(height: 6),
                    _selo(reserva.status),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                Formato.moeda(reserva.valorAPagar),
                style: AppText.titulo(15),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _selo(ReservaStatus status) {
    final (fundo, texto) = switch (status) {
      ReservaStatus.confirmada => (AppColors.sand, AppColors.ink),
      ReservaStatus.pendentePagamento => (AppColors.sun, AppColors.ink),
      ReservaStatus.cancelada => (AppColors.coralSoft, AppColors.coralDeep),
      _ => (AppColors.line, AppColors.gray),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: fundo,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(status.rotulo.toUpperCase(), style: AppText.rotulo(10, cor: texto)),
    );
  }
}
