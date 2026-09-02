import "package:intl/intl.dart";

/// Formatação de moeda e datas em pt-BR, como aparecem nas telas.
abstract final class Formato {
  static final _inteiro = NumberFormat.currency(
    locale: "pt_BR",
    symbol: r"R$",
    decimalDigits: 0,
  );
  static final _comCentavos = NumberFormat.currency(
    locale: "pt_BR",
    symbol: r"R$",
    decimalDigits: 2,
  );

  /// "R$ 80" para valores redondos, "R$ 76,50" quando há centavos —
  /// é assim que o preço aparece nos cards e na barra de reserva.
  static String moeda(double valor) {
    final texto = valor % 1 == 0 ? _inteiro.format(valor) : _comCentavos.format(valor);
    return texto.replaceAll("\u00A0", " ");
  }

  /// Sempre com centavos ("R$ 76,00"), usado no valor da cobrança Pix.
  static String moedaExata(double valor) =>
      _comCentavos.format(valor).replaceAll("\u00A0", " ");

  /// "Ter, 16/06"
  static String diaCurto(DateTime data) =>
      "${_capitalizar(DateFormat.E("pt_BR").format(data))}, ${DateFormat("dd/MM", "pt_BR").format(data)}";

  /// "Ter, 16 jun"
  static String diaPorExtenso(DateTime data) =>
      "${_capitalizar(DateFormat.E("pt_BR").format(data))}, ${DateFormat("d MMM", "pt_BR").format(data)}";

  /// "Ter" — rótulo do seletor de dias.
  static String diaSemana(DateTime data) =>
      _capitalizar(DateFormat.E("pt_BR").format(data));

  /// "19:00"
  static String hora(DateTime data) => DateFormat.Hm("pt_BR").format(data);

  /// "0:42" — duração de um replay.
  static String duracao(int segundos) {
    final minutos = segundos ~/ 60;
    final resto = segundos % 60;
    return "$minutos:${resto.toString().padLeft(2, "0")}";
  }

  /// "09:58" — contagem regressiva do Pix.
  static String contagem(Duration restante) {
    final minutos = restante.inMinutes.clamp(0, 99);
    final segundos = restante.inSeconds.remainder(60).clamp(0, 59);
    return "${minutos.toString().padLeft(2, "0")}:${segundos.toString().padLeft(2, "0")}";
  }

  /// Data-calendário "YYYY-MM-DD" para conversar com a API.
  static String dataIso(DateTime data) =>
      DateFormat("yyyy-MM-dd").format(data);

  static String _capitalizar(String texto) {
    final limpo = texto.replaceAll(".", "");
    if (limpo.isEmpty) return limpo;
    return limpo[0].toUpperCase() + limpo.substring(1);
  }
}
