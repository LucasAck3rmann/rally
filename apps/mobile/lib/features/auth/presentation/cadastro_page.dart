// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/rally_icon.dart";
import "auth_controller.dart";

/// Criação de conta do cliente (RF-01).
///
/// Coleta só o necessário — nome, e-mail e senha —, como manda a minimização
/// de PII em `docs/seguranca-lgpd.md`. A base legal do cadastro é a execução
/// do contrato, então não há caixa de consentimento aqui: o aviso de Termos e
/// Privacidade cobre a transparência. Opt-in de marketing é consentimento à
/// parte e não entra nesta tela.
class CadastroPage extends ConsumerStatefulWidget {
  const CadastroPage({super.key});

  @override
  ConsumerState<CadastroPage> createState() => _CadastroPageState();
}

class _CadastroPageState extends ConsumerState<CadastroPage> {
  final _formKey = GlobalKey<FormState>();
  final _nome = TextEditingController();
  final _email = TextEditingController();
  final _senha = TextEditingController();
  final _confirmacao = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _nome.dispose();
    _email.dispose();
    _senha.dispose();
    _confirmacao.dispose();
    super.dispose();
  }

  void _voltar() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go("/login");
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    await ref.read(authControllerProvider.notifier).register(
          _nome.text.trim(),
          _email.text.trim(),
          _senha.text,
        );

    final state = ref.read(authControllerProvider);
    if (state.hasError && mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: AppColors.ink,
            content: Text(state.error.toString()),
          ),
        );
    }
    // No sucesso, o guard do router já leva para a home com a sessão aberta.
  }

  @override
  Widget build(BuildContext context) {
    final loading = ref.watch(authControllerProvider).isLoading;

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 8, top: 4),
              child: IconButton(
                tooltip: "Voltar",
                onPressed: loading ? null : _voltar,
                icon: const Icon(Icons.arrow_back, color: AppColors.ink),
              ),
            ),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Center(child: RallyEmblema(tamanho: 60)),
                          const SizedBox(height: 22),
                          Text(
                            "Criar conta",
                            textAlign: TextAlign.center,
                            style: AppText.titulo(28, peso: FontWeight.w800),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            "Leva um minuto. Depois é só escolher a quadra.",
                            textAlign: TextAlign.center,
                            style: AppText.corpo(14, cor: AppColors.gray),
                          ),
                          const SizedBox(height: 26),
                          TextFormField(
                            controller: _nome,
                            textInputAction: TextInputAction.next,
                            textCapitalization: TextCapitalization.words,
                            autofillHints: const [AutofillHints.name],
                            decoration: const InputDecoration(
                              labelText: "Nome",
                            ),
                            validator: (v) => (v == null || v.trim().length < 2)
                                ? "Informe seu nome"
                                : null,
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [AutofillHints.email],
                            decoration: const InputDecoration(
                              labelText: "E-mail",
                            ),
                            validator: (v) => (v == null ||
                                    !v.contains("@") ||
                                    !v.contains("."))
                                ? "Informe um e-mail válido"
                                : null,
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _senha,
                            obscureText: _obscure,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [AutofillHints.newPassword],
                            decoration: InputDecoration(
                              labelText: "Senha",
                              helperText: "Mínimo de 6 caracteres",
                              suffixIcon: IconButton(
                                tooltip: _obscure
                                    ? "Mostrar senha"
                                    : "Ocultar senha",
                                onPressed: () =>
                                    setState(() => _obscure = !_obscure),
                                icon: Icon(
                                  _obscure
                                      ? Icons.visibility_off
                                      : Icons.visibility,
                                  color: AppColors.gray,
                                ),
                              ),
                            ),
                            validator: (v) => (v == null || v.length < 6)
                                ? "Mínimo de 6 caracteres"
                                : null,
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _confirmacao,
                            obscureText: _obscure,
                            textInputAction: TextInputAction.done,
                            onFieldSubmitted: (_) => _submit(),
                            decoration: const InputDecoration(
                              labelText: "Confirmar senha",
                            ),
                            validator: (v) => (v != _senha.text)
                                ? "As senhas não conferem"
                                : null,
                          ),
                          const SizedBox(height: 22),
                          FilledButton(
                            onPressed: loading ? null : _submit,
                            child: loading
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: AppColors.ink,
                                    ),
                                  )
                                : const Text("Criar conta"),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            "Ao criar a conta você aceita os Termos de Uso e a "
                            "Política de Privacidade do Rally.",
                            textAlign: TextAlign.center,
                            style: AppText.corpo(12, cor: AppColors.gray),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: loading ? null : _voltar,
                            child: Text(
                              "Já tenho conta",
                              style: AppText.corpo(
                                14,
                                cor: AppColors.coralDeep,
                                peso: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
