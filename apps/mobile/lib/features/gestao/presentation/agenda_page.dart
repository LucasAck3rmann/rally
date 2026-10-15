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
import "../../quadras/presentation/agenda_widgets.dart";
import "../domain/agenda.dart";
import "../domain/gestao.dart";
import "gestao_providers.dart";

/// Agenda do dia do estabelecimento (RF-21).
///
/// Grade **quadras × horas**, como no desenho: o dono precisa ver o dia
/// inteiro de uma vez, não uma lista por quadra. Em tela estreita as colunas
/// rolam na horizontal e a coluna das horas fica fixa à esquerda — sem ela,
/// rolar perde a referência de qual linha é qual hora.
class AgendaPage extends ConsumerStatefulWidget {
  const AgendaPage({super.key, required this.estabelecimentoId});

  final String estabelecimentoId;

  @override
  ConsumerState<AgendaPage> createState() => _AgendaPageState();
}

class _AgendaPageState extends ConsumerState<AgendaPage> {
  late DateTime _dia;

  /// Altura mínima da linha, do desenho. Ela cresce com o texto do sistema:
  /// a célula tem duas linhas (rótulo e apoio) e, em fonte ampliada, 56px
  /// deixam de caber — o gate de texto ampliado pegou isso em 3px.
  static const _alturaMinimaDaLinha = 56.0;

  double _alturaDaLinha(BuildContext context) {
    final escala = MediaQuery.textScalerOf(context);
    const linha = AppText.entrelinha;
    final conteudo =
        escala.scale(11) * linha + 2 + escala.scale(10) * linha + 20;
    // Os 20 cobrem o respiro interno da célula (10), a borda (2) e o
    // recuo entre células (4) — medidos, não chutados: com 14 sobrava
    // 2px de estouro em 1,5x.
    return conteudo < _alturaMinimaDaLinha ? _alturaMinimaDaLinha : conteudo;
  }

  static const _larguraDaHora = 52.0;
  static const _larguraDaColuna = 104.0;

  @override
  void initState() {
    super.initState();
    final agora = DateTime.now();
    _dia = DateTime(agora.year, agora.month, agora.day);
  }

  ({String estabelecimentoId, String data}) get _chave => (
        estabelecimentoId: widget.estabelecimentoId,
        data: Formato.dataIso(_dia),
      );

  /// Se o usuário pode bloquear horário neste estabelecimento.
  ///
  /// Precisa ser **observado**, não lido: com `ref.read` num `FutureProvider`
  /// que ainda não resolveu, o valor vem nulo e a tela decide que ninguém
  /// pode bloquear — e nunca revê a decisão. Quem entrasse direto na agenda,
  /// sem passar pelo Perfil, ficava com a grade inerte.
  bool _podeBloquear(WidgetRef ref) {
    final lista = ref.watch(meusEstabelecimentosProvider).valueOrNull;
    for (final est in lista ?? const <EstabelecimentoGerido>[]) {
      if (est.id == widget.estabelecimentoId) {
        return est.meuPapel.podeEditarQuadras;
      }
    }
    return false;
  }

  void _aviso(String mensagem) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(backgroundColor: AppColors.ink, content: Text(mensagem)),
      );
  }

  @override
  Widget build(BuildContext context) {
    final agenda = ref.watch(agendaProvider(_chave));
    final podeBloquear = _podeBloquear(ref);

    return Scaffold(
      body: Column(
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
                        sufixo: "· agenda",
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text("Agenda", style: AppText.titulo(24)),
                const SizedBox(height: 3),
                Text(
                  Formato.diaPorExtenso(_dia),
                  style: AppText.corpo(
                    13,
                    cor: AppColors.gray,
                    peso: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 16),
                _tiraDeDias(),
              ],
            ),
          ),
          Expanded(
            child: agenda.when(
              loading: () => const Center(
                child: CircularProgressIndicator(color: AppColors.coral),
              ),
              error: (erro, _) => Padding(
                padding: const EdgeInsets.all(20),
                child: Center(
                  child: EstadoErro(
                    mensagem: erro.toString(),
                    onTentarDeNovo: () =>
                        ref.invalidate(agendaProvider(_chave)),
                  ),
                ),
              ),
              data: (dados) => _grade(dados, podeBloquear),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tiraDeDias() {
    final hoje = DateTime.now();
    final base = DateTime(hoje.year, hoje.month, hoje.day);
    final escala = MediaQuery.textScalerOf(context);
    final altura = escala.scale(11) * AppText.entrelinha +
        escala.scale(15) * AppText.entrelinha +
        24;

    return SizedBox(
      height: altura < 62 ? 62 : altura,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: 14,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final dia = base.add(Duration(days: i));
          return CartaoDia(
            rotulo: i == 0 ? "Hoje" : Formato.diaSemana(dia),
            numero: dia.day,
            ativo: dia == _dia,
            onTap: () => setState(() => _dia = dia),
          );
        },
      ),
    );
  }

  Widget _grade(AgendaDoDia agenda, bool podeBloquear) {
    if (agenda.quadras.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(20),
        child: EstadoVazio(
          titulo: "Nenhuma quadra ativa",
          descricao: "Cadastre ou reative uma quadra para ela ter agenda.",
        ),
      );
    }

    final alturaDaLinha = _alturaDaLinha(context);
    final faixa = agenda.faixaDeHoras;
    final horas = [
      for (var h = faixa.primeira; h <= faixa.ultima; h++) h,
    ];

    return RefreshIndicator(
      color: AppColors.coral,
      onRefresh: () async => ref.invalidate(agendaProvider(_chave)),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // A coluna das horas fica **fora** do scroll horizontal: rolar
            // as quadras sem ela perderia a referência de qual linha é qual
            // hora, que é a única âncora da grade.
            _colunaDeHoras(horas, alturaDaLinha),
            Expanded(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final quadra in agenda.quadras)
                      _colunaDaQuadra(
                        agenda,
                        quadra,
                        horas,
                        podeBloquear,
                        alturaDaLinha,
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _colunaDeHoras(List<int> horas, double altura) {
    return SizedBox(
      width: _larguraDaHora,
      child: Column(
        children: [
          // Altura do cabeçalho das colunas, para as linhas alinharem.
          const SizedBox(height: 40),
          for (final hora in horas)
            SizedBox(
              height: altura,
              child: Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.only(right: 8, top: 2),
                  child: Text(
                    "${hora.toString().padLeft(2, "0")}h",
                    style: AppText.rotulo(11),
                  ),
                ),
              ),
            ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _colunaDaQuadra(
    AgendaDoDia agenda,
    QuadraDaAgenda quadra,
    List<int> horas,
    bool podeBloquear,
    double altura,
  ) {
    return SizedBox(
      width: _larguraDaColuna,
      child: Column(
        children: [
          SizedBox(
            height: 40,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  quadra.nome,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: AppText.titulo(13),
                ),
              ),
            ),
          ),
          for (final hora in horas)
            _Celula(
              item: agenda.em(quadra.id, hora),
              // Uma reserva de duas horas desenha só na primeira linha; a
              // segunda fica vazia para não repetir o mesmo card.
              continuacao: _ehContinuacao(agenda, quadra.id, hora),
              altura: altura,
              onTap: podeBloquear ? () => _aoTocar(agenda, quadra, hora) : null,
            ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  bool _ehContinuacao(AgendaDoDia agenda, String quadraId, int hora) {
    final item = agenda.em(quadraId, hora);
    return item != null && item.horaDeInicio != hora;
  }

  Future<void> _aoTocar(
    AgendaDoDia agenda,
    QuadraDaAgenda quadra,
    int hora,
  ) async {
    final item = agenda.em(quadra.id, hora);

    if (item == null) {
      await _bloquear(quadra, hora);
      return;
    }
    if (item.ehBloqueio) {
      await _liberar(item);
      return;
    }
    // Reserva de cliente não vira bloqueio por um toque: quem tem horário
    // pago perde a vaga só pelo cancelamento, que cobra motivo e avisa.
    _aviso(
      "${item.horaInicio} está reservado"
      "${item.clienteNome == null ? "" : " por ${item.clienteNome}"}.",
    );
  }

  Future<void> _bloquear(QuadraDaAgenda quadra, int hora) async {
    final motivo = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FolhaDeBloqueio(quadra: quadra.nome, hora: hora),
    );
    if (motivo == null || !mounted) return;

    final inicio = DateTime(_dia.year, _dia.month, _dia.day, hora);
    try {
      await ref.read(gestaoRepositoryProvider).criarBloqueio(
            widget.estabelecimentoId,
            quadraId: quadra.id,
            inicio: inicio,
            fim: inicio.add(const Duration(hours: 1)),
            motivo: motivo,
          );
      if (!mounted) return;
      ref.invalidate(agendaProvider(_chave));
      _aviso("${quadra.nome} bloqueada às ${hora}h.");
    } catch (erro) {
      if (!mounted) return;
      _aviso(erro.toString());
    }
  }

  Future<void> _liberar(ItemAgenda bloqueio) async {
    final confirmou = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        backgroundColor: AppColors.white,
        title:
            Text("Liberar ${bloqueio.horaInicio}?", style: AppText.titulo(18)),
        content: Text(
          "O horário volta para a venda e os jogadores podem reservá-lo.",
          style: AppText.corpo(14, cor: AppColors.gray),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(false),
            child: Text("Manter bloqueado", style: AppText.corpo(14)),
          ),
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(true),
            child: Text(
              "Liberar",
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

    try {
      await ref
          .read(gestaoRepositoryProvider)
          .removerBloqueio(widget.estabelecimentoId, bloqueio.id);
      if (!mounted) return;
      ref.invalidate(agendaProvider(_chave));
      _aviso("${bloqueio.horaInicio} voltou para a venda.");
    } catch (erro) {
      if (!mounted) return;
      _aviso(erro.toString());
    }
  }
}

/// Uma célula da grade: livre, reservada ou bloqueada.
class _Celula extends StatelessWidget {
  const _Celula({
    required this.item,
    required this.continuacao,
    required this.altura,
    required this.onTap,
  });

  final ItemAgenda? item;
  final bool continuacao;
  final double altura;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (fundo, borda, texto, rotulo) = _aparencia();

    return Semantics(
      container: true,
      button: onTap != null,
      label: _descricao(),
      // Sem `excludeSemantics`, o rótulo da célula convive com o texto dos
      // filhos e o leitor anuncia "Lucas, R$ 80" em vez de "19:00 reservado
      // por Lucas" — o horário, que é a informação que falta, some.
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(2, 2, 2, 2),
        child: Material(
          color: fundo,
          borderRadius: BorderRadius.circular(10),
          child: InkWell(
            onTap: continuacao ? null : onTap,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              height: altura - 4,
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: borda),
              ),
              child: rotulo == null
                  ? null
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          rotulo,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.corpo(
                            11,
                            cor: texto,
                            peso: FontWeight.w700,
                          ),
                        ),
                        if (_apoio() != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            _apoio()!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.corpo(10, cor: texto),
                          ),
                        ],
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }

  (Color, Color, Color, String?) _aparencia() {
    final i = item;
    if (i == null) {
      return (AppColors.white, AppColors.line, AppColors.gray, null);
    }
    if (continuacao) {
      return (AppColors.sand, AppColors.line, AppColors.ink, null);
    }
    if (i.ehBloqueio) {
      return (
        AppColors.coralSoft,
        AppColors.coralSoft,
        AppColors.coralDeep,
        "Bloqueado"
      );
    }
    return (
      AppColors.sand,
      AppColors.line,
      AppColors.ink,
      i.clienteNome ?? "Reserva"
    );
  }

  String? _apoio() {
    final i = item;
    if (i == null || continuacao) return null;
    if (i.ehBloqueio) return i.motivo;
    return i.preco == null ? null : Formato.moeda(i.preco!);
  }

  /// O que o leitor de tela anuncia. Uma grade de células mudas seria
  /// intransitável: "botão, botão, botão" não diz que horário é qual.
  String _descricao() {
    final i = item;
    if (i == null) return "Horário livre";
    if (continuacao) return "Continuação de ${i.horaInicio}";
    if (i.ehBloqueio) {
      return "${i.horaInicio} bloqueado"
          "${i.motivo == null ? "" : ", ${i.motivo}"}";
    }
    return "${i.horaInicio} reservado"
        "${i.clienteNome == null ? "" : " por ${i.clienteNome}"}";
  }
}

/// Folha para confirmar o bloqueio e dar um motivo.
class _FolhaDeBloqueio extends StatefulWidget {
  const _FolhaDeBloqueio({required this.quadra, required this.hora});

  final String quadra;
  final int hora;

  @override
  State<_FolhaDeBloqueio> createState() => _FolhaDeBloqueioState();
}

class _FolhaDeBloqueioState extends State<_FolhaDeBloqueio> {
  final _motivo = TextEditingController();

  @override
  void dispose() {
    _motivo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        decoration: const BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Bloquear horário", style: AppText.titulo(19)),
            const SizedBox(height: 4),
            Text(
              "${widget.quadra} · ${widget.hora}h às ${widget.hora + 1}h",
              style: AppText.corpo(13, cor: AppColors.gray),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _motivo,
              autofocus: true,
              maxLength: 200,
              decoration: const InputDecoration(
                labelText: "Motivo (opcional)",
                hintText: "Manutenção da rede",
                counterText: "",
              ),
            ),
            const SizedBox(height: 14),
            BotaoPrimario(
              rotulo: "Bloquear",
              onPressed: () => Navigator.of(context).pop(_motivo.text.trim()),
            ),
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
    );
  }
}
