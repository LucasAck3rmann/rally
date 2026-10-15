// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/formato.dart";
import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/barra_inferior.dart";
import "../../../core/widgets/secao.dart";
import "../../quadras/domain/quadra.dart";
import "../../quadras/presentation/agenda_widgets.dart";
import "../../quadras/presentation/quadras_providers.dart";
import "../domain/reserva.dart";
import "reservas_providers.dart";

/// Escolha de um novo horário para uma reserva existente (RF-09).
///
/// Reusa a grade do detalhe da quadra: escolher horário é o mesmo gesto nos
/// dois lugares, então são os mesmos cartões de dia e de slot.
class FolhaRemarcar extends ConsumerStatefulWidget {
  const FolhaRemarcar({super.key, required this.reserva});

  final Reserva reserva;

  /// Abre a folha; devolve `true` quando a reserva foi movida.
  static Future<bool?> abrir(BuildContext context, Reserva reserva) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => FolhaRemarcar(reserva: reserva),
    );
  }

  @override
  ConsumerState<FolhaRemarcar> createState() => _FolhaRemarcarState();
}

class _FolhaRemarcarState extends ConsumerState<FolhaRemarcar> {
  static const _diasVisiveis = 14;

  late DateTime _dia = _hoje;
  Slot? _slot;
  bool _enviando = false;

  DateTime get _hoje {
    final agora = DateTime.now();
    return DateTime(agora.year, agora.month, agora.day);
  }

  Reserva get reserva => widget.reserva;

  void _escolherDia(DateTime dia) {
    setState(() {
      _dia = dia;
      _slot = null;
    });
  }

  Future<void> _confirmar() async {
    final slot = _slot;
    if (slot == null) return;

    setState(() => _enviando = true);
    try {
      await ref
          .read(reservasRepositoryProvider)
          .remarcar(reserva.id, inicio: slot.inicio, fim: slot.fim);
      if (!mounted) return;
      ref.invalidate(minhasReservasProvider);
      Navigator.of(context).pop(true);
    } catch (erro) {
      if (!mounted) return;
      setState(() => _enviando = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: AppColors.ink,
            content: Text(erro.toString()),
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.85,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _puxador(),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: _cabecalho(),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 0, 0),
              child: _seletorDeDias(),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
                child: _grade(),
              ),
            ),
            _barra(),
          ],
        ),
      ),
    );
  }

  Widget _puxador() {
    return Center(
      child: Container(
        width: 40,
        height: 4,
        margin: const EdgeInsets.only(top: 10, bottom: 12),
        decoration: BoxDecoration(
          color: AppColors.line,
          borderRadius: BorderRadius.circular(999),
        ),
      ),
    );
  }

  Widget _cabecalho() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Remarcar", style: AppText.titulo(22)),
        const SizedBox(height: 4),
        Text(
          "Hoje: ${Formato.diaCurto(reserva.inicio)}, ${reserva.faixaHoraria}"
              .toUpperCase(),
          style: AppText.rotulo(11),
        ),
        const SizedBox(height: 8),
        Text(
          "Escolha outro horário na ${reserva.quadraNome}. "
          "O valor do novo horário pode ser diferente.",
          style: AppText.corpo(13, cor: AppColors.gray),
        ),
      ],
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
          return CartaoDia(
            rotulo: i == 0 ? "Hoje" : Formato.diaSemana(dia),
            numero: dia.day,
            ativo: dia == _dia,
            onTap: () => _escolherDia(dia),
          );
        },
      ),
    );
  }

  Widget _grade() {
    final consulta = (quadraId: reserva.quadraId, dia: _dia);
    final agenda = ref.watch(disponibilidadeProvider(consulta));

    return agenda.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 28),
        child: Center(child: CircularProgressIndicator(color: AppColors.coral)),
      ),
      error: (erro, _) => EstadoErro(
        mensagem: erro.toString(),
        onTentarDeNovo: () => ref.invalidate(disponibilidadeProvider(consulta)),
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
                escolhido: _slot?.inicio == slot.inicio,
                onTap:
                    slot.disponivel ? () => setState(() => _slot = slot) : null,
              ),
          ],
        );
      },
    );
  }

  Widget _barra() {
    final slot = _slot;
    return BarraPrecoCta(
      valor: slot?.preco ?? reserva.preco,
      legenda: slot == null ? "hoje" : "neste horário",
      rotuloCta:
          slot == null ? "Escolha um horário" : "Mover para ${slot.hora}",
      carregando: _enviando,
      onCta: slot == null || _enviando ? null : _confirmar,
    );
  }
}
