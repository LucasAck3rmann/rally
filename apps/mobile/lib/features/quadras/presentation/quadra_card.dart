import "package:flutter/material.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/estrela_nota.dart";
import "../../../core/formato.dart";
import "../../../core/widgets/rally_icon.dart";
import "../domain/quadra.dart";

/// Card da vitrine: foto, modalidade, nome, nota, preço e CTA de reserva.
class QuadraCard extends StatelessWidget {
  const QuadraCard({super.key, required this.quadra, this.onReservar});

  final Quadra quadra;
  final VoidCallback? onReservar;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _foto(),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            quadra.estabelecimento.nome,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.titulo(15),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            quadra.estabelecimento.localizacao,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.rotulo(12, espacamento: 0.2),
                          ),
                        ],
                      ),
                    ),
                    if (quadra.estabelecimento.nota != null) ...[
                      const SizedBox(width: 10),
                      EstrelaNota(nota: quadra.estabelecimento.nota!),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          Formato.moeda(quadra.precoHora),
                          style: AppText.titulo(17),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          "POR HORA",
                          style: AppText.rotulo(11, espacamento: 0.5),
                        ),
                      ],
                    ),
                    _botaoReservar(),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _foto() {
    return SizedBox(
      height: 138,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (quadra.fotoPrincipal != null)
            Image.network(
              quadra.fotoPrincipal!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.sand),
            )
          else
            const ColoredBox(color: AppColors.sand),
          Positioned(
            left: 12,
            top: 12,
            child: _pilula(
              quadra.modalidades.isEmpty
                  ? quadra.nome
                  : quadra.modalidades.first,
            ),
          ),
          if (quadra.aoVivo)
            const Positioned(top: 12, right: 12, child: _SeloAoVivo()),
        ],
      ),
    );
  }

  Widget _pilula(String texto) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(texto, style: AppText.corpo(11, peso: FontWeight.w600)),
    );
  }

  Widget _botaoReservar() {
    return Material(
      color: AppColors.coral,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onReservar,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 44, // alvo de toque mínimo
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text("Reservar", style: AppText.corpo(13, peso: FontWeight.w700)),
        ),
      ),
    );
  }
}

class _SeloAoVivo extends StatelessWidget {
  const _SeloAoVivo();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 6, 12, 6),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const RallyIcon("ponto-ao-vivo", tamanho: 7, cor: null),
          const SizedBox(width: 6),
          Text("AO VIVO", style: AppText.rotulo(10, cor: AppColors.ink)),
        ],
      ),
    );
  }
}
