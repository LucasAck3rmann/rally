import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:google_fonts/google_fonts.dart";

import "../../../core/theme/app_colors.dart";
import "auth_controller.dart";

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _senha = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _senha.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    await ref
        .read(authControllerProvider.notifier)
        .login(_email.text.trim(), _senha.text);

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
    // Em caso de sucesso, o guard do router navega para /home automaticamente.
  }

  @override
  Widget build(BuildContext context) {
    final loading = ref.watch(authControllerProvider).isLoading;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _emblema(),
                    const SizedBox(height: 28),
                    Text(
                      "Bora jogar",
                      textAlign: TextAlign.center,
                      style: GoogleFonts.sora(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      "Entre para reservar sua quadra",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.gray),
                    ),
                    const SizedBox(height: 28),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: "E-mail"),
                      validator: (v) =>
                          (v == null || !v.contains("@") || !v.contains("."))
                              ? "Informe um e-mail válido"
                              : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _senha,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: "Senha",
                        suffixIcon: IconButton(
                          tooltip: _obscure ? "Mostrar senha" : "Ocultar senha",
                          onPressed: () => setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure ? Icons.visibility_off : Icons.visibility,
                            color: AppColors.gray,
                          ),
                        ),
                      ),
                      validator: (v) => (v == null || v.length < 6)
                          ? "Mínimo de 6 caracteres"
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
                          : const Text("Entrar"),
                    ),
                    const SizedBox(height: 18),
                    _divisor(),
                    const SizedBox(height: 18),
                    _social("Continuar com Google"),
                    const SizedBox(height: 10),
                    _social("Continuar com Instagram"),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () {},
                      child: const Text(
                        "Criar conta",
                        style: TextStyle(color: AppColors.coralDeep),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _emblema() {
    return Center(
      child: Container(
        width: 72,
        height: 72,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.coral,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          "R",
          style: GoogleFonts.sora(
            fontSize: 38,
            fontWeight: FontWeight.w800,
            color: AppColors.ink,
          ),
        ),
      ),
    );
  }

  Widget _divisor() {
    return const Row(
      children: [
        Expanded(child: Divider(color: AppColors.line)),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 12),
          child: Text("ou", style: TextStyle(color: AppColors.gray)),
        ),
        Expanded(child: Divider(color: AppColors.line)),
      ],
    );
  }

  Widget _social(String label) {
    return OutlinedButton(
      onPressed: () {},
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.ink,
        minimumSize: const Size.fromHeight(50),
        side: const BorderSide(color: AppColors.line),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      child: Text(label),
    );
  }
}
