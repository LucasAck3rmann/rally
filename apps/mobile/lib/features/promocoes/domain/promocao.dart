/// Promoção em destaque na Home. Os textos já vêm prontos da API.
class PromocaoDestaque {
  const PromocaoDestaque({
    required this.codigo,
    required this.titulo,
    required this.chamada,
    required this.selo,
    required this.estabelecimento,
  });

  final String codigo;
  final String titulo;
  final String chamada;

  /// "%" ou "R$" — o que aparece dentro do círculo amarelo.
  final String selo;
  final String estabelecimento;

  factory PromocaoDestaque.doJson(Map<String, dynamic> json) {
    return PromocaoDestaque(
      codigo: json["codigo"] as String,
      titulo: json["titulo"] as String,
      chamada: json["chamada"] as String,
      selo: json["selo"] as String,
      estabelecimento: json["estabelecimento"] as String,
    );
  }
}
