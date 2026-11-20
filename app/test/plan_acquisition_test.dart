import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/plan/plan_states.dart';
import 'package:sabzine_flutter/presentation/screens/wallet_flow.dart';
import 'package:sabzine_flutter/presentation/widgets/kit/pill_button.dart';

import 'customer_auth_test.dart' show TokenMemory;
import 'operation_states_test.dart' show statusHost;
import 'widget_test.dart' show mobile;

class AcquisitionServer {
  final paths = <String>[];
  bool paid = true, failRecovery = false;
  String status = 'in_review';
  Completer<void>? gate;

  late final client = MockClient((request) async {
    final path = request.url.path.replaceFirst('/v1/', '');
    paths.add('${request.method} $path');
    if (path == 'me/plan/recover') {
      await gate?.future;
      if (failRecovery) {
        return http.Response(
          jsonEncode({'messageFa': 'ارتباط قطع شد؛ دوباره تلاش کن.'}),
          503,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }
      if (paid) status = 'generating';
    }
    final data = switch (path) {
      'me/plan/recover' || 'me/request' =>
        paid
            ? {'id': 'paid-request', 'status': status, 'kind': 'new_plan'}
            : null,
      'me/plan' => null,
      'me' => {'displayName': 'سارا'},
      'me/wallet' => {'cashToman': 0, 'promoToman': 0},
      'me/subscription' => {'subscription': null},
      'me/orders' => [],
      'catalog' => {
        'services': [
          {'code': 'new_plan', 'title': 'برنامه', 'priceToman': 1990000},
        ],
        'topups': [],
        'plans': [],
      },
      _ => throw StateError('Unexpected request: $path'),
    };
    return http.Response(
      data == null ? '' : jsonEncode(data),
      200,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
  });

  DemoStore store() {
    final auth =
        CustomerAuth(
            baseUrl: 'https://example.test',
            storage: TokenMemory(),
            client: client,
          )
          ..session = CustomerSession.fromJson({
            'accessToken': 'test-token',
            'sessionExpiresAt': '2099-01-01T00:00:00Z',
            'role': 'user',
          });
    return DemoStore(customerAuth: auth)
      ..login(AppRole.user)
      ..questionnaireComplete = true
      ..liveReady = true
      ..questionnaire.weight = '۸۱٫۵';
  }
}

void main() {
  testWidgets(
    'signed-in customer recovers paid plan using saved answers once',
    (tester) async {
      mobile(tester);
      final server = AcquisitionServer()..gate = Completer<void>();
      final store = server.store();
      addTearDown(store.dispose);
      addTearDown(server.client.close);
      await tester.pumpWidget(statusHost(store, const PlanEmpty()));
      await tester.pumpAndSettle();
      final button = tester.widget<PillButton>(
        find.widgetWithText(PillButton, 'دریافت برنامه'),
      );
      button.onPressed!();
      button.onPressed!();
      await tester.pump();
      expect(
        tester.widget<PillButton>(find.byType(PillButton)).loading,
        isTrue,
      );
      expect(store.walletPricingOpen, isTrue);
      server.gate!.complete();
      await tester.pumpAndSettle();
      expect(
        server.paths.where((p) => p == 'POST me/plan/recover'),
        hasLength(1),
      );
      expect(store.userRequest.id, 'paid-request');
      expect(store.userRequest.status, PlanStatus.generating);
      expect(store.questionnaire.weight, '۸۱٫۵');
      expect(find.byType(PlanServicesScreen), findsNothing);
      expect(server.paths.any((p) => p.contains('checkouts')), isFalse);
      expect(server.paths.any((p) => p.contains('onboarding')), isFalse);
      expect(store.walletPricingOpen, isFalse);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('failed recovery remains retryable without opening payment', (
    tester,
  ) async {
    mobile(tester);
    final server = AcquisitionServer()..failRecovery = true;
    final store = server.store();
    addTearDown(store.dispose);
    addTearDown(server.client.close);
    await tester.pumpWidget(statusHost(store, const PlanEmpty()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('دریافت برنامه'));
    await tester.pumpAndSettle();
    expect(find.text('ارتباط قطع شد؛ دوباره تلاش کن.'), findsOneWidget);
    expect(find.byType(PlanServicesScreen), findsNothing);
    expect(store.walletPricingOpen, isFalse);
    server.failRecovery = false;
    await tester.tap(find.text('دریافت برنامه'));
    await tester.pumpAndSettle();
    expect(store.userRequest.status, PlanStatus.generating);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('unpaid customer continues to plans without repeating answers', (
    tester,
  ) async {
    mobile(tester);
    final server = AcquisitionServer()..paid = false;
    final store = server.store();
    addTearDown(store.dispose);
    addTearDown(server.client.close);
    await tester.pumpWidget(statusHost(store, const PlanEmpty()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('دریافت برنامه'));
    await tester.pumpAndSettle();
    expect(find.byType(PlanServicesScreen), findsOneWidget);
    expect(store.hasUserRequest, isFalse);
    expect(store.questionnaire.weight, '۸۱٫۵');
    expect(server.paths.any((p) => p.contains('onboarding')), isFalse);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  test('missing server answers resume server onboarding after login', () {
    final server = AcquisitionServer();
    final store = server.store()..questionnaireComplete = false;
    addTearDown(store.dispose);
    addTearDown(server.client.close);
    store.startPlanAcquisition();
    expect(store.userSignedIn, isTrue);
    expect(store.liveReady, isFalse);
    expect(store.entryStage, EntryStage.home);
    expect(store.pendingPlanAcquisition, isTrue);
  });
}
