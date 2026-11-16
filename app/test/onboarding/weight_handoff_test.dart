import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/onboarding/signup_progress.dart';
import 'package:sabzine_flutter/domain/onboarding/onboarding.dart';
import 'package:sabzine_flutter/features/plan/goal_hero.dart';
import 'package:sabzine_flutter/features/plan/goal_math.dart';
import 'package:sabzine_flutter/presentation/onboarding/after_answers.dart';
import 'package:sabzine_flutter/presentation/onboarding/signup_onboarding.dart';
import 'package:sabzine_flutter/presentation/session/live_plan.dart';

import 'onboarding_test.dart' show specJson;

ProfileSummary profile({double weight = 80.6, double? target = 73.3}) =>
    ProfileSummary(
      track: 'weight_loss',
      bmi: 29,
      weightKg: weight,
      targetWeightKg: target,
      heightCm: 165,
      age: 28,
      bmrKcal: 1500,
      tdeeKcal: 2100,
      targetKcal: 1755,
      proteinG: 132,
      carbsG: 194,
      fatG: 50,
      doctorOnly: false,
      safetyReasons: const [],
      consented: true,
    );

void showProfile(DemoStore store, {double weight = 80.6}) => showServerPlan(
  store,
  name: 'سارا',
  track: 'weight_loss',
  profile: profile(weight: weight),
);

class _TokenStorage implements AuthTokenStorage {
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String token) async {}
  @override
  Future<void> clear() async {}
}

void main() {
  test(
    'server onboarding replaces sample weight and history without rounding',
    () {
      final store = DemoStore();
      addTearDown(store.dispose);
      showProfile(store);

      expect(store.latestWeight, 80.6);
      expect(QuestionnaireData.number(store.questionnaire.weight), 80.6);
      expect(QuestionnaireData.number(store.questionnaire.targetWeight), 73.3);
      expect(store.weightEntries, [80.6]);
      expect(store.weightEntryDates, hasLength(1));
      expect(goalOf(store).current, 80.6);
      expect(goalOf(store).progress, 0);
    },
  );

  test('a real weight of 72 also replaces the sample history', () {
    final store = DemoStore();
    addTearDown(store.dispose);
    showProfile(store, weight: 72);
    expect(store.latestWeight, 72);
    expect(store.weightEntries, [72]);
  });

  test('refresh preserves later weight measurements and progress', () {
    var now = DateTime(2026, 11, 16);
    final store = DemoStore(clock: () => now);
    addTearDown(store.dispose);
    showProfile(store);
    now = now.add(const Duration(days: 7));
    store.addWeight(79.2);
    showProfile(store);

    expect(store.latestWeight, 79.2);
    expect(store.weightEntries, [80.6, 79.2]);
    expect(goalOf(store).progress, closeTo(1.4 / 7.3, .0001));
  });

  test('another login starts with that profile weight', () {
    final store = DemoStore();
    addTearDown(store.dispose);
    showProfile(store);
    store.addWeight(79.2);
    store.logout();
    showProfile(store);
    expect(store.latestWeight, 80.6);
    expect(store.weightEntries, [80.6]);
  });

  testWidgets('plan hero renders the onboarding weight and decimal target', (
    tester,
  ) async {
    final store = DemoStore();
    addTearDown(store.dispose);
    showProfile(store);
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(),
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            body: GoalHero(
              goal: goalOf(store),
              nutrition: nutritionOn(store, store.today),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('۸۰٫۶'), findsOneWidget);
    expect(find.text('به ۷۳٫۳ کیلو'), findsOneWidget);
    expect(find.text('۷۲'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('local signup keeps decimal weights in preview and app', (
    tester,
  ) async {
    final previousPreferences = SharedPreferencesAsyncPlatform.instance;
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    addTearDown(() {
      SharedPreferencesAsyncPlatform.instance = previousPreferences;
    });
    await SignupProgressStore().write(
      const SignupCheckpoint(
        track: 'lose',
        answers: {'weight_kg': 80.6, 'target_weight_kg': 73.3},
        stepKey: null,
        progress: 100,
        stage: 'phone',
        offeredIds: [],
      ),
    );
    final client = MockClient(
      (_) async => http.Response.bytes(utf8.encode(jsonEncode(specJson)), 200),
    );
    addTearDown(client.close);
    final store = DemoStore(
      customerAuth: CustomerAuth(
        baseUrl: 'https://example.test',
        storage: _TokenStorage(),
        client: client,
      ),
    )..login(AppRole.user);
    addTearDown(store.dispose);
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(),
        home: SignupOnboardingPage(store: store),
      ),
    );
    await tester.pumpAndSettle();
    final flow = tester.widget<AfterAnswersFlow>(find.byType(AfterAnswersFlow));
    expect(flow.weight, '۸۰٫۶');
    expect(await flow.onVerified(), isTrue);
    expect(store.latestWeight, 80.6);
    expect(QuestionnaireData.number(store.questionnaire.weight), 80.6);
    expect(QuestionnaireData.number(store.questionnaire.targetWeight), 73.3);
    expect(store.weightEntries, [80.6]);
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
