/// Situação da reserva, espelhando o enum da API.
enum ReservaStatus {
  pendentePagamento,
  confirmada,
  cancelada,
  concluida,
  noShow,
  bloqueio;

  static ReservaStatus doTexto(String valor) => switch (valor) {
        "PENDENTE_PAGAMENTO" => ReservaStatus.pendentePagamento,
        "CONFIRMADA" => ReservaStatus.confirmada,
        "CANCELADA" => ReservaStatus.cancelada,
        "CONCLUIDA" => ReservaStatus.concluida,
        "NO_SHOW" => ReservaStatus.noShow,
        _ => ReservaStatus.bloqueio,
      };

  String get rotulo => switch (this) {
        ReservaStatus.pendentePagamento => "Aguardando pagamento",
        ReservaStatus.confirmada => "Confirmada",
        ReservaStatus.cancelada => "Cancelada",
        ReservaStatus.concluida => "Concluída",
        ReservaStatus.noShow => "Não compareceu",
        ReservaStatus.bloqueio => "Bloqueada",
      };
}

enum PagamentoStatus {
  pendente,
  pago,
  expirado,
  estornado,
  falhou;

  static PagamentoStatus doTexto(String valor) => switch (valor) {
        "PAGO" => PagamentoStatus.pago,
        "EXPIRADO" => PagamentoStatus.expirado,
        "ESTORNADO" => PagamentoStatus.estornado,
        "FALHOU" => PagamentoStatus.falhou,
        _ => PagamentoStatus.pendente,
      };
}

/// Cobrança ligada à reserva. No Pix, traz o copia e cola e a expiração.
class Pagamento {
  const Pagamento({
    required this.id,
    required this.valor,
    required this.metodo,
    required this.status,
    this.pixCopiaCola,
    this.qrCodeUrl,
    this.expiraEm,
  });

  final String id;
  final double valor;

  /// "PIX" ou "CARTAO".
  final String metodo;
  final PagamentoStatus status;
  final String? pixCopiaCola;
  final String? qrCodeUrl;
  final DateTime? expiraEm;

  bool get pago => status == PagamentoStatus.pago;

  factory Pagamento.doJson(Map<String, dynamic> json) {
    final expira = json["expiraEm"] as String?;
    return Pagamento(
      id: json["id"] as String,
      valor: (json["valor"] as num).toDouble(),
      metodo: json["metodo"] as String,
      status: PagamentoStatus.doTexto(json["status"] as String),
      pixCopiaCola: json["pixCopiaCola"] as String?,
      qrCodeUrl: json["qrCodeUrl"] as String?,
      expiraEm: expira == null ? null : DateTime.parse(expira).toLocal(),
    );
  }
}

/// Reserva do cliente, com a quadra e a cobrança embutidas.
class Reserva {
  const Reserva({
    required this.id,
    required this.codigo,
    required this.inicio,
    required this.fim,
    required this.horaInicio,
    required this.horaFim,
    required this.status,
    required this.preco,
    required this.quadraId,
    required this.quadraNome,
    required this.estabelecimentoNome,
    required this.modalidades,
    required this.fotos,
    required this.cancelavel,
    required this.cancelamentoGratuito,
    required this.cancelamentoHoras,
    this.canceladaEm,
    this.pagamento,
  });

  final String id;

  /// Código curto do comprovante, ex.: "RALLY-7K2P".
  final String codigo;
  final DateTime inicio;
  final DateTime fim;

  /// Horas já no fuso do estabelecimento ("19:00" / "20:00").
  final String horaInicio;
  final String horaFim;
  final ReservaStatus status;
  final double preco;
  final String quadraId;
  final String quadraNome;
  final String estabelecimentoNome;
  final List<String> modalidades;
  final List<String> fotos;

  /// Quem decide é a API: reserva ativa e horário ainda no futuro (RF-09).
  final bool cancelavel;

  /// Dentro da janela de cancelamento do estabelecimento (RN-02).
  final bool cancelamentoGratuito;

  /// Tamanho dessa janela, em horas — o texto da tela usa este número.
  final int cancelamentoHoras;
  final DateTime? canceladaEm;
  final Pagamento? pagamento;

  String get faixaHoraria => "$horaInicio – $horaFim";
  String? get foto => fotos.isEmpty ? null : fotos.first;

  /// O que o cliente efetivamente paga (com desconto do Pix, quando houver).
  double get valorAPagar => pagamento?.valor ?? preco;

  factory Reserva.doJson(Map<String, dynamic> json) {
    final quadra = json["quadra"] as Map<String, dynamic>;
    final estabelecimento = quadra["estabelecimento"] as Map<String, dynamic>;
    final pagamento = json["pagamento"] as Map<String, dynamic>?;
    final cancelada = json["canceladaEm"] as String?;

    return Reserva(
      id: json["id"] as String,
      codigo: json["codigo"] as String,
      inicio: DateTime.parse(json["inicio"] as String).toLocal(),
      fim: DateTime.parse(json["fim"] as String).toLocal(),
      horaInicio: json["horaInicio"] as String,
      horaFim: json["horaFim"] as String,
      status: ReservaStatus.doTexto(json["status"] as String),
      preco: (json["preco"] as num).toDouble(),
      quadraId: quadra["id"] as String,
      quadraNome: quadra["nome"] as String,
      estabelecimentoNome: estabelecimento["nome"] as String,
      modalidades: (quadra["modalidades"] as List?)?.cast<String>() ?? const [],
      fotos: (quadra["fotos"] as List?)?.cast<String>() ?? const [],
      cancelavel: json["cancelavel"] as bool? ?? false,
      cancelamentoGratuito: json["cancelamentoGratuito"] as bool? ?? false,
      cancelamentoHoras: (json["cancelamentoHoras"] as num?)?.toInt() ?? 0,
      canceladaEm:
          cancelada == null ? null : DateTime.parse(cancelada).toLocal(),
      pagamento: pagamento == null ? null : Pagamento.doJson(pagamento),
    );
  }
}
