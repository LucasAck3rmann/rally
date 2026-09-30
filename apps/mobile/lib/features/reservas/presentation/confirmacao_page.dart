import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";
import "package:share_plus/share_plus.dart";
import "package:url_launcher/url_launcher.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/barra_inferior.dart";
import "../../../core/widgets/confete.dart";
import "../../../core/formato.dart";
import "../../../core/widgets/rally_icon.dart";
import "../../../core/widgets/secao.dart";
import "../domain/reserva.dart";
import "reservas_providers.dart";

/// Comprovante da reserva paga — fecha o fluxo "do agendamento ao jogo".
class ConfirmacaoPage extends ConsumerWidget {
  const ConfirmacaoPage({super.key, required this.reservaId});

  final String reservaId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reserva = ref.watch(reservaProvider(reservaId));

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: reserva.when(
          loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.coral),
          ),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(24),
            child: EstadoErro(
              mensagem: erro.toString(),
              onTentarDeNovo: () => ref.invalidate(reservaProvider(reservaId)),
            ),
          ),
          data: (r) => _conteudo(context, r),
        ),
      ),
    );
  }

  Widget _conteudo(BuildContext context, Reserva reserva) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        // 210px era a altura do desenho; com o texto do sistema ampliado o
        // "Reserva confirmada!" passa disso. Vira **mínimo**: a pilha se
        // ajusta ao conteúdo e o confete acompanha, porque é `Positioned.fill`.
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 210),
          child: Stack(
            children: [
              const Positioned.fill(child: ConfeteConfirmacao()),
              Padding(
                padding: const EdgeInsets.only(top: 30),
                child: Column(
                  children: [
                    Container(
                      width: 88,
                      height: 88,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        color: AppColors.coral,
                        shape: BoxShape.circle,
                      ),
                      child: const RallyIcon("check-grande", tamanho: 44),
                    ),
                    const SizedBox(height: 14),
                    Text("Reserva confirmada!", style: AppText.titulo(26)),
                    const SizedBox(height: 14),
                    Text(
                      "PAGAMENTO APROVADO · ${reserva.pagamento?.metodo ?? "PIX"}",
                      style: AppText.rotulo(11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Column(
            children: [
              _comprovante(reserva),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: BotaoSecundario(
                      rotulo: "Agenda",
                      icone: const RallyIcon("agenda", tamanho: 18),
                      onPressed: () => _adicionarNaAgenda(context, reserva),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: BotaoSecundario(
                      rotulo: "Compartilhar",
                      icone: const RallyIcon("compartilhar", tamanho: 18),
                      onPressed: () => _compartilhar(reserva),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              BotaoPrimario(
                rotulo: "Ver minha reserva",
                onPressed: () => context.go("/reservas"),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => context.go("/"),
                child: Text(
                  "Voltar ao início",
                  style: AppText.corpo(
                    14,
                    cor: AppColors.coralDeep,
                    peso: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _comprovante(Reserva reserva) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          _linha("Quadra", reserva.estabelecimentoNome, destaque: true),
          const SizedBox(height: 13),
          _linha("Data", Formato.diaPorExtenso(reserva.inicio)),
          const SizedBox(height: 13),
          _linha("Horário", reserva.faixaHoraria),
          const SizedBox(height: 13),
          _linha("Valor pago", Formato.moedaExata(reserva.valorAPagar)),
          const SizedBox(height: 13),
          _linha("Código", "#${reserva.codigo}"),
        ],
      ),
    );
  }

  Widget _linha(String rotulo, String valor, {bool destaque = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(rotulo.toUpperCase(), style: AppText.rotulo(10)),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            destaque ? valor : valor.toUpperCase(),
            textAlign: TextAlign.right,
            style: destaque
                ? AppText.titulo(14)
                : AppText.rotulo(11, cor: AppColors.ink),
          ),
        ),
      ],
    );
  }

  String _texto(Reserva reserva) {
    return "Bora jogar! Reservei a ${reserva.estabelecimentoNome} "
        "em ${Formato.diaPorExtenso(reserva.inicio)}, ${reserva.faixaHoraria}. "
        "Código ${reserva.codigo} · Rally";
  }

  Future<void> _compartilhar(Reserva reserva) {
    return Share.share(_texto(reserva), subject: "Minha reserva no Rally");
  }

  /// Abre o compositor de evento do calendário com a reserva preenchida.
  Future<void> _adicionarNaAgenda(BuildContext context, Reserva reserva) async {
    String utc(DateTime quando) => quando
        .toUtc()
        .toIso8601String()
        .replaceAll(RegExp(r"[-:]"), "")
        .split(".")
        .first;

    final url = Uri.https("calendar.google.com", "/calendar/render", {
      "action": "TEMPLATE",
      "text": "Rally · ${reserva.estabelecimentoNome}",
      "dates": "${utc(reserva.inicio)}Z/${utc(reserva.fim)}Z",
      "details": "Reserva ${reserva.codigo} — ${reserva.quadraNome}",
    });

    final abriu = await launchUrl(url, mode: LaunchMode.externalApplication);
    if (!abriu && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.ink,
          content: Text(
            "Não foi possível abrir a agenda.",
            style: AppText.corpo(14, cor: AppColors.white),
          ),
        ),
      );
    }
  }
}
