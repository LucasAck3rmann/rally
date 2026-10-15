// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/formato.dart";
import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/barra_inferior.dart";
import "../../../core/widgets/brand_bar.dart";
import "../../../core/widgets/rally_chip.dart";
import "../../../core/widgets/secao.dart";
import "../domain/gestao.dart";
import "gestao_providers.dart";

/// Cadastro e edição de quadra (RF-20).
///
/// A mesma tela serve aos dois casos: com [quadraId] ela carrega a quadra e
/// salva por `PATCH`; sem ele, cadastra por `POST`. Separar em duas telas
/// duplicaria o formulário inteiro para mudar um verbo HTTP.
class QuadraFormPage extends ConsumerWidget {
  const QuadraFormPage({
    super.key,
    required this.estabelecimentoId,
    this.quadraId,
  });

  final String estabelecimentoId;

  /// `null` = cadastro.
  final String? quadraId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (quadraId == null) {
      return _FormularioQuadra(estabelecimentoId: estabelecimentoId);
    }

    final chave = (estabelecimentoId: estabelecimentoId, quadraId: quadraId!);
    final quadra = ref.watch(quadraGestaoProvider(chave));

    return quadra.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.coral)),
      ),
      error: (erro, _) => Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(20),
          child: Center(
            child: EstadoErro(
              mensagem: erro.toString(),
              onTentarDeNovo: () => ref.invalidate(quadraGestaoProvider(chave)),
            ),
          ),
        ),
      ),
      data: (q) => _FormularioQuadra(
        estabelecimentoId: estabelecimentoId,
        quadra: q,
      ),
    );
  }
}

/// Modalidades que o produto oferece hoje. Vêm de uma lista fixa porque a
/// API valida contra as modalidades já cadastradas — digitar livre viraria
/// 400 na cara do usuário.
const _modalidades = ["Beach Tennis", "Futevôlei", "Vôlei", "Beach Soccer"];

const _comodidades = [
  "Vestiário",
  "Estacionamento",
  "Bar",
  "Iluminação",
  "Cobertura",
  "Aluguel de raquete",
  "Wi-Fi",
  "Acessibilidade",
];

class _FormularioQuadra extends ConsumerStatefulWidget {
  const _FormularioQuadra({required this.estabelecimentoId, this.quadra});

  final String estabelecimentoId;
  final QuadraGestao? quadra;

  @override
  ConsumerState<_FormularioQuadra> createState() => _FormularioQuadraState();
}

class _FormularioQuadraState extends ConsumerState<_FormularioQuadra> {
  final _formulario = GlobalKey<FormState>();
  late final TextEditingController _nome;
  late final TextEditingController _descricao;
  late final TextEditingController _preco;
  late final TextEditingController _capacidade;

  late List<String> _modalidadesEscolhidas;
  late List<String> _comodidadesEscolhidas;
  late List<_LinhaEditavel> _faixas;

  /// Contador das chaves das linhas de faixa. Uma faixa recém-composta
  /// não tem id do banco, e sem identidade estável o campo de texto é
  /// destruído e recriado a cada tecla — perdendo foco e cursor.
  int _proximaChave = 0;

  bool _salvando = false;
  String? _erro;

  bool get _editando => widget.quadra != null;

  @override
  void initState() {
    super.initState();
    final q = widget.quadra;
    _nome = TextEditingController(text: q?.nome ?? "");
    _descricao = TextEditingController(text: q?.descricao ?? "");
    _preco = TextEditingController(
      text: q == null ? "" : Formato.numeroSimples(q.precoHora),
    );
    _capacidade = TextEditingController(text: q?.capacidade?.toString() ?? "");
    _modalidadesEscolhidas = [...?q?.modalidades];
    _comodidadesEscolhidas = [...?q?.comodidades];
    _faixas = [
      for (final f in q?.faixasPreco ?? const <FaixaPreco>[]) _nova(f),
    ];
  }

  _LinhaEditavel _nova(FaixaPreco faixa) =>
      (chave: ValueKey("faixa-${_proximaChave++}"), faixa: faixa);

  @override
  void dispose() {
    _nome.dispose();
    _descricao.dispose();
    _preco.dispose();
    _capacidade.dispose();
    super.dispose();
  }

  Future<void> _salvar() async {
    // A modalidade não é um campo de texto, então não entra no `validate()`
    // do formulário — é conferida aqui, antes de gastar uma ida à rede.
    if (!_formulario.currentState!.validate()) return;
    if (_modalidadesEscolhidas.isEmpty) {
      setState(() => _erro = "Escolha ao menos uma modalidade.");
      return;
    }

    final dados = DadosQuadra(
      nome: _nome.text.trim(),
      precoHora: _paraNumero(_preco.text)!,
      modalidades: _modalidadesEscolhidas,
      descricao: _descricao.text.trim(),
      capacidade: int.tryParse(_capacidade.text.trim()),
      comodidades: _comodidadesEscolhidas,
      faixasPreco: [for (final l in _faixas) l.faixa],
    );

    setState(() {
      _salvando = true;
      _erro = null;
    });
    try {
      final repo = ref.read(gestaoRepositoryProvider);
      final salva = _editando
          ? await repo.atualizarQuadra(
              widget.estabelecimentoId,
              widget.quadra!.id,
              dados,
            )
          : await repo.criarQuadra(widget.estabelecimentoId, dados);
      if (!mounted) return;

      ref.invalidate(quadrasGestaoProvider(widget.estabelecimentoId));
      ref.invalidate(meusEstabelecimentosProvider);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: AppColors.ink,
            content: Text(
              _editando
                  ? "${salva.nome} atualizada."
                  : "${salva.nome} entrou na vitrine.",
            ),
          ),
        );
      context.pop();
    } catch (erro) {
      if (!mounted) return;
      // O conflito de faixas de preço chega por aqui: quem decide se duas
      // janelas se sobrepõem é o servidor, e a mensagem dele é específica.
      setState(() {
        _salvando = false;
        _erro = erro.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Form(
        key: _formulario,
        child: ListView(
          padding: EdgeInsets.zero,
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
                          sufixo: "· quadra",
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _editando ? "Editar quadra" : "Nova quadra",
                    style: AppText.titulo(24),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _editando
                        ? "As mudanças valem para as próximas reservas."
                        : "Ela entra na busca dos jogadores assim que salvar.",
                    style: AppText.corpo(
                      13,
                      cor: AppColors.gray,
                      peso: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _campoNome(),
                  const SizedBox(height: 14),
                  _campoPreco(),
                  const SizedBox(height: 14),
                  _campoCapacidade(),
                  const SizedBox(height: 14),
                  _campoDescricao(),
                  const SizedBox(height: 22),
                  const CabecalhoSecao(titulo: "Modalidades"),
                  const SizedBox(height: 4),
                  Text(
                    "Ao menos uma. É por elas que a quadra é encontrada.",
                    style: AppText.corpo(13, cor: AppColors.gray),
                  ),
                  const SizedBox(height: 12),
                  _chips(
                    opcoes: _modalidades,
                    escolhidas: _modalidadesEscolhidas,
                    limite: 10,
                    aoMudar: (lista) => setState(() {
                      _modalidadesEscolhidas = lista;
                      _erro = null;
                    }),
                  ),
                  const SizedBox(height: 22),
                  const CabecalhoSecao(titulo: "Comodidades"),
                  const SizedBox(height: 12),
                  _chips(
                    opcoes: _comodidades,
                    escolhidas: _comodidadesEscolhidas,
                    limite: 20,
                    aoMudar: (lista) =>
                        setState(() => _comodidadesEscolhidas = lista),
                  ),
                  const SizedBox(height: 22),
                  _secaoFaixas(),
                  if (_erro != null) ...[
                    const SizedBox(height: 18),
                    _avisoErro(_erro!),
                  ],
                  const SizedBox(height: 22),
                  BotaoPrimario(
                    rotulo:
                        _editando ? "Salvar alterações" : "Cadastrar quadra",
                    carregando: _salvando,
                    onPressed: _salvando ? null : _salvar,
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _campoNome() {
    return TextFormField(
      controller: _nome,
      textInputAction: TextInputAction.next,
      maxLength: 80,
      decoration: const InputDecoration(
        labelText: "Nome da quadra",
        hintText: "Quadra 1",
        counterText: "",
      ),
      validator: (valor) {
        final texto = (valor ?? "").trim();
        if (texto.length < 2) return "O nome precisa de ao menos 2 letras.";
        if (texto.length > 80) return "No máximo 80 caracteres.";
        return null;
      },
    );
  }

  Widget _campoPreco() {
    return TextFormField(
      controller: _preco,
      textInputAction: TextInputAction.next,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r"[0-9.,]")),
      ],
      decoration: const InputDecoration(
        labelText: "Preço por hora (R\$)",
        hintText: "80",
        helperText: "Vale quando nenhuma faixa cobre o horário.",
      ),
      validator: (valor) {
        final numero = _paraNumero(valor ?? "");
        if (numero == null) return "Informe um valor, como 80 ou 76,50.";
        if (numero < 0) return "O preço não pode ser negativo.";
        if (numero > 100000) return "Valor acima do permitido.";
        return null;
      },
    );
  }

  Widget _campoCapacidade() {
    return TextFormField(
      controller: _capacidade,
      textInputAction: TextInputAction.next,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      decoration: const InputDecoration(
        labelText: "Capacidade (opcional)",
        hintText: "4",
      ),
      validator: (valor) {
        final texto = (valor ?? "").trim();
        if (texto.isEmpty) return null;
        final numero = int.tryParse(texto);
        if (numero == null || numero < 1 || numero > 100) {
          return "Entre 1 e 100 pessoas.";
        }
        return null;
      },
    );
  }

  Widget _campoDescricao() {
    return TextFormField(
      controller: _descricao,
      maxLines: 3,
      maxLength: 500,
      decoration: const InputDecoration(
        labelText: "Descrição (opcional)",
        hintText: "Areia fina, iluminação de LED, rede nova.",
      ),
      validator: (valor) => (valor ?? "").trim().length > 500
          ? "No máximo 500 caracteres."
          : null,
    );
  }

  Widget _chips({
    required List<String> opcoes,
    required List<String> escolhidas,
    required int limite,
    required ValueChanged<List<String>> aoMudar,
  }) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final opcao in opcoes)
          RallyChip(
            rotulo: opcao,
            ativo: escolhidas.contains(opcao),
            onTap: () {
              final nova = [...escolhidas];
              if (nova.remove(opcao)) {
                aoMudar(nova);
              } else if (nova.length < limite) {
                aoMudar([...nova, opcao]);
              }
            },
          ),
      ],
    );
  }

  Widget _secaoFaixas() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const CabecalhoSecao(titulo: "Faixas de preço"),
        const SizedBox(height: 4),
        Text(
          "Cobram diferente numa janela do dia — horário nobre, por exemplo. "
          "Duas faixas não podem se sobrepor.",
          style: AppText.corpo(13, cor: AppColors.gray),
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < _faixas.length; i++) ...[
          _LinhaFaixa(
            key: _faixas[i].chave,
            faixa: _faixas[i].faixa,
            aoMudar: (nova) => setState(() {
              _faixas = [
                for (var j = 0; j < _faixas.length; j++)
                  if (j == i)
                    (chave: _faixas[j].chave, faixa: nova)
                  else
                    _faixas[j],
              ];
              _erro = null;
            }),
            aoRemover: () => setState(() {
              _faixas = [..._faixas]..removeAt(i);
              _erro = null;
            }),
          ),
          const SizedBox(height: 10),
        ],
        if (_faixas.length < 12)
          TextButton.icon(
            onPressed: () => setState(() {
              _faixas = [
                ..._faixas,
                _nova(
                  const FaixaPreco(
                    horaInicio: "18:00",
                    horaFim: "22:00",
                    precoHora: 0,
                  ),
                ),
              ];
              _erro = null;
            }),
            style: TextButton.styleFrom(minimumSize: const Size(44, 44)),
            // Não há "+" no conjunto do Figma; até haver, o ícone do
            // Material diz a mesma coisa sem inventar um símbolo novo.
            icon: const Icon(
              Icons.add_rounded,
              size: 18,
              color: AppColors.coralDeep,
            ),
            label: Text(
              "Adicionar faixa",
              style: AppText.corpo(
                14,
                cor: AppColors.coralDeep,
                peso: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }

  Widget _avisoErro(String mensagem) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.coralSoft,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        mensagem,
        style: AppText.corpo(13, cor: AppColors.coralDeep),
      ),
    );
  }
}

/// Uma faixa e a chave que a identifica enquanto o formulário está
/// aberto — o id do banco só existe depois de salvar.
typedef _LinhaEditavel = ({Key chave, FaixaPreco faixa});

/// Uma faixa de preço na lista: dia, janela e valor.
class _LinhaFaixa extends StatelessWidget {
  const _LinhaFaixa({
    super.key,
    required this.faixa,
    required this.aoMudar,
    required this.aoRemover,
  });

  final FaixaPreco faixa;
  final ValueChanged<FaixaPreco> aoMudar;
  final VoidCallback aoRemover;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<int?>(
                  initialValue: faixa.diaSemana,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: "Dia",
                    isDense: true,
                  ),
                  items: const [
                    DropdownMenuItem(value: null, child: Text("Todos os dias")),
                    DropdownMenuItem(value: 0, child: Text("Domingo")),
                    DropdownMenuItem(value: 1, child: Text("Segunda")),
                    DropdownMenuItem(value: 2, child: Text("Terça")),
                    DropdownMenuItem(value: 3, child: Text("Quarta")),
                    DropdownMenuItem(value: 4, child: Text("Quinta")),
                    DropdownMenuItem(value: 5, child: Text("Sexta")),
                    DropdownMenuItem(value: 6, child: Text("Sábado")),
                  ],
                  onChanged: (dia) => aoMudar(faixa.copiarCom(diaSemana: dia)),
                ),
              ),
              IconButton(
                tooltip: "Remover faixa",
                onPressed: aoRemover,
                icon: const Icon(
                  Icons.close_rounded,
                  size: 20,
                  color: AppColors.coralDeep,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.only(right: 6),
            child: Row(
              children: [
                Expanded(
                  child: _CampoHora(
                    rotulo: "Início",
                    valor: faixa.horaInicio,
                    aoMudar: (h) => aoMudar(faixa.copiarCom(horaInicio: h)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _CampoHora(
                    rotulo: "Fim",
                    valor: faixa.horaFim,
                    aoMudar: (h) => aoMudar(faixa.copiarCom(horaFim: h)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    initialValue: Formato.numeroSimples(faixa.precoHora),
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r"[0-9.,]")),
                    ],
                    decoration: const InputDecoration(
                      labelText: "R\$/h",
                      isDense: true,
                    ),
                    validator: (valor) =>
                        _paraNumero(valor ?? "") == null ? "?" : null,
                    onChanged: (valor) {
                      final numero = _paraNumero(valor);
                      if (numero != null) {
                        aoMudar(faixa.copiarCom(precoHora: numero));
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Campo de hora no formato `HH:mm`, que é o que o `FaixaPrecoDto` aceita.
class _CampoHora extends StatelessWidget {
  const _CampoHora({
    required this.rotulo,
    required this.valor,
    required this.aoMudar,
  });

  final String rotulo;
  final String valor;
  final ValueChanged<String> aoMudar;

  static final _formato = RegExp(r"^([01]\d|2[0-3]):[0-5]\d$");

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      initialValue: valor,
      keyboardType: TextInputType.datetime,
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r"[0-9:]")),
        LengthLimitingTextInputFormatter(5),
      ],
      decoration: InputDecoration(labelText: rotulo, isDense: true),
      validator: (v) => _formato.hasMatch(v ?? "") ? null : "HH:mm",
      onChanged: aoMudar,
    );
  }
}

/// Lê o que o usuário digitou como número. Devolve `null` quando não dá.
///
/// Com vírgula, o ponto é separador de milhar ("1.250,50"); sem vírgula, o
/// ponto é o decimal ("76.50"). Tratar o ponto sempre como milhar
/// transformaria "76.50" em 7650 — o preço errado por duas casas.
double? _paraNumero(String texto) {
  final cru = texto.trim();
  if (cru.isEmpty) return null;
  final limpo =
      cru.contains(",") ? cru.replaceAll(".", "").replaceAll(",", ".") : cru;
  return double.tryParse(limpo);
}
