import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/barra_inferior.dart";
import "../../../core/widgets/estrela_nota.dart";
import "../../../core/formato.dart";
import "../../../core/widgets/rally_chip.dart";
import "../../../core/widgets/rally_icon.dart";
import "../../../core/widgets/secao.dart";
import "../domain/quadra.dart";
import "agenda_widgets.dart";
import "quadras_providers.dart";

/// Detalhe da quadra: apresentação, comodidades e escolha do horário.
class QuadraDetalhePage extends ConsumerStatefulWidget {
  const QuadraDetalhePage({super.key, required this.quadraId});

  final String quadraId;

  @override
  ConsumerState<QuadraDetalhePage> createState() => _QuadraDetalhePageState();
}

class _QuadraDetalhePageState extends ConsumerState<QuadraDetalhePage> {
  /// Quantos dias à frente o seletor oferece.
  static const _diasVisiveis = 7;

  late DateTime _dia = _hoje;
  Slot? _slotEscolhido;

  static DateTime get _hoje {
    final agora = DateTime.now();
    return DateTime(agora.year, agora.month, agora.day);
  }

  void _escolherDia(DateTime dia) {
    setState(() {
      _dia = dia;
      _slotEscolhido = null; // a grade muda; a escolha anterior não vale mais
    });
  }

  @override
  Widget build(BuildContext context) {
    final quadra = ref.watch(quadraDetalheProvider(widget.quadraId));

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: quadra.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.coral),
        ),
        error: (erro, _) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: EstadoErro(
              mensagem: erro.toString(),
              onTentarDeNovo: () =>
                  ref.invalidate(quadraDetalheProvider(widget.quadraId)),
            ),
          ),
        ),
        data: _conteudo,
      ),
      bottomNavigationBar: quadra.maybeWhen(
        data: (q) => _barraReserva(q),
        orElse: () => null,
      ),
    );
  }

  Widget _conteudo(Quadra quadra) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        _hero(quadra),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _titulo(quadra),
              const SizedBox(height: 20),
              _modalidades(quadra),
              const SizedBox(height: 20),
              if (quadra.descricao != null) ...[
                Text("Sobre a quadra", style: AppText.titulo(15)),
                const SizedBox(height: 6),
                Text(
                  quadra.descricao!,
                  style: AppText.corpo(13, cor: AppColors.gray),
                ),
                const SizedBox(height: 20),
              ],
              if (quadra.comodidades.isNotEmpty) ...[
                Text("Comodidades", style: AppText.titulo(15)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final item in quadra.comodidades) _comodidade(item),
                  ],
                ),
                const SizedBox(height: 20),
              ],
              Text("Escolha o horário", style: AppText.titulo(15)),
              const SizedBox(height: 12),
              _seletorDeDias(),
              const SizedBox(height: 12),
              _grade(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _hero(Quadra quadra) {
    final foto = quadra.fotoPrincipal;
    return SizedBox(
      height: 290,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (foto != null)
            Image.network(
              foto,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.sand),
            )
          else
            const ColoredBox(color: AppColors.sand),
          // Véu sutil só para o botão e a pílula continuarem legíveis.
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x33000000), Colors.transparent, Color(0x22000000)],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _botaoVoltar(),
                  const Spacer(),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      "Quadra de areia · ${quadra.modalidades.isEmpty ? quadra.nome : quadra.modalidades.first}",
                      style: AppText.corpo(12, peso: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _botaoVoltar() {
    return Semantics(
      button: true,
      label: "Voltar",
      child: SizedBox(
        width: 44,
        height: 44,
        child: Center(
          child: Material(
            color: AppColors.white,
            shape: const CircleBorder(),
            child: InkWell(
              onTap: () => context.pop(),
              customBorder: const CircleBorder(),
              child: const SizedBox(
                width: 40,
                height: 40,
                child: Center(child: RallyIcon("voltar", tamanho: 20)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _titulo(Quadra quadra) {
    final est = quadra.estabelecimento;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(est.nome, style: AppText.titulo(22)),
              const SizedBox(height: 4),
              Text(
                [est.bairro, est.cidade, est.uf]
                    .where((p) => p != null && p.isNotEmpty)
                    .join(" · "),
                style: AppText.rotulo(13, espacamento: 0.2),
              ),
            ],
          ),
        ),
        if (est.nota != null) ...[
          const SizedBox(width: 10),
          EstrelaNota(nota: est.nota!, compacto: false),
        ],
      ],
    );
  }

  Widget _modalidades(Quadra quadra) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final m in quadra.modalidades) ...[
            // Informativos aqui (não filtram nada): o primeiro fica destacado.
            RallyChip(rotulo: m, ativo: m == quadra.modalidades.first),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  Widget _comodidade(String texto) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.sand,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(texto, style: AppText.corpo(12, peso: FontWeight.w500)),
    );
  }

  Widget _seletorDeDias() {
    final hoje = _hoje;
    return SizedBox(
      height: 62,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _diasVisiveis,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final dia = hoje.add(Duration(days: i));
          final ativo = dia == _dia;
          return CartaoDia(
            rotulo: i == 0 ? "Hoje" : Formato.diaSemana(dia),
            numero: dia.day,
            ativo: ativo,
            onTap: () => _escolherDia(dia),
          );
        },
      ),
    );
  }

  Widget _grade() {
    final agenda = ref.watch(
      disponibilidadeProvider((quadraId: widget.quadraId, dia: _dia)),
    );

    return agenda.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 28),
        child: Center(child: CircularProgressIndicator(color: AppColors.coral)),
      ),
      error: (erro, _) => EstadoErro(
        mensagem: erro.toString(),
        onTentarDeNovo: () => ref.invalidate(
          disponibilidadeProvider((quadraId: widget.quadraId, dia: _dia)),
        ),
      ),
      data: (disponibilidade) {
        if (disponibilidade.slots.isEmpty) {
          return const EstadoVazio(
            titulo: "Sem horários nesse dia",
            descricao: "A quadra não abre nessa data. Escolha outro dia.",
          );
        }
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final slot in disponibilidade.slots)
              CartaoSlot(
                slot: slot,
                escolhido: _slotEscolhido?.inicio == slot.inicio,
                onTap: slot.disponivel
                    ? () => setState(() => _slotEscolhido = slot)
                    : null,
              ),
          ],
        );
      },
    );
  }

  Widget _barraReserva(Quadra quadra) {
    final slot = _slotEscolhido;
    return BarraPrecoCta(
      valor: slot?.preco ?? quadra.precoHora,
      legenda: slot == null ? "por hora" : "neste horário",
      rotuloCta: slot == null ? "Escolha um horário" : "Reservar ${slot.hora}",
      onCta: slot == null
          ? null
          : () => context.push(
                "/quadras/${widget.quadraId}/checkout",
                extra: (quadra: quadra, slot: slot),
              ),
    );
  }
}
