// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/app_colors.dart";
import "../domain/auth_repository.dart";
import "auth_providers.dart";

/// Pedido de link de redefinição de senha (RF-03).
///
/// **Só o pedido.** A escolha da nova senha acontece no navegador, porque é
/// para lá que o link do e-mail aponta. Trazer esse passo para dentro do
/// aplicativo exigiria esquema de URL registrado e as pastas de plataforma,
/// que esta máquina não tem como verificar — e uma tela de redefinição que
/// nunca foi aberta por um link real seria pior do que não tê-la.
///
/// A tela diz isso ao usuário em vez de deixá-lo descobrir sozinho que o
/// link abre fora do aplicativo.
class RecuperarSenhaPage extends ConsumerStatefulWidget {
  const RecuperarSenhaPage({super.key});

  @override
  ConsumerState<RecuperarSenhaPage> createState() => _RecuperarSenhaPageState();
}

class _RecuperarSenhaPageState extends ConsumerState<RecuperarSenhaPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _enviando = false;
  bool _enviado = false;
  String? _erro;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _enviando = true;
      _erro = null;
    });

    try {
      await ref
          .read(authRepositoryProvider)
          .pedirLinkDeSenha(email: _email.text.trim());
      if (mounted) setState(() => _enviado = true);
    } on AuthException catch (e) {
      if (mounted) setState(() => _erro = e.message);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.ink,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: "Voltar",
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: _enviado ? _aviso() : _formulario(),
          ),
        ),
      ),
    );
  }

  Widget _formulario() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            "Esqueceu a senha?",
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            "Informe o e-mail da conta. O link chega por e-mail e abre no "
            "navegador.",
            style: TextStyle(fontSize: 15, color: AppColors.gray),
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            autofillHints: const [AutofillHints.email],
            decoration: const InputDecoration(labelText: "E-mail"),
            validator: (v) {
              final texto = (v ?? "").trim();
              if (texto.isEmpty) return "Informe o e-mail da conta.";
              if (!texto.contains("@")) return "Informe um e-mail válido.";
              return null;
            },
          ),
          if (_erro != null) ...[
            const SizedBox(height: 16),
            Text(
              _erro!,
              style: const TextStyle(color: AppColors.coralDeep, fontSize: 14),
            ),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _enviando ? null : _enviar,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(50),
            ),
            child: Text(_enviando ? "Enviando…" : "Enviar link"),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _enviando ? null : () => context.pop(),
            child: const Text("Lembrei a senha"),
          ),
        ],
      ),
    );
  }

  Widget _aviso() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          "Verifique seu e-mail",
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            color: AppColors.ink,
          ),
        ),
        const SizedBox(height: 12),
        // Não confirma que a conta existe, porque a API também não confirma:
        // a diferença entre as duas telas seria uma lista de clientes.
        const Text(
          "Se houver conta com esse e-mail, o link de redefinição acabou de "
          "ser enviado. Ele vale por 30 minutos e abre no navegador.",
          style: TextStyle(fontSize: 15, color: AppColors.ink),
        ),
        const SizedBox(height: 12),
        const Text(
          "Não chegou? Confira a caixa de spam antes de pedir outro — pedir "
          "de novo invalida o link anterior.",
          style: TextStyle(fontSize: 14, color: AppColors.gray),
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: () => context.pop(),
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(50),
          ),
          child: const Text("Voltar para o login"),
        ),
      ],
    );
  }
}
