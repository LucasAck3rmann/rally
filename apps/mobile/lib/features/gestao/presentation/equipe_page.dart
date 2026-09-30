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
import "../../../core/widgets/secao.dart";
import "../domain/equipe.dart";
import "../domain/gestao.dart";
import "gestao_providers.dart";

/// Equipe do estabelecimento (RF-23).
///
/// Ver quem é a equipe é de toda a equipe — saber a quem recorrer não é
/// privilégio. Mexer é só do admin, e a tela esconde o que a API recusaria.
class EquipePage extends ConsumerWidget {
  const EquipePage({super.key, required this.estabelecimentoId});

  final String estabelecimentoId;

  bool _podeMexer(WidgetRef ref) {
    final lista = ref.watch(meusEstabelecimentosProvider).valueOrNull;
    for (final est in lista ?? const <EstabelecimentoGerido>[]) {
      if (est.id == estabelecimentoId) return est.meuPapel.podeEditarQuadras;
    }
    return false;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final equipe = ref.watch(equipeProvider(estabelecimentoId));
    final podeMexer = _podeMexer(ref);

    return Scaffold(
      body: RefreshIndicator(
        color: AppColors.coral,
        onRefresh: () async =>
            ref.invalidate(equipeProvider(estabelecimentoId)),
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
                          sufixo: "· equipe",
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text("Equipe", style: AppText.titulo(24)),
                  const SizedBox(height: 3),
                  Text(
                    "Quem tem acesso a esta arena",
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
              child: equipe.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.coral),
                  ),
                ),
                error: (erro, _) => EstadoErro(
                  mensagem: erro.toString(),
                  onTentarDeNovo: () =>
                      ref.invalidate(equipeProvider(estabelecimentoId)),
                ),
                data: (lista) => _lista(context, ref, lista, podeMexer),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _lista(
    BuildContext context,
    WidgetRef ref,
    List<MembroEquipe> lista,
    bool podeMexer,
  ) {
    final admins = lista.where((m) => m.papel == PapelGestao.admin).length;

    return Column(
      children: [
        for (final membro in lista) ...[
          _CardMembro(
            membro: membro,
            estabelecimentoId: estabelecimentoId,
            podeMexer: podeMexer,
            // Com um administrador só, a tela nem oferece rebaixá-lo: a API
            // recusaria, e oferecer o que vai dar erro é pior que não
            // oferecer.
            ultimoAdmin: admins == 1 && membro.papel == PapelGestao.admin,
          ),
          const SizedBox(height: 10),
        ],
        if (lista.isEmpty)
          const EstadoVazio(
            titulo: "Só você por aqui",
            descricao: "Adicione quem atende no balcão ou cuida do financeiro.",
          ),
        if (podeMexer) ...[
          const SizedBox(height: 12),
          BotaoPrimario(
            rotulo: "Adicionar pessoa",
            onPressed: () => _adicionar(context, ref),
          ),
        ],
      ],
    );
  }

  Future<void> _adicionar(BuildContext context, WidgetRef ref) async {
    final pedido =
        await showModalBottomSheet<({String email, PapelGestao papel})>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _FolhaAdicionar(),
    );
    if (pedido == null || !context.mounted) return;

    try {
      final membro = await ref.read(gestaoRepositoryProvider).adicionarMembro(
            estabelecimentoId,
            email: pedido.email,
            papel: pedido.papel,
          );
      if (!context.mounted) return;
      ref.invalidate(equipeProvider(estabelecimentoId));
      _aviso(context, "${membro.nome} entrou como ${membro.papel.rotulo}.");
    } catch (erro) {
      if (!context.mounted) return;
      _aviso(context, erro.toString());
    }
  }
}

void _aviso(BuildContext context, String mensagem) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(backgroundColor: AppColors.ink, content: Text(mensagem)),
    );
}

class _CardMembro extends ConsumerStatefulWidget {
  const _CardMembro({
    required this.membro,
    required this.estabelecimentoId,
    required this.podeMexer,
    required this.ultimoAdmin,
  });

  final MembroEquipe membro;
  final String estabelecimentoId;
  final bool podeMexer;
  final bool ultimoAdmin;

  @override
  ConsumerState<_CardMembro> createState() => _CardMembroState();
}

class _CardMembroState extends ConsumerState<_CardMembro> {
  bool _salvando = false;

  MembroEquipe get membro => widget.membro;

  Future<void> _trocar(PapelGestao papel) async {
    if (papel == membro.papel) return;
    setState(() => _salvando = true);
    try {
      await ref
          .read(gestaoRepositoryProvider)
          .trocarPapel(widget.estabelecimentoId, membro.usuarioId, papel);
      if (!mounted) return;
      ref.invalidate(equipeProvider(widget.estabelecimentoId));
      _aviso(context, "${membro.nome} agora é ${papel.rotulo}.");
    } catch (erro) {
      if (!mounted) return;
      _aviso(context, erro.toString());
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  Future<void> _remover() async {
    final confirmou = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        backgroundColor: AppColors.white,
        title:
            Text("Tirar ${membro.nome} da equipe?", style: AppText.titulo(18)),
        content: Text(
          // Dizer o que acontece de verdade: o vínculo vira cliente, as
          // reservas ficam. "Remover" sozinho soa como apagar a pessoa.
          "Ela perde o acesso à gestão, mas continua cliente da arena e as "
          "reservas dela ficam.",
          style: AppText.corpo(14, cor: AppColors.gray),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(false),
            child: Text("Manter", style: AppText.corpo(14)),
          ),
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(true),
            child: Text(
              "Tirar da equipe",
              style: AppText.corpo(
                14,
                cor: AppColors.coralDeep,
                peso: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirmou != true || !mounted) return;

    setState(() => _salvando = true);
    try {
      await ref
          .read(gestaoRepositoryProvider)
          .removerMembro(widget.estabelecimentoId, membro.usuarioId);
      if (!mounted) return;
      ref.invalidate(equipeProvider(widget.estabelecimentoId));
      _aviso(context, "${membro.nome} saiu da equipe.");
    } catch (erro) {
      if (!mounted) return;
      _aviso(context, erro.toString());
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.sand,
              shape: BoxShape.circle,
            ),
            child: Text(membro.iniciais, style: AppText.titulo(15)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  membro.nome,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.titulo(15),
                ),
                const SizedBox(height: 2),
                Text(
                  membro.email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.corpo(12, cor: AppColors.gray),
                ),
                const SizedBox(height: 4),
                Text(
                  "${membro.papel.rotulo.toUpperCase()} · DESDE "
                  "${Formato.diaCurto(membro.desde).toUpperCase()}",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.rotulo(9),
                ),
              ],
            ),
          ),
          if (widget.podeMexer) _acoes(),
        ],
      ),
    );
  }

  Widget _acoes() {
    if (_salvando) {
      return const SizedBox(
        width: 44,
        height: 44,
        child: Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppColors.coralDeep,
            ),
          ),
        ),
      );
    }

    return PopupMenuButton<String>(
      tooltip: "Opções de ${membro.nome}",
      icon: const Icon(Icons.more_vert_rounded, color: AppColors.gray),
      onSelected: (valor) {
        if (valor == "remover") {
          _remover();
        } else {
          _trocar(PapelGestao.doTexto(valor));
        }
      },
      itemBuilder: (_) => [
        for (final papel in [
          PapelGestao.atendente,
          PapelGestao.financeiro,
          PapelGestao.admin,
        ])
          PopupMenuItem(
            value: papel.paraApi,
            // O último administrador não pode ser rebaixado: a API recusa,
            // e o item desabilitado explica antes do toque.
            enabled: !(widget.ultimoAdmin && papel != PapelGestao.admin),
            child: Text(
              papel == membro.papel ? "${papel.rotulo} (atual)" : papel.rotulo,
              style: AppText.corpo(14),
            ),
          ),
        PopupMenuItem(
          value: "remover",
          enabled: !widget.ultimoAdmin,
          child: Text(
            "Tirar da equipe",
            style: AppText.corpo(14, cor: AppColors.coralDeep),
          ),
        ),
      ],
    );
  }
}

/// Folha para dar acesso a quem já tem conta no Rally.
class _FolhaAdicionar extends StatefulWidget {
  const _FolhaAdicionar();

  @override
  State<_FolhaAdicionar> createState() => _FolhaAdicionarState();
}

class _FolhaAdicionarState extends State<_FolhaAdicionar> {
  final _email = TextEditingController();
  PapelGestao _papel = PapelGestao.atendente;
  String? _erro;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  void _confirmar() {
    final email = _email.text.trim();
    if (!email.contains("@") || email.length < 5) {
      setState(() => _erro = "Informe um e-mail válido.");
      return;
    }
    Navigator.of(context).pop((email: email, papel: _papel));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      // `Material` e não `Container` com cor: o `RadioListTile` pinta o
      // ripple no Material mais próximo, e uma caixa colorida por cima o
      // esconderia — o Flutter levanta asserção nisso.
      child: Material(
        color: AppColors.bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        clipBehavior: Clip.antiAlias,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Adicionar à equipe", style: AppText.titulo(19)),
              const SizedBox(height: 4),
              Text(
                // Declarado em vez de escondido: o MVP não tem convite
                // pendente, então a pessoa precisa já ter conta.
                "A pessoa precisa já ter conta no Rally.",
                style: AppText.corpo(13, cor: AppColors.gray),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _email,
                autofocus: true,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: "E-mail",
                  hintText: "augusto@rally.com.br",
                  errorText: _erro,
                ),
                onChanged: (_) {
                  if (_erro != null) setState(() => _erro = null);
                },
              ),
              const SizedBox(height: 14),
              Text("PAPEL", style: AppText.rotulo(10)),
              const SizedBox(height: 8),
              // `RadioGroup` substituiu `groupValue`/`onChanged` por item —
              // o estado do grupo mora num lugar só.
              RadioGroup<PapelGestao>(
                groupValue: _papel,
                onChanged: (v) => setState(() => _papel = v ?? _papel),
                child: Column(
                  children: [
                    for (final papel in [
                      PapelGestao.atendente,
                      PapelGestao.financeiro,
                      PapelGestao.admin,
                    ])
                      RadioListTile<PapelGestao>(
                        value: papel,
                        contentPadding: EdgeInsets.zero,
                        activeColor: AppColors.coralDeep,
                        title: Text(papel.rotulo, style: AppText.corpo(14)),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              BotaoPrimario(rotulo: "Adicionar", onPressed: _confirmar),
              const SizedBox(height: 8),
              Center(
                child: TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(
                    "Cancelar",
                    style: AppText.corpo(14, cor: AppColors.gray),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
