import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/domain/onboarding/onboarding.dart';
import 'package:sabzine_flutter/domain/onboarding/spec.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_companion.dart';
import 'package:sabzine_flutter/features/home/home_day_focus.dart';
import 'package:sabzine_flutter/features/home/home_tab.dart';
import 'package:sabzine_flutter/features/plan/meal_detail_page.dart';
import 'package:sabzine_flutter/presentation/onboarding/controller.dart';
import 'package:sabzine_flutter/presentation/onboarding/onboarding_flow.dart';

import 'onboarding/onboarding_test.dart' show FakeOnboarding, specJson;

Widget host(Widget child, {bool reduced = true, double textScale = 1}) =>
    MaterialApp(
      theme: appTheme(),
      builder: (context, body) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          disableAnimations: reduced,
          textScaler: TextScaler.linear(textScale),
        ),
        child: Directionality(textDirection: TextDirection.rtl, child: body!),
      ),
      home: Scaffold(body: child),
    );

void main() {
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
  });
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test(
    'day focus follows meal times and records without consuming earlier meals',
    () async {
      var now = DateTime(2026, 11, 9, 7);
      final store = DemoStore(clock: () => now)..loginDemoUser();
      addTearDown(store.dispose);
      store.approveActiveUserRequest();
      final morning = HomeDayFocus.from(store);
      expect(morning.next!.index, 0);
      now = DateTime(2026, 11, 9, 12, 30);
      final midday = HomeDayFocus.from(store);
      expect(midday.next!.index, 1);
      expect(midday.completed, 0);
      expect(store.mealEaten(now, 0), isFalse);
      await store.setMealEaten(now, 1, true);
      final afterMeal = HomeDayFocus.from(store);
      expect(afterMeal.completed, 1);
      expect(afterMeal.next!.index, isNot(1));
      expect(afterMeal.title, 'قدم بعدی امروزت');
      now = DateTime(2026, 11, 9, 22);
      expect(HomeDayFocus.from(store).review, isTrue);
      expect(HomeDayFocus.from(store).title, 'امروزت در یک نگاه');
    },
  );

  test(
    'profile revisit preserves answers and refuses hidden or unanswered steps',
    () {
      final c = OnboardingController(
        repository: FakeOnboarding(),
        spec: OnboardingSpec.fromJson(specJson),
        state: const OnboardingState(
          nextStep: NextStep.start,
          claimedFromDemo: false,
          track: null,
          missing: [],
        ),
      );
      addTearDown(c.dispose);
      c.setTrack('lose');
      c.setAnswer('weight', 70);
      c.setAnswer('target_weight', 65);
      c.setAnswer('conditions', ['none']);
      expect(c.revisit('insulin'), isFalse);
      expect(c.revisit('weight'), isTrue);
      expect(c.current.id, 'weight');
      expect(c.answer('target_weight'), 65);
      c.setAnswer('conditions', ['diabetes']);
      expect(c.revisit('insulin'), isFalse);
      c.setAnswer('insulin', 'no');
      expect(c.revisit('insulin'), isTrue);
      c.setAnswer('conditions', ['none']);
      expect(c.revisit('insulin'), isFalse);
    },
  );

  testWidgets('profile sheet opens a previous answer while keeping the rest', (
    tester,
  ) async {
    final c = OnboardingController(
      repository: FakeOnboarding(),
      spec: OnboardingSpec.fromJson(specJson),
      state: const OnboardingState(
        nextStep: NextStep.start,
        claimedFromDemo: false,
        track: null,
        missing: [],
      ),
    );
    c.setTrack('lose');
    c.setAnswer('weight', 70);
    c.setAnswer('target_weight', 65);
    c.next();
    await tester.pumpWidget(
      host(OnboardingFlow(controller: c, onDone: (_) {})),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('onboarding-profile-preview')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('وزن هدف'));
    await tester.pumpAndSettle();
    expect(c.current.id, 'target_weight');
    expect(c.answer('weight'), 70);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });

  testWidgets('home details route returns to the same scroll position', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final store = DemoStore(clock: () => DateTime(2026, 11, 9, 12, 30))
      ..loginDemoUser();
    store.approveActiveUserRequest();
    await tester.pumpWidget(
      DemoScope(store: store, child: host(const HomeTab(), reduced: false)),
    );
    await tester.pumpAndSettle();
    final list = find.byKey(const ValueKey('home-tab'));
    await tester.drag(list, const Offset(0, -100));
    await tester.pumpAndSettle();
    final position = tester
        .state<ScrollableState>(
          find.descendant(of: list, matching: find.byType(Scrollable)).first,
        )
        .position
        .pixels;
    await tester.tap(find.byKey(const ValueKey('home-meal-details')));
    await tester.pumpAndSettle();
    expect(find.byType(MealDetailPage), findsOneWidget);
    Navigator.of(tester.element(find.byType(MealDetailPage))).pop();
    await tester.pumpAndSettle();
    expect(
      tester
          .state<ScrollableState>(
            find.descendant(of: list, matching: find.byType(Scrollable)).first,
          )
          .position
          .pixels,
      position,
    );
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets('home and companion fit a narrow screen with larger text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final store = DemoStore(clock: () => DateTime(2026, 11, 9, 12, 30))
      ..loginDemoUser();
    store.approveActiveUserRequest();
    await tester.pumpWidget(
      DemoScope(store: store, child: host(const HomeTab(), textScale: 1.35)),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(
      host(
        const CoachCompanionNote(typing: true, celebrated: false),
        textScale: 1.35,
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(tester.binding.transientCallbackCount, 0);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });
}
