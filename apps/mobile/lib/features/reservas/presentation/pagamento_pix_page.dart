import "dart:async";

import "package:flutter/foundation.dart";
import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";
import "package:qr_flutter/qr_flutter.dart";

import "../../../core/network/erro_api.dart";
import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/barra_inferior.dart";
import "../../../core/widgets/brand_bar.dart";
import "../../../core/formato.dart";
import "../../../core/widgets/rally_icon.dart";
import "../../../core/widgets/secao.dart";
import "../domain/reserva.dart";
import "reservas_providers.dart";

/// Passo 3/3: cobrança Pix com QR, copia e cola e contagem de expiração.
///
/// A confirmação chega pelo webhook do gateway, então a tela consulta a reserva
/// de tempos em tempos e segue para o comprovante assim que o pagamento entra.
class PagamentoPixPage extends ConsumerStatefulWidget {
  const PagamentoPixPage({super.key, required this.reservaId});

  final String reservaId;

  @override
  ConsumerState<PagamentoPixPage> createState() => _PagamentoPixPageState();
}

class _PagamentoPixPageState extends ConsumerState<PagamentoPixPage> {
  Timer? _relogio;
  Timer? _consulta;
  Duration _restante = Duration.zero;
  bool _verificando = false;

  /// Evita empilhar o comprovante duas vezes quando a confirmação chega
  /// pelo "Já paguei" e pela consulta periódica quase ao mesmo tempo.
  bool _jaSeguiu = false;

  @override
  void initState() {
    super.initState();
    _relogio = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    _consulta = Timer.periodic(
      const Duration(seconds: 5),
      (_) => ref.invalidate(reservaProvider(widget.reservaId)),
    );
  }

  @override
  void dispose() {
    _relogio?.cancel();
    _consulta?.cancel();
    super.dispose();
  }

  void _tick() {
    final expira = ref
        .read(reservaProvider(widget.reservaId))
        .valueOrNull
        ?.pagamento
        ?.expiraEm;
    if (expira == null) return;
    final restante = expira.difference(DateTime.now());
    if (mounted) {
      setState(
          () => _restante = restante.isNegative ? Duration.zero : restante);
    }
  }

  Future<void> _jaPaguei() async {
    setState(() => _verificando = true);
    ref.invalidate(reservaProvider(widget.reservaId));
    final reserva = await ref.read(reservaProvider(widget.reservaId).future);
    if (!mounted) return;
    setState(() => _verificando = false);

    if (reserva.pagamento?.pago ?? false) {
      _irParaComprovante();
      return;
    }
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          backgroundColor: AppColors.ink,
          content: Text(
            "Ainda não identificamos o pagamento. Assim que cair, a gente avisa.",
            style: AppText.corpo(14, cor: AppColors.white),
          ),
        ),
      );
  }

  /// Navega uma única vez para o comprovante, fora do ciclo de build.
  void _irParaComprovante() {
    if (_jaSeguiu) return;
    _jaSeguiu = true;
    _consulta?.cancel();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.pushReplacement("/reservas/${widget.reservaId}/confirmacao");
    });
  }

  /// Atalho de desenvolvimento — faz o papel do webhook do gateway.
  Future<void> _simularPagamento() async {
    try {
      await ref
          .read(reservasRepositoryProvider)
          .simularPagamento(widget.reservaId);
      if (!mounted) return;
      _irParaComprovante();
    } on ApiException catch (erro) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(erro.mensagem)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final reserva = ref.watch(reservaProvider(widget.reservaId));

    ref.listen(reservaProvider(widget.reservaId), (_, proxima) {
      // Webhook confirmou enquanto a tela estava aberta.
      if (proxima.valueOrNull?.pagamento?.pago ?? false) {
        _irParaComprovante();
      }
    });

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          HeaderFluxo(
            titulo: "Pagamento Pix",
            passo: "passo 3/3",
            onVoltar: () => context.pop(),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: reserva.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.coral),
                ),
              ),
              error: (erro, _) => EstadoErro(
                mensagem: erro.toString(),
                onTentarDeNovo: () =>
                    ref.invalidate(reservaProvider(widget.reservaId)),
              ),
              data: _cobranca,
            ),
          ),
        ],
      ),
      bottomNavigationBar: reserva.maybeWhen(
        data: (_) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
            child: BotaoPrimario(
              rotulo: "Já paguei",
              icone: const RallyIcon("check", tamanho: 18),
              carregando: _verificando,
              onPressed: _jaPaguei,
            ),
          ),
        ),
        orElse: () => null,
      ),
    );
  }

  Widget _cobranca(Reserva reserva) {
    final pagamento = reserva.pagamento;
    if (pagamento == null) {
      return const EstadoVazio(
        titulo: "Sem cobrança aberta",
        descricao: "Volte e escolha a forma de pagamento novamente.",
      );
    }

    return Column(
      children: [
        Text(Formato.moedaExata(pagamento.valor), style: AppText.titulo(30)),
        const SizedBox(height: 4),
        Text("PIX · ABACATEPAY", style: AppText.rotulo(10)),
        const SizedBox(height: 18),
        _cartaoQr(pagamento),
        const SizedBox(height: 18),
        if (pagamento.pixCopiaCola != null)
          _copiaECola(pagamento.pixCopiaCola!),
        const SizedBox(height: 18),
        _contagem(),
        if (kDebugMode) ...[
          const SizedBox(height: 8),
          TextButton(
            onPressed: _simularPagamento,
            child: Text(
              "simular pagamento (dev)",
              style: AppText.rotulo(10, cor: AppColors.gray),
            ),
          ),
        ],
      ],
    );
  }

  Widget _cartaoQr(Pagamento pagamento) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          SizedBox(
            width: 190,
            height: 190,
            child: pagamento.qrCodeUrl != null
                // Quando o gateway manda a imagem pronta, usamos a dele.
                ? Image.network(pagamento.qrCodeUrl!, fit: BoxFit.contain)
                : pagamento.pixCopiaCola != null
                    ? QrImageView(
                        data: pagamento.pixCopiaCola!,
                        version: QrVersions.auto,
                        backgroundColor: AppColors.white,
                        eyeStyle: const QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: AppColors.ink,
                        ),
                        dataModuleStyle: const QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: AppColors.ink,
                        ),
                      )
                    : const ColoredBox(color: AppColors.sand),
          ),
          const SizedBox(height: 12),
          Text("APONTE A CÂMERA DO BANCO", style: AppText.rotulo(10)),
        ],
      ),
    );
  }

  Widget _copiaECola(String codigo) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              codigo,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.rotulo(12, espacamento: 0),
            ),
          ),
          const SizedBox(width: 10),
          Material(
            color: AppColors.coral,
            borderRadius: BorderRadius.circular(10),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () async {
                await Clipboard.setData(ClipboardData(text: codigo));
                if (!mounted) return;
                ScaffoldMessenger.of(context)
                  ..hideCurrentSnackBar()
                  ..showSnackBar(
                    SnackBar(
                      backgroundColor: AppColors.ink,
                      content: Text(
                        "Código copiado.",
                        style: AppText.corpo(14, cor: AppColors.white),
                      ),
                    ),
                  );
              },
              child: Container(
                height: 44,
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const RallyIcon("copiar", tamanho: 15),
                    const SizedBox(width: 6),
                    Text("COPIAR",
                        style: AppText.rotulo(10, cor: AppColors.ink)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _contagem() {
    final expirou = _restante == Duration.zero;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const RallyIcon("relogio", tamanho: 16, cor: AppColors.coralDeep),
        const SizedBox(width: 7),
        Flexible(
          child: Text(
            expirou
                ? "COBRANÇA EXPIRADA"
                : "EXPIRA EM ${Formato.contagem(_restante)}",
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.rotulo(11, cor: AppColors.coralDeep),
          ),
        ),
      ],
    );
  }
}
