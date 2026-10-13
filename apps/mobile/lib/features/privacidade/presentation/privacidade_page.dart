// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";
import "package:share_plus/share_plus.dart";

import "../../../core/theme/app_colors.dart";
import "../../auth/presentation/auth_controller.dart";
import "../domain/privacidade_repository.dart";
import "privacidade_providers.dart";

/// Direitos do titular dos dados (RNF-07, LGPD).
///
/// Fica no aplicativo e não no painel da web porque é aqui que o **titular**
/// está — o painel é da equipe da arena. Os dois direitos aparecem na mesma
/// tela, com o que cada um faz escrito antes do botão: quem vai excluir a
/// conta merece saber, antes de tocar, que o histórico de pagamento continua
/// existindo por obrigação fiscal.
class PrivacidadePage extends ConsumerStatefulWidget {
  const PrivacidadePage({super.key});

  @override
  ConsumerState<PrivacidadePage> createState() => _PrivacidadePageState();
}

class _PrivacidadePageState extends ConsumerState<PrivacidadePage> {
  bool _exportando = false;
  bool _excluindo = false;
  DadosExportados? _exportado;
  String? _erro;

  Future<void> _exportar() async {
    setState(() {
      _exportando = true;
      _erro = null;
    });
    try {
      final dados = await ref.read(privacidadeRepositoryProvider).exportar();
      if (mounted) setState(() => _exportado = dados);
    } on PrivacidadeException catch (e) {
      if (mounted) setState(() => _erro = e.message);
    } finally {
      if (mounted) setState(() => _exportando = false);
    }
  }

  Future<void> _excluir() async {
    final confirmou = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text("Excluir sua conta?"),
        content: const Text(
          "Seus dados pessoais são apagados e você perde o acesso. "
          "O histórico de reservas pagas continua guardado pela arena, "
          "por obrigação fiscal, sem ligação com seu nome.\n\n"
          "Isso não tem como ser desfeito.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(false),
            child: const Text("Cancelar"),
          ),
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(true),
            child: const Text(
              "Excluir",
              style: TextStyle(color: AppColors.coralDeep),
            ),
          ),
        ],
      ),
    );
    if (confirmou != true) return;

    setState(() {
      _excluindo = true;
      _erro = null;
    });
    try {
      await ref.read(privacidadeRepositoryProvider).excluirConta();
      // Sair em seguida: a sessão aponta para uma conta que não existe mais,
      // e qualquer tela que ela abrisse falharia sem explicar por quê.
      await ref.read(authControllerProvider.notifier).logout();
    } on PrivacidadeException catch (e) {
      if (mounted) setState(() => _erro = e.message);
    } finally {
      if (mounted) setState(() => _excluindo = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ocupado = _exportando || _excluindo;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.ink,
        elevation: 0,
        title: const Text("Privacidade"),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: "Voltar",
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          children: [
            const Text(
              "Seus dados",
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              "Você pode baixar tudo o que guardamos sobre você, em um "
              "arquivo que outro sistema consegue ler.",
              style: TextStyle(fontSize: 15, color: AppColors.gray),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: ocupado ? null : _exportar,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
              ),
              child: Text(_exportando ? "Preparando…" : "Baixar meus dados"),
            ),
            if (_exportado != null) ...[
              const SizedBox(height: 12),
              _resumoDaExportacao(_exportado!),
            ],
            const SizedBox(height: 32),
            const Divider(color: AppColors.line),
            const SizedBox(height: 24),
            const Text(
              "Excluir a conta",
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              "Seus dados pessoais são apagados e você perde o acesso. O "
              "histórico de reservas pagas continua guardado pela arena, por "
              "obrigação fiscal, sem ligação com seu nome.",
              style: TextStyle(fontSize: 15, color: AppColors.gray),
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: ocupado ? null : _excluir,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.coralDeep,
                minimumSize: const Size.fromHeight(50),
                side: const BorderSide(color: AppColors.line),
              ),
              child: Text(_excluindo ? "Excluindo…" : "Excluir minha conta"),
            ),
            if (_erro != null) ...[
              const SizedBox(height: 16),
              Text(
                _erro!,
                style: const TextStyle(
                  color: AppColors.coralDeep,
                  fontSize: 14,
                ),
              ),
            ],
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _resumoDaExportacao(DadosExportados dados) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.sand,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Arquivo pronto: ${dados.reservas} reserva(s) e "
            "${dados.avisos} aviso(s).",
            style: const TextStyle(fontSize: 15, color: AppColors.ink),
          ),
          const SizedBox(height: 4),
          const Text(
            "Sua senha não vai no arquivo — ela é guardada de um jeito que "
            "nem nós conseguimos ler.",
            style: TextStyle(fontSize: 13, color: AppColors.gray),
          ),
          const SizedBox(height: 12),
          FilledButton.tonal(
            onPressed: () => Share.share(
              dados.json,
              subject: "Meus dados no Rally",
            ),
            child: const Text("Compartilhar arquivo"),
          ),
        ],
      ),
    );
  }
}
