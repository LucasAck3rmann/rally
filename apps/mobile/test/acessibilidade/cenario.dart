// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

/// Cenário comum das auditorias de acessibilidade.
///
/// A lista de telas mora aqui e não em cada teste: tela nova entra uma vez e
/// passa a ser cobrada por **todos** os gates — hoje o de texto ampliado e o
/// de leitor de tela. Foi essa duplicação que deixou telas sem verificação
/// até 30/09.
library;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:rally_mobile/features/auth/domain/auth_user.dart";
import "package:rally_mobile/features/auth/presentation/auth_providers.dart";
import "package:rally_mobile/features/auth/presentation/cadastro_page.dart";
import "package:rally_mobile/features/auth/presentation/login_page.dart";
import "package:rally_mobile/features/gestao/presentation/agenda_page.dart";
import "package:rally_mobile/features/gestao/presentation/gestao_providers.dart";
import "package:rally_mobile/features/gestao/presentation/painel_page.dart";
import "package:rally_mobile/features/gestao/presentation/quadra_form_page.dart";
import "package:rally_mobile/features/gestao/presentation/quadras_gestao_page.dart";
import "package:rally_mobile/features/home/presentation/home_page.dart";
import "package:rally_mobile/features/notificacoes/presentation/notificacoes_page.dart";
import "package:rally_mobile/features/notificacoes/presentation/notificacoes_providers.dart";
import "package:rally_mobile/features/perfil/presentation/perfil_page.dart";
import "package:rally_mobile/features/quadras/presentation/quadra_detalhe_page.dart";
import "package:rally_mobile/features/quadras/presentation/quadras_providers.dart";
import "package:rally_mobile/features/replays/presentation/replays_page.dart";
import "package:rally_mobile/features/replays/presentation/replays_providers.dart";
import "package:rally_mobile/features/reservas/domain/reserva.dart";
import "package:rally_mobile/features/reservas/presentation/checkout_page.dart";
import "package:rally_mobile/features/reservas/presentation/confirmacao_page.dart";
import "package:rally_mobile/features/reservas/presentation/minhas_reservas_page.dart";
import "package:rally_mobile/features/reservas/presentation/pagamento_pix_page.dart";
import "package:rally_mobile/features/reservas/presentation/reservas_providers.dart";
import "package:rally_mobile/features/splash/presentation/splash_page.dart";

import "../fakes/fake_auth_repository.dart";
import "../fakes/fake_gestao_repository.dart" as gestao;
import "../fakes/fake_notificacoes_repository.dart";
import "../fakes/fake_quadras_repository.dart";
import "../fakes/fake_replays_repository.dart";
import "../fakes/fake_reservas_repository.dart";

/// Uma tela do app com o que serve para achá-la quando ela falha.
typedef TelaDoApp = ({String nome, Widget Function() constroi, String ancora});

final quadraDeTeste = quadraFalsa(
  modalidades: const ["Beach tennis", "Futevôlei"],
);

/// Todas as telas do app, com um texto que prova que a tela carregou.
final telasDoApp = <TelaDoApp>[
  (
    nome: "Home",
    constroi: () => const Scaffold(body: HomePage()),
    ancora: "Arena Beach Sapiranga",
  ),
  (
    nome: "detalhe da quadra",
    constroi: () => const QuadraDetalhePage(quadraId: "q1"),
    ancora: "19:00",
  ),
  (
    nome: "checkout",
    constroi: () =>
        CheckoutPage(argumentos: (quadra: quadraDeTeste, slot: slotFalso(19))),
    ancora: "Total",
  ),
  (
    nome: "pagamento Pix",
    constroi: () => const PagamentoPixPage(reservaId: "r1"),
    ancora: "COPIAR",
  ),
  (
    nome: "confirmação",
    constroi: () => const ConfirmacaoPage(reservaId: "r1"),
    ancora: "Reserva confirmada!",
  ),
  (
    nome: "minhas reservas",
    constroi: () => const Scaffold(body: MinhasReservasPage()),
    ancora: "Arena Beira-Rio",
  ),
  (
    nome: "replays",
    constroi: () => const Scaffold(body: ReplaysPage()),
    ancora: "Ponto do jogo",
  ),
  (
    nome: "perfil",
    constroi: () => const Scaffold(body: PerfilPage()),
    ancora: "Lucas Ackermann",
  ),
  (
    nome: "notificações",
    constroi: () => const NotificacoesPage(),
    ancora: "Pagamento confirmado",
  ),
  (nome: "login", constroi: () => const LoginPage(), ancora: "Entrar"),
  (nome: "cadastro", constroi: () => const CadastroPage(), ancora: "Nome"),
  (nome: "splash", constroi: () => const SplashPage(), ancora: "Rally"),
  (
    nome: "gestão — seletor de estabelecimento",
    constroi: () => const GestaoPage(),
    ancora: "Arena Centro",
  ),
  (
    nome: "gestão — quadras",
    constroi: () => const QuadrasGestaoPage(estabelecimentoId: "e1"),
    ancora: "Quadra 2",
  ),
  (
    nome: "gestão — agenda do dia",
    constroi: () => const AgendaPage(estabelecimentoId: "e1"),
    ancora: "Agenda",
  ),
  (
    nome: "gestão — painel",
    constroi: () => const PainelPage(estabelecimentoId: "e1"),
    ancora: "Painel",
  ),
  (
    nome: "gestão — nova quadra",
    constroi: () => const QuadraFormPage(estabelecimentoId: "e1"),
    ancora: "Nova quadra",
  ),
  (
    nome: "gestão — editar quadra",
    constroi: () =>
        const QuadraFormPage(estabelecimentoId: "e1", quadraId: "q1"),
    ancora: "Editar quadra",
  ),
];

/// Bombeia quadros até [alvo] aparecer. Nada aqui usa `pumpAndSettle`: as
/// telas têm indicadores de progresso que nunca assentam.
Future<void> bombearAteSurgir(
  WidgetTester tester,
  Finder alvo, {
  int maximo = 40,
}) async {
  for (var i = 0; i < maximo; i++) {
    if (alvo.evaluate().isNotEmpty) return;
    await tester.pump(const Duration(milliseconds: 50));
  }
  fail("O alvo não apareceu depois de $maximo quadros: $alvo");
}

/// Monta [tela] com todos os repositórios falsos, em 360 × 1200 lógicos — a
/// tela mais estreita que o app atende.
Future<void> montarTela(
  WidgetTester tester,
  Widget tela, {
  double escalaTexto = 1.0,
}) async {
  if (escalaTexto != 1.0) {
    tester.platformDispatcher.textScaleFactorTestValue = escalaTexto;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  }
  tester.view.physicalSize = const Size(1080, 3600);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final router = GoRouter(
    initialLocation: "/tela",
    routes: [
      GoRoute(path: "/tela", builder: (_, __) => tela),
      // Destino genérico para as telas que empilham algo.
      GoRoute(
        path: "/adiante",
        builder: (_, __) => const Scaffold(body: Text("adiante")),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(
          FakeAuthRepository(
            sessaoInicial: const AuthUser(
              id: "u1",
              nome: "Lucas Ackermann",
              email: "lucas@rally.com.br",
            ),
          ),
        ),
        quadrasRepositoryProvider.overrideWithValue(
          FakeQuadrasRepository(
            quadras: [quadraDeTeste],
            slots: [slotFalso(19), slotFalso(20, disponivel: false)],
          ),
        ),
        promocaoDestaqueProvider.overrideWith((ref) async => null),
        reservasRepositoryProvider.overrideWithValue(
          FakeReservasRepository([
            reservaFalsa(pagamento: pagamentoFalso()),
            reservaFalsa(id: "r2", status: ReservaStatus.concluida),
          ]),
        ),
        replaysRepositoryProvider.overrideWithValue(
          FakeReplaysRepository([
            replayFalso(id: "rp1"),
            replayFalso(id: "rp2", titulo: "Defesa no fundo da quadra"),
          ]),
        ),
        notificacoesRepositoryProvider.overrideWithValue(
          FakeNotificacoesRepository([
            avisoFalso(id: "n1"),
            avisoFalso(id: "n2", idadeEmDias: 3, lida: true),
          ]),
        ),
        gestaoRepositoryProvider.overrideWithValue(
          gestao.FakeGestaoRepository(
            estabelecimentos: [
              gestao.estabelecimentoFalso(id: "e1"),
              gestao.estabelecimentoFalso(id: "e2", nome: "Arena Centro"),
            ],
            quadras: [
              gestao.quadraFalsa(faixas: 2),
              gestao.quadraFalsa(id: "q2", nome: "Quadra 2", ativo: false),
            ],
          )..agendaDoDia = gestao.agendaFalsa(
              itens: [
                gestao.itemDeAgendaFalso(hora: 19, clienteNome: "Augusto Boff"),
                gestao.itemDeAgendaFalso(
                  id: "a2",
                  hora: 20,
                  duracaoHoras: 2,
                  quadraId: "q2",
                ),
                gestao.itemDeAgendaFalso(
                  id: "b1",
                  hora: 9,
                  ehBloqueio: true,
                  motivo: "Manutenção da rede",
                ),
              ],
            ),
        ),
      ],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pump();
}
