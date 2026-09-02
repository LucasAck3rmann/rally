import "dart:async";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/brand_bar.dart";
import "../../../core/widgets/marquee.dart";
import "../../../core/widgets/rally_chip.dart";
import "../../../core/widgets/rally_icon.dart";
import "../../../core/widgets/secao.dart";
import "../../auth/presentation/auth_controller.dart";
import "../../promocoes/domain/promocao.dart";
import "../../quadras/domain/quadra.dart";
import "../../quadras/presentation/quadra_card.dart";
import "../../quadras/presentation/quadras_providers.dart";

/// Home do cliente: busca, filtro por modalidade, vitrine de quadras e promoção.
class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  static const _modalidades = ["Beach Tennis", "Futevôlei", "Vôlei"];

  final _busca = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _busca.dispose();
    super.dispose();
  }

  void _aoDigitar(String texto) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      ref.read(buscaProvider.notifier).state = texto.trim();
    });
  }

  @override
  Widget build(BuildContext context) {
    final quadras = ref.watch(quadrasProvider);
    final promocao = ref.watch(promocaoDestaqueProvider);
    final usuario = ref.watch(authControllerProvider).valueOrNull;
    final modalidade = ref.watch(modalidadeFiltroProvider);

    return Column(
      children: [
        MarqueeMarca(
          texto: _textoMarquee(quadras.valueOrNull),
        ),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.coral,
            onRefresh: () async {
              ref.invalidate(quadrasProvider);
              ref.invalidate(promocaoDestaqueProvider);
            },
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                HeaderCard(
                  aplicarAreaSegura: false,
                  paddingTop: 26,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const BrandBar(rotuloDireita: "Sapiranga/RS"),
                      const SizedBox(height: 18),
                      _saudacao(usuario?.nome ?? "Jogador"),
                      const SizedBox(height: 18),
                      _campoBusca(),
                      const SizedBox(height: 18),
                      _chips(modalidade),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CabecalhoSecao(
                        titulo: "Quadras perto de você",
                        acao: modalidade == null ? null : "Ver todas",
                        onAcao: () =>
                            ref.read(modalidadeFiltroProvider.notifier).state = null,
                      ),
                      const SizedBox(height: 14),
                      _vitrine(quadras),
                      const SizedBox(height: 14),
                      promocao.maybeWhen(
                        data: (p) => p == null
                            ? const SizedBox.shrink()
                            : _CardPromo(promocao: p),
                        orElse: () => const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _textoMarquee(List<Quadra>? quadras) {
    final aoVivo = quadras?.where((q) => q.aoVivo).length ?? 0;
    final chamada = aoVivo > 0
        ? "$aoVivo ${aoVivo == 1 ? "quadra jogando" : "quadras jogando"} agora"
        : "quadras livres agora";
    return "● ao vivo · $chamada · reserve a sua · bora pra areia · ";
  }

  Widget _saudacao(String nome) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("BORA JOGAR,", style: AppText.rotulo(13, espacamento: 0.5)),
              const SizedBox(height: 2),
              Text(
                nome,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.titulo(20),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        _Avatar(nome: nome),
      ],
    );
  }

  Widget _campoBusca() {
    return TextField(
      controller: _busca,
      onChanged: _aoDigitar,
      textInputAction: TextInputAction.search,
      style: AppText.corpo(14),
      decoration: InputDecoration(
        hintText: "Buscar quadra, modalidade, bairro...",
        hintStyle: AppText.corpo(14, cor: AppColors.gray),
        filled: true,
        fillColor: AppColors.bg,
        prefixIcon: const Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 10, 0),
          child: RallyIcon("busca", tamanho: 18, cor: AppColors.gray),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
        border: _borda(AppColors.line),
        enabledBorder: _borda(AppColors.line),
        focusedBorder: _borda(AppColors.coral, largura: 2),
      ),
    );
  }

  OutlineInputBorder _borda(Color cor, {double largura = 1}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(color: cor, width: largura),
    );
  }

  Widget _chips(String? selecionada) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final m in _modalidades) ...[
            RallyChip(
              rotulo: m,
              ativo: selecionada == m,
              // Tocar de novo no chip ativo limpa o filtro.
              onTap: () => ref.read(modalidadeFiltroProvider.notifier).state =
                  selecionada == m ? null : m,
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  Widget _vitrine(AsyncValue<List<Quadra>> quadras) {
    return quadras.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Center(
          child: CircularProgressIndicator(color: AppColors.coral),
        ),
      ),
      error: (erro, _) => EstadoErro(
        mensagem: erro.toString(),
        onTentarDeNovo: () => ref.invalidate(quadrasProvider),
      ),
      data: (lista) {
        if (lista.isEmpty) {
          return const EstadoVazio(
            titulo: "Nenhuma quadra por aqui",
            descricao: "Tente outra modalidade ou limpe a busca.",
          );
        }
        return Column(
          children: [
            for (final quadra in lista) ...[
              QuadraCard(
                quadra: quadra,
                onReservar: () => context.push("/quadras/${quadra.id}"),
              ),
              const SizedBox(height: 14),
            ],
          ],
        );
      },
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.nome});

  final String nome;

  /// Iniciais do nome ("Lucas Ackermann" → "LA").
  String get _iniciais {
    final partes = nome.trim().split(RegExp(r"\s+"));
    if (partes.isEmpty || partes.first.isEmpty) return "?";
    if (partes.length == 1) return partes.first[0].toUpperCase();
    return (partes.first[0] + partes.last[0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 46,
      height: 46,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: AppColors.ink,
        shape: BoxShape.circle,
      ),
      child: Text(_iniciais, style: AppText.titulo(15, cor: AppColors.white)),
    );
  }
}

class _CardPromo extends StatelessWidget {
  const _CardPromo({required this.promocao});

  final PromocaoDestaque promocao;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: AppColors.ink,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  promocao.titulo,
                  style: AppText.titulo(15, cor: AppColors.white),
                ),
                const SizedBox(height: 3),
                Text(
                  promocao.chamada,
                  style: AppText.corpo(
                    12,
                    cor: AppColors.onInkMuted,
                    peso: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.sun,
              shape: BoxShape.circle,
            ),
            child: Text(promocao.selo, style: AppText.titulo(20)),
          ),
        ],
      ),
    );
  }
}
