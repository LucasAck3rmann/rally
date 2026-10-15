// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/formato.dart";
import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/barra_inferior.dart";
import "../../../core/widgets/brand_bar.dart";
import "../../../core/widgets/rally_icon.dart";
import "../../../core/widgets/secao.dart";
import "../domain/gestao.dart";
import "gestao_providers.dart";

/// Gerenciamento de quadras do estabelecimento (RF-20, versão celular).
///
/// A API decide o acesso pelo vínculo (`PapelGuard`); aqui a tela apenas
/// **não oferece** o que o servidor recusaria — pausar e reativar só
/// aparecem para quem é administrador.
class QuadrasGestaoPage extends ConsumerWidget {
  const QuadrasGestaoPage({
    super.key,
    required this.estabelecimentoId,
  });

  final String estabelecimentoId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quadras = ref.watch(quadrasGestaoProvider(estabelecimentoId));
    final estabelecimento = _procurar(
      ref.watch(meusEstabelecimentosProvider).valueOrNull,
    );

    return Scaffold(
      body: RefreshIndicator(
        color: AppColors.coral,
        onRefresh: () async =>
            ref.invalidate(quadrasGestaoProvider(estabelecimentoId)),
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
                          rotuloDireita: "Quadras",
                          sufixo: "· gestão",
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    estabelecimento?.nome ?? "Quadras",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.titulo(24),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _resumo(quadras.valueOrNull, estabelecimento),
                    style: AppText.corpo(
                      13,
                      cor: AppColors.gray,
                      peso: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 14),
                  // Ver o dia é o que o dono faz mais vezes; cadastrar quadra
                  // ele faz uma vez por quadra. A agenda vem antes da lista.
                  Row(
                    children: [
                      Expanded(
                        child: BotaoSecundario(
                          rotulo: "Agenda",
                          icone: const RallyIcon("calendario", tamanho: 18),
                          onPressed: () => context.push(
                            "/gestao/$estabelecimentoId/agenda",
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: BotaoSecundario(
                          rotulo: "Painel",
                          icone: const RallyIcon("pagamentos", tamanho: 18),
                          onPressed: () => context.push(
                            "/gestao/$estabelecimentoId/painel",
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: BotaoSecundario(
                          rotulo: "Equipe",
                          icone: const RallyIcon("nav-perfil", tamanho: 18),
                          onPressed: () => context.push(
                            "/gestao/$estabelecimentoId/equipe",
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
              child: quadras.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.coral),
                  ),
                ),
                error: (erro, _) => EstadoErro(
                  mensagem: erro.toString(),
                  onTentarDeNovo: () =>
                      ref.invalidate(quadrasGestaoProvider(estabelecimentoId)),
                ),
                data: (lista) => _lista(context, lista, estabelecimento),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// O nome e o papel vêm da lista de vínculos, que o Perfil já carregou.
  EstabelecimentoGerido? _procurar(List<EstabelecimentoGerido>? lista) {
    for (final est in lista ?? const <EstabelecimentoGerido>[]) {
      if (est.id == estabelecimentoId) return est;
    }
    return null;
  }

  String _resumo(List<QuadraGestao>? lista, EstabelecimentoGerido? est) {
    if (lista == null) return "Carregando";
    final pausadas = lista.where((q) => !q.ativo).length;
    final total = lista.length;
    final base = total == 1 ? "1 quadra" : "$total quadras";
    if (pausadas == 0) {
      return est == null ? base : "$base · ${est.meuPapel.rotulo}";
    }
    return "$base · $pausadas pausada${pausadas > 1 ? "s" : ""}";
  }

  Widget _lista(
    BuildContext context,
    List<QuadraGestao> lista,
    EstabelecimentoGerido? est,
  ) {
    final podeEditar = est?.meuPapel.podeEditarQuadras ?? false;

    if (lista.isEmpty) {
      return Column(
        children: [
          const EstadoVazio(
            titulo: "Nenhuma quadra cadastrada",
            descricao:
                "Cadastre a primeira quadra para ela aparecer na busca dos jogadores.",
          ),
          if (podeEditar) ...[
            const SizedBox(height: 14),
            BotaoPrimario(
              rotulo: "Cadastrar quadra",
              onPressed: () => context.push(
                "/gestao/$estabelecimentoId/quadras/nova",
              ),
            ),
          ],
        ],
      );
    }

    return Column(
      children: [
        for (final quadra in lista) ...[
          _CardQuadra(
            quadra: quadra,
            estabelecimentoId: estabelecimentoId,
            podeEditar: podeEditar,
          ),
          const SizedBox(height: 12),
        ],
        if (podeEditar) ...[
          const SizedBox(height: 2),
          BotaoPrimario(
            rotulo: "Nova quadra",
            onPressed: () =>
                context.push("/gestao/$estabelecimentoId/quadras/nova"),
          ),
        ],
      ],
    );
  }
}

class _CardQuadra extends ConsumerStatefulWidget {
  const _CardQuadra({
    required this.quadra,
    required this.estabelecimentoId,
    required this.podeEditar,
  });

  final QuadraGestao quadra;
  final String estabelecimentoId;
  final bool podeEditar;

  @override
  ConsumerState<_CardQuadra> createState() => _CardQuadraState();
}

class _CardQuadraState extends ConsumerState<_CardQuadra> {
  bool _salvando = false;

  QuadraGestao get quadra => widget.quadra;

  Future<void> _alternarAtivo() async {
    final vaiAtivar = !quadra.ativo;
    final provedor = quadrasGestaoProvider(widget.estabelecimentoId);
    setState(() => _salvando = true);
    try {
      await ref.read(gestaoRepositoryProvider).definirAtivo(
            widget.estabelecimentoId,
            quadra.id,
            ativo: vaiAtivar,
          );
      if (!mounted) return;
      // Espera a lista voltar do servidor antes de soltar o botão: enquanto
      // o card ainda mostra o estado antigo, um segundo toque desfaria o
      // primeiro sem que o usuário percebesse.
      ref.invalidate(provedor);
      await ref.read(provedor.future);
      if (!mounted) return;
      _aviso(
        vaiAtivar
            ? "${quadra.nome} voltou para a vitrine."
            : "${quadra.nome} saiu da vitrine. O histórico fica.",
      );
    } catch (erro) {
      if (!mounted) return;
      _aviso(erro.toString());
    } finally {
      if (mounted) setState(() => _salvando = false);
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
            // Só administrador abre a edição: para atendente e financeiro o
            // card é leitura, e um toque sem efeito seria pior que nenhum.
            InkWell(
              onTap: widget.podeEditar
                  ? () => context.push(
                        "/gestao/${widget.estabelecimentoId}"
                        "/quadras/${quadra.id}/editar",
                      )
                  : null,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            quadra.nome,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.titulo(16),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            quadra.modalidades.isEmpty
                                ? "Sem modalidade"
                                : quadra.modalidades.join(" · "),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.corpo(13, cor: AppColors.gray),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    _selo(),
                    if (widget.podeEditar) ...[
                      const SizedBox(width: 6),
                      const RallyIcon(
                        "chevron",
                        tamanho: 16,
                        cor: AppColors.gray,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const Divider(height: 1, thickness: 1, color: AppColors.line),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
              child: Row(
                children: [
                  Expanded(child: _preco()),
                  if (widget.podeEditar) _botaoPausar(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _preco() {
    final faixas = quadra.faixasPreco.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "${Formato.moeda(quadra.precoHora)} / hora",
          style: AppText.titulo(15),
        ),
        if (faixas > 0) ...[
          const SizedBox(height: 2),
          Text(
            faixas == 1 ? "1 FAIXA DE PREÇO" : "$faixas FAIXAS DE PREÇO",
            style: AppText.rotulo(10),
          ),
        ],
      ],
    );
  }

  Widget _selo() {
    final (fundo, cor, texto) = quadra.ativo
        ? (AppColors.sand, AppColors.ink, "NA VITRINE")
        : (AppColors.coralSoft, AppColors.coralDeep, "PAUSADA");

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: fundo,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(texto, style: AppText.rotulo(10, cor: cor)),
    );
  }

  Widget _botaoPausar() {
    return TextButton.icon(
      onPressed: _salvando ? null : _alternarAtivo,
      style: TextButton.styleFrom(
        // Alvo de toque de 44px, como pede o DESIGN.md.
        minimumSize: const Size(44, 44),
      ),
      icon: _salvando
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.coralDeep,
              ),
            )
          : RallyIcon(
              quadra.ativo ? "cadeado" : "check",
              tamanho: 16,
              cor: AppColors.coralDeep,
            ),
      label: Text(
        quadra.ativo ? "Pausar" : "Reativar",
        style: AppText.corpo(
          13,
          cor: AppColors.coralDeep,
          peso: FontWeight.w600,
        ),
      ),
    );
  }
}

/// Entrada da área de gestão: escolhe o estabelecimento quando há mais de um.
class GestaoPage extends ConsumerWidget {
  const GestaoPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final estabelecimentos = ref.watch(meusEstabelecimentosProvider);

    return estabelecimentos.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.coral)),
      ),
      error: (erro, _) => Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(20),
          child: Center(
            child: EstadoErro(
              mensagem: erro.toString(),
              onTentarDeNovo: () =>
                  ref.invalidate(meusEstabelecimentosProvider),
            ),
          ),
        ),
      ),
      data: (lista) {
        // Com um estabelecimento só, escolher não é escolha: vai direto.
        if (lista.length == 1) {
          return QuadrasGestaoPage(estabelecimentoId: lista.first.id);
        }
        return _seletor(context, lista);
      },
    );
  }

  Widget _seletor(BuildContext context, List<EstabelecimentoGerido> lista) {
    return Scaffold(
      body: ListView(
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
                    const Expanded(child: BrandBar(rotuloDireita: "Gestão")),
                  ],
                ),
                const SizedBox(height: 16),
                Text("Seus estabelecimentos", style: AppText.titulo(24)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: lista.isEmpty
                ? const EstadoVazio(
                    titulo: "Você ainda não gerencia nenhuma arena",
                    descricao:
                        "Quando um estabelecimento te der acesso, ele aparece aqui.",
                  )
                : Column(
                    children: [
                      for (final est in lista) ...[
                        _CardEstabelecimento(estabelecimento: est),
                        const SizedBox(height: 12),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _CardEstabelecimento extends StatelessWidget {
  const _CardEstabelecimento({required this.estabelecimento});

  final EstabelecimentoGerido estabelecimento;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push("/gestao/${estabelecimento.id}/quadras"),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      estabelecimento.nome,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.titulo(16),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "${estabelecimento.quadras} quadra"
                      "${estabelecimento.quadras == 1 ? "" : "s"}"
                      " · ${estabelecimento.meuPapel.rotulo}",
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.corpo(13, cor: AppColors.gray),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              const RallyIcon("chevron", tamanho: 18, cor: AppColors.gray),
            ],
          ),
        ),
      ),
    );
  }
}
