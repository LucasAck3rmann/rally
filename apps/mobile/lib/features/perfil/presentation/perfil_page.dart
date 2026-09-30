import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/brand_bar.dart";
import "../../../core/widgets/rally_icon.dart";
import "../../auth/presentation/auth_controller.dart";
import "../../gestao/presentation/gestao_providers.dart";
import "../../replays/presentation/replays_providers.dart";
import "../../reservas/presentation/reservas_providers.dart";

/// Perfil do cliente: identidade, números do jogador e atalhos da conta.
class PerfilPage extends ConsumerWidget {
  const PerfilPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuario = ref.watch(authControllerProvider).valueOrNull;
    final reservas = ref.watch(minhasReservasProvider);
    final replays = ref.watch(meusReplaysProvider);

    // Um cliente comum recebe lista vazia aqui — e a área de gestão
    // simplesmente não aparece para ele.
    final gerencia =
        ref.watch(meusEstabelecimentosProvider).valueOrNull ?? const [];

    final listaReservas = reservas.valueOrNull ?? const [];
    final quadrasDistintas =
        listaReservas.map((r) => r.quadraId).toSet().length;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        HeaderCard(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: BrandBar(rotuloDireita: "", sufixo: "· perfil"),
              ),
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.sand,
                  shape: BoxShape.circle,
                ),
                child: const RallyIcon("ajustes", tamanho: 18),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _identidade(usuario?.nome ?? "Jogador"),
              const SizedBox(height: 16),
              _numeros(
                jogos: listaReservas.length,
                quadras: quadrasDistintas,
                replays: replays.valueOrNull?.length ?? 0,
              ),
              const SizedBox(height: 16),
              _ItemMenu(
                icone: "calendario",
                rotulo: "Minhas reservas",
                onTap: () => context.go("/reservas"),
              ),
              const SizedBox(height: 10),
              _ItemMenu(
                icone: "play-circulo",
                rotulo: "Meus replays",
                onTap: () => context.go("/replays"),
              ),
              if (gerencia.isNotEmpty) ...[
                const SizedBox(height: 10),
                _ItemMenu(
                  icone: "ajustes",
                  rotulo: "Gerenciar quadras",
                  onTap: () => context.push("/gestao"),
                ),
              ],
              const SizedBox(height: 10),
              const _ItemMenu(icone: "pagamentos", rotulo: "Pagamentos"),
              const SizedBox(height: 10),
              _ItemMenu(
                icone: "sino",
                rotulo: "Notificações",
                onTap: () => context.push("/notificacoes"),
              ),
              const SizedBox(height: 10),
              const _ItemMenu(icone: "ajuda", rotulo: "Ajuda"),
              const SizedBox(height: 10),
              _ItemMenu(
                icone: "sair",
                rotulo: "Sair",
                destrutivo: true,
                onTap: () => ref.read(authControllerProvider.notifier).logout(),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _identidade(String nome) {
    final partes =
        nome.trim().split(RegExp(r"\s+")).where((p) => p.isNotEmpty).toList();
    final iniciais = switch (partes.length) {
      0 => "?",
      1 => partes.first[0].toUpperCase(),
      _ => (partes.first[0] + partes.last[0]).toUpperCase(),
    };

    return Row(
      children: [
        Container(
          width: 60,
          height: 60,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: AppColors.coral,
            shape: BoxShape.circle,
          ),
          child: Text(iniciais, style: AppText.titulo(22)),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                nome,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.titulo(19),
              ),
              const SizedBox(height: 4),
              Text("JOGADOR RALLY", style: AppText.rotulo(10)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _numeros({
    required int jogos,
    required int quadras,
    required int replays,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 18),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          _numero(jogos, "jogos"),
          _numero(quadras, "quadras"),
          _numero(replays, "replays"),
        ],
      ),
    );
  }

  Widget _numero(int valor, String rotulo) {
    return Expanded(
      child: Column(
        children: [
          Text("$valor", style: AppText.titulo(22)),
          const SizedBox(height: 4),
          Text(rotulo.toUpperCase(), style: AppText.rotulo(9)),
        ],
      ),
    );
  }
}

class _ItemMenu extends StatelessWidget {
  const _ItemMenu({
    required this.icone,
    required this.rotulo,
    this.onTap,
    this.destrutivo = false,
  });

  final String icone;
  final String rotulo;
  final VoidCallback? onTap;
  final bool destrutivo;

  @override
  Widget build(BuildContext context) {
    final cor = destrutivo ? AppColors.coralDeep : AppColors.ink;

    return Opacity(
      // Itens sem destino ainda (Pagamentos, Ajuda) ficam
      // visivelmente inativos em vez de responder a um toque sem efeito.
      opacity: onTap == null ? 0.6 : 1,
      child: Material(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.line),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: destrutivo ? AppColors.coralSoft : AppColors.sand,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: RallyIcon(icone, tamanho: 18, cor: cor),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    rotulo,
                    style: AppText.corpo(15, cor: cor, peso: FontWeight.w600),
                  ),
                ),
                if (!destrutivo)
                  const RallyIcon("chevron", tamanho: 18, cor: AppColors.gray),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
