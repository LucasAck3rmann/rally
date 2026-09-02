import "replay.dart";

abstract interface class ReplaysRepository {
  Future<List<Replay>> meus(PeriodoReplay periodo);
}
