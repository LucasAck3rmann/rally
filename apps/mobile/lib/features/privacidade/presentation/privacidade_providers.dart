// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/dio_provider.dart";
import "../data/privacidade_repository_impl.dart";
import "../domain/privacidade_repository.dart";

final privacidadeRepositoryProvider = Provider<PrivacidadeRepository>(
  (ref) => PrivacidadeRepositoryImpl(ref.watch(dioProvider)),
);
