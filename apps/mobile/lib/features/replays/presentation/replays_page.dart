import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:share_plus/share_plus.dart";
import "package:url_launcher/url_launcher.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/brand_bar.dart";
import "../../../core/formato.dart";
import "../../../core/widgets/rally_chip.dart";
import "../../../core/widgets/rally_icon.dart";
import "../../../core/widgets/secao.dart";
import "../domain/replay.dart";
import "replays_providers.dart";

/// Replays do cliente — o diferencial do Rally: reveja e compartilhe os lances.
class ReplaysPage extends ConsumerWidget {
  const ReplaysPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final replays = ref.watch(meusReplaysProvider);
    final periodo = ref.watch(periodoReplayProvider);

    return RefreshIndicator(
      color: AppColors.coral,
      onRefresh: () async => ref.invalidate(meusReplaysProvider),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          HeaderCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BrandBar(rotuloDireita: "Replays"),
                const SizedBox(height: 16),
                Text("Replays", style: AppText.titulo(24)),
                const SizedBox(height: 3),
                Text(
                  "Reviva e compartilhe seus melhores pontos",
                  style: AppText.corpo(
                    13,
                    cor: AppColors.gray,
                    peso: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    for (final p in PeriodoReplay.values) ...[
                      RallyChip(
                        rotulo: p.rotulo,
                        ativo: periodo == p,
                        onTap: () =>
                            ref.read(periodoReplayProvider.notifier).state = p,
                      ),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: replays.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.coral),
                ),
              ),
              error: (erro, _) => EstadoErro(
                mensagem: erro.toString(),
                onTentarDeNovo: () => ref.invalidate(meusReplaysProvider),
              ),
              data: (lista) => _lista(lista),
            ),
          ),
        ],
      ),
    );
  }

  Widget _lista(List<Replay> replays) {
    if (replays.isEmpty) {
      return const EstadoVazio(
        titulo: "Nenhum replay ainda",
        descricao:
            "Seus melhores pontos aparecem aqui depois do jogo nas quadras com câmera.",
      );
    }

    final destaque = replays.first;
    final demais = replays.skip(1).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Destaque da semana", style: AppText.titulo(17)),
        const SizedBox(height: 14),
        _Destaque(replay: destaque),
        if (demais.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text("Seus replays", style: AppText.titulo(17)),
          const SizedBox(height: 14),
          for (final replay in demais) ...[
            _Linha(replay: replay),
            const SizedBox(height: 14),
          ],
        ],
      ],
    );
  }
}

/// Abre o arquivo do clipe no navegador/player do sistema, de onde o usuário
/// salva o vídeo. O download dentro do app entra junto com o player (fase 2).
Future<void> _baixar(Replay replay) {
  return launchUrl(Uri.parse(replay.url!),
      mode: LaunchMode.externalApplication);
}

/// Compartilha o clipe (link do replay quando já processado).
Future<void> _compartilhar(Replay replay) {
  final texto = replay.url == null
      ? "Olha esse lance no Rally: ${replay.titulo}"
      : "Olha esse lance no Rally: ${replay.titulo} — ${replay.url}";
  return Share.share(texto, subject: "Replay no Rally");
}

class _Destaque extends StatelessWidget {
  const _Destaque({required this.replay});

  final Replay replay;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 200,
            width: double.infinity,
            child: Stack(
              fit: StackFit.expand,
              children: [
                _Miniatura(url: replay.thumbUrl),
                const Center(child: _BotaoPlay(tamanho: 58, icone: 24.36)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        replay.titulo,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.titulo(16),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.coral,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        "NOVO",
                        style: AppText.corpo(10, peso: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const RallyIcon("local", tamanho: 15, cor: AppColors.gray),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        _meta(replay),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.rotulo(12, espacamento: 0.2),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _AcaoAreia(
                      icone: "compartilhar",
                      rotulo: "Compartilhar",
                      onTap: () => _compartilhar(replay),
                    ),
                    const SizedBox(width: 10),
                    _AcaoAreia(
                      icone: "baixar",
                      rotulo: "Baixar",
                      onTap: replay.url == null ? null : () => _baixar(replay),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _meta(Replay replay) {
    final partes = [
      replay.estabelecimento,
      Formato.diaCurto(replay.criadoEm),
      if (replay.duracaoSeg != null) Formato.duracao(replay.duracaoSeg!),
    ];
    return partes.join(" · ");
  }
}

class _Linha extends StatelessWidget {
  const _Linha({required this.replay});

  final Replay replay;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 10, 12, 10),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 7,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 70,
              height: 70,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _Miniatura(url: replay.thumbUrl),
                  const Center(child: _BotaoPlay(tamanho: 30, icone: 12.6)),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  replay.titulo,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.titulo(14),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const RallyIcon("relogio",
                        tamanho: 14, cor: AppColors.gray),
                    const SizedBox(width: 5),
                    Flexible(
                      child: Text(
                        [
                          Formato.diaCurto(replay.criadoEm),
                          if (replay.duracaoSeg != null)
                            Formato.duracao(replay.duracaoSeg!),
                        ].join(" · "),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.rotulo(12, espacamento: 0.2),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            tooltip: "Compartilhar",
            onPressed: () => _compartilhar(replay),
            icon: const RallyIcon("compartilhar",
                tamanho: 20, cor: AppColors.ink),
          ),
        ],
      ),
    );
  }
}

class _Miniatura extends StatelessWidget {
  const _Miniatura({required this.url});

  final String? url;

  @override
  Widget build(BuildContext context) {
    if (url == null) return const ColoredBox(color: AppColors.sand);
    return Image.network(
      url!,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.sand),
    );
  }
}

class _BotaoPlay extends StatelessWidget {
  const _BotaoPlay({required this.tamanho, required this.icone});

  final double tamanho;

  /// Lado do triângulo de play dentro do círculo.
  final double icone;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: tamanho,
      height: tamanho,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: AppColors.white,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Color(0x2E000000),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: RallyIcon("play", tamanho: icone, cor: null),
    );
  }
}

class _AcaoAreia extends StatelessWidget {
  const _AcaoAreia({
    required this.icone,
    required this.rotulo,
    required this.onTap,
  });

  final String icone;
  final String rotulo;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null ? 0.5 : 1,
      child: Material(
        color: AppColors.sand,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            height: 44,
            alignment: Alignment.center,
            padding: const EdgeInsets.fromLTRB(14, 0, 16, 0),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                RallyIcon(icone, tamanho: 18),
                const SizedBox(width: 7),
                Text(rotulo, style: AppText.corpo(13, peso: FontWeight.w600)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
