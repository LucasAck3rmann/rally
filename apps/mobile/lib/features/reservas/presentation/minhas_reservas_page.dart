import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/brand_bar.dart";
import "../../../core/formato.dart";
import "../../../core/widgets/secao.dart";
import "../domain/reserva.dart";
import "remarcar_sheet.dart";
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

class _CardReserva extends ConsumerStatefulWidget {
  const _CardReserva({required this.reserva});

  final Reserva reserva;

  @override
  ConsumerState<_CardReserva> createState() => _CardReservaState();
}

class _CardReservaState extends ConsumerState<_CardReserva> {
  bool _cancelando = false;

  Reserva get reserva => widget.reserva;

  /// Pergunta antes de cancelar, dizendo com todas as letras o que a política
  /// do estabelecimento (RN-02) implica neste horário — dentro do prazo o
  /// horário só volta a ficar livre; fora dele, o valor não volta.
  Future<void> _confirmarCancelamento() async {
    final gratuito = reserva.cancelamentoGratuito;
    final horas = reserva.cancelamentoHoras;

    final confirmou = await showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        backgroundColor: AppColors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
        ),
        title: Text("Cancelar reserva?", style: AppText.titulo(18)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "${reserva.estabelecimentoNome} · "
              "${Formato.diaCurto(reserva.inicio)}, ${reserva.faixaHoraria}",
              style: AppText.corpo(14, peso: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            Text(
              gratuito
                  ? "Você está dentro do prazo de $horas h. O horário volta a "
                      "ficar livre para outras pessoas."
                  : "Fora do prazo de $horas h: o horário é liberado, mas o "
                      "valor não é devolvido.",
              style: AppText.corpo(
                13,
                cor: gratuito ? AppColors.gray : AppColors.coralDeep,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogo).pop(false),
            child: Text(
              "Manter",
              style: AppText.corpo(14, peso: FontWeight.w600),
            ),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogo).pop(true),
            style: FilledButton.styleFrom(
              minimumSize: const Size(0, 44),
              padding: const EdgeInsets.symmetric(horizontal: 18),
            ),
            child: const Text("Cancelar reserva"),
          ),
        ],
      ),
    );

    if (confirmou != true || !mounted) return;
    await _cancelar();
  }

  Future<void> _cancelar() async {
    setState(() => _cancelando = true);
    try {
      final resultado = await ref
          .read(reservasRepositoryProvider)
          .cancelar(reserva.id);
      if (!mounted) return;
      // A lista se refaz sozinha; este card sai de cena com ela.
      ref.invalidate(minhasReservasProvider);
      _aviso(
        resultado.dentroDoPrazo
            ? "Reserva cancelada dentro do prazo."
            : "Reserva cancelada fora do prazo — sem devolução do valor.",
      );
    } catch (erro) {
      if (!mounted) return;
      setState(() => _cancelando = false);
      _aviso(erro.toString());
    }
  }

  void _aviso(String mensagem) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(backgroundColor: AppColors.ink, content: Text(mensagem)),
      );
  }

  @override
  Widget build(BuildContext context) {
    final aguardando = reserva.status == ReservaStatus.pendentePagamento;

    return Material(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => context.push(
                aguardando
                    ? "/reservas/${reserva.id}/pagamento"
                    : "/reservas/${reserva.id}/confirmacao",
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 10, 14, 10),
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
            if (reserva.cancelavel) _rodapeAcoes(),
          ],
        ),
      ),
    );
  }

  /// Abre a folha de remarcação; o aviso de sucesso fica aqui porque a folha
  /// se fecha antes de poder mostrá-lo.
  Future<void> _remarcar() async {
    final moveu = await FolhaRemarcar.abrir(context, reserva);
    if (moveu == true && mounted) {
      _aviso("Reserva remarcada.");
    }
  }

  Widget _rodapeAcoes() {
    // Remarcar só aparece dentro do prazo, pela mesma razão que a API recusa
    // fora dele: senão bastava empurrar a reserva para longe e cancelar
    // de graça depois, e a janela da RN-02 não valeria nada.
    final podeRemarcar = reserva.cancelamentoGratuito;

    return Column(
      children: [
        const Divider(height: 1, thickness: 1, color: AppColors.line),
        Row(
          children: [
            if (podeRemarcar) ...[
              Expanded(child: _acaoRemarcar()),
              Container(width: 1, height: 26, color: AppColors.line),
            ],
            Expanded(child: _acaoCancelar()),
          ],
        ),
      ],
    );
  }

  Widget _acaoRemarcar() {
    return TextButton(
      onPressed: _cancelando ? null : _remarcar,
      style: TextButton.styleFrom(
        // Alvo de toque de 44px, como pede o DESIGN.md.
        minimumSize: const Size.fromHeight(44),
      ),
      child: Text(
        "Remarcar",
        style: AppText.corpo(13, peso: FontWeight.w600),
      ),
    );
  }

  Widget _acaoCancelar() {
    return TextButton(
      onPressed: _cancelando ? null : _confirmarCancelamento,
      style: TextButton.styleFrom(
        minimumSize: const Size.fromHeight(44),
      ),
      child: _cancelando
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.coralDeep,
              ),
            )
          : Text(
              reserva.cancelamentoGratuito
                  ? "Cancelar reserva"
                  : "Cancelar (fora do prazo)",
              style: AppText.corpo(
                13,
                cor: AppColors.coralDeep,
                peso: FontWeight.w600,
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
