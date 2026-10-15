// SPDX-License-Identifier: AGPL-3.0-or-later
import "replay.dart";

abstract interface class ReplaysRepository {
  Future<List<Replay>> meus(PeriodoReplay periodo);
}
