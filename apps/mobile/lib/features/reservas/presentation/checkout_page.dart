import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/network/erro_api.dart";
import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/barra_inferior.dart";
import "../../../core/widgets/brand_bar.dart";
import "../../../core/formato.dart";
import "../../../core/widgets/rally_icon.dart";
import "../../quadras/domain/quadra.dart";
import "reservas_providers.dart";

/// Dados que a tela de detalhe passa adiante ao abrir o checkout.
typedef ArgumentosCheckout = ({Quadra quadra, Slot slot});

/// Passo 2/2 da reserva: confere o resumo, escolhe a forma de pagamento e paga.
class CheckoutPage extends ConsumerStatefulWidget {
  const CheckoutPage({super.key, required this.argumentos});

  final ArgumentosCheckout argumentos;

  @override
  ConsumerState<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends ConsumerState<CheckoutPage> {
  String _metodo = "PIX";
  bool _enviando = false;

  Quadra get _quadra => widget.argumentos.quadra;
  Slot get _slot => widget.argumentos.slot;

  double get _subtotal => _slot.preco;
  double get _percentualPix => _quadra.estabelecimento.descontoPixPct;
  double get _desconto =>
      _metodo == "PIX" ? _subtotal * _percentualPix / 100 : 0;
  double get _total => _subtotal - _desconto;

  Future<void> _pagar() async {
    setState(() => _enviando = true);
    try {
      final reserva = await ref.read(reservasRepositoryProvider).criar(
            quadraId: _quadra.id,
            inicio: _slot.inicio,
            fim: _slot.fim,
            metodo: _metodo,
          );
      if (!mounted) return;
      // A reserva nasce pendente; o pagamento acontece na próxima tela.
      context.pushReplacement("/reservas/${reserva.id}/pagamento");
    } on ApiException catch (erro) {
      if (!mounted) return;
      setState(() => _enviando = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: AppColors.ink,
            content: Text(
              erro.mensagem,
              style: AppText.corpo(14, cor: AppColors.white),
            ),
            action: erro.status == 409
                ? SnackBarAction(
                    label: "Ver horários",
                    textColor: AppColors.sun,
                    onPressed: () => context.pop(),
                  )
                : null,
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          HeaderFluxo(
            titulo: "Pagamento",
            passo: "passo 2/2",
            onVoltar: () => context.pop(),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _resumo(),
                const SizedBox(height: 16),
                Text("FORMA DE PAGAMENTO", style: AppText.rotulo(12)),
                const SizedBox(height: 16),
                _opcaoPagamento(
                  metodo: "PIX",
                  icone: "pix",
                  titulo: "Pix",
                  descricao: "Aprovação na hora · AbacatePay",
                  selo: _percentualPix > 0
                      ? "-${_percentualPix.toStringAsFixed(0)}%"
                      : null,
                ),
                const SizedBox(height: 16),
                _opcaoPagamento(
                  metodo: "CARTAO",
                  icone: "cartao",
                  titulo: "Cartão de crédito",
                  descricao: "Em até 3x sem juros",
                ),
                const SizedBox(height: 16),
                _valores(),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const RallyIcon("cadeado", tamanho: 16, cor: AppColors.gray),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        "PAGAMENTO SEGURO · QR GERADO NA HORA",
                        style: AppText.rotulo(10),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: BarraPrecoCta(
        valor: _total,
        legenda: _metodo == "PIX" ? "no Pix" : "no cartão",
        rotuloCta: _metodo == "PIX" ? "Pagar com Pix" : "Pagar no cartão",
        iconeCta: RallyIcon(
          _metodo == "PIX" ? "pix" : "cartao",
          tamanho: 18,
        ),
        carregando: _enviando,
        onCta: _pagar,
      ),
    );
  }

  Widget _resumo() {
    final foto = _quadra.fotoPrincipal;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 64,
              height: 64,
              child: foto == null
                  ? const ColoredBox(color: AppColors.sand)
                  : Image.network(
                      foto,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          const ColoredBox(color: AppColors.sand),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _quadra.estabelecimento.nome,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.titulo(15),
                ),
                const SizedBox(height: 3),
                Text(
                  "${_quadra.modalidades.isEmpty ? _quadra.nome : _quadra.modalidades.first} · ${Formato.diaCurto(_slot.inicio)}"
                      .toUpperCase(),
                  style: AppText.rotulo(11),
                ),
                const SizedBox(height: 3),
                Text(
                  "${_slot.hora} – ${Formato.hora(_slot.fim)}",
                  style: AppText.rotulo(11, cor: AppColors.ink),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: "Trocar horário",
            onPressed: () => context.pop(),
            icon: const RallyIcon("editar", tamanho: 20, cor: AppColors.gray),
          ),
        ],
      ),
    );
  }

  Widget _opcaoPagamento({
    required String metodo,
    required String icone,
    required String titulo,
    required String descricao,
    String? selo,
  }) {
    final selecionado = _metodo == metodo;

    return Semantics(
      inMutuallyExclusiveGroup: true,
      selected: selecionado,
      child: Material(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: () => setState(() => _metodo = metodo),
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: selecionado ? AppColors.coral : AppColors.line,
                width: selecionado ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                _radio(selecionado),
                const SizedBox(width: 12),
                Container(
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.sand,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: RallyIcon(icone, tamanho: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(titulo, style: AppText.titulo(15)),
                      const SizedBox(height: 2),
                      Text(descricao.toUpperCase(), style: AppText.rotulo(10)),
                    ],
                  ),
                ),
                if (selo != null) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.coral,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(selo, style: AppText.rotulo(10, cor: AppColors.ink)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _radio(bool selecionado) {
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: selecionado ? AppColors.coral : AppColors.line,
          width: 2,
        ),
      ),
      child: selecionado
          ? Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(
                color: AppColors.ink,
                shape: BoxShape.circle,
              ),
            )
          : null,
    );
  }

  Widget _valores() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          _linhaValor(
            "${(_slot.fim.difference(_slot.inicio).inMinutes / 60).toStringAsFixed(0)} hora de quadra",
            Formato.moeda(_subtotal),
          ),
          if (_desconto > 0) ...[
            const SizedBox(height: 12),
            _linhaValor(
              "Desconto Pix (${_percentualPix.toStringAsFixed(0)}%)",
              "- ${Formato.moeda(_desconto)}",
              cor: AppColors.coralDeep,
            ),
          ],
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.line),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Total", style: AppText.titulo(16)),
              Text(Formato.moeda(_total), style: AppText.titulo(22)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _linhaValor(String rotulo, String valor, {Color? cor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
          child: Text(
            rotulo,
            style: AppText.corpo(14, cor: AppColors.gray, peso: FontWeight.w500),
          ),
        ),
        const SizedBox(width: 12),
        Text(valor, style: AppText.rotulo(12, cor: cor ?? AppColors.ink)),
      ],
    );
  }
}
