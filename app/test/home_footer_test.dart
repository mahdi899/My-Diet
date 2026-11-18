import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/home_tab.dart';
import 'package:sabzine_flutter/features/home/journey_art.dart';
import 'package:sabzine_flutter/features/home/weight_card.dart';
import 'package:sabzine_flutter/features/plan/streak_chip.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_page.dart';

Widget footerHost(
  DemoStore store,
  Widget page, {
  double scale = 1,
  bool disableAnimations = true,
}) => DemoScope(
  store: store,
  child: MaterialApp(
    theme: appTheme(),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(
        disableAnimations: disableAnimations,
        textScaler: TextScaler.linear(scale),
      ),
      child: Directionality(textDirection: TextDirection.rtl, child: child!),
    ),
    home: Scaffold(body: page),
  ),
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
  });

  testWidgets('weight intro survives scroll disposal and tab recreation', (
    tester,
  ) async {
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        FakeAccessibilityFeatures(disableAnimations: false);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final store = DemoStore()..applyOnboardingWeight(54);
    addTearDown(store.dispose);
    Widget page() => footerHost(
      store,
      ListView.builder(
        itemCount: 2,
        itemBuilder: (_, index) =>
            index == 0 ? const HomeWeightCard() : const SizedBox(height: 2000),
      ),
      disableAnimations: false,
    );

    await tester.pumpWidget(page());
    expect(find.text('۰ کیلو'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('۰ کیلو'), findsNothing);
    expect(find.text('۵۴ کیلو'), findsNothing);

    // Scroll away before the entrance finishes, then rebuild the lazy child.
    await tester.drag(find.byType(ListView), const Offset(0, -1400));
    await tester.pumpAndSettle();
    expect(find.byType(HomeWeightCard), findsNothing);
    await tester.drag(find.byType(ListView), const Offset(0, 2000));
    await tester.pump();
    expect(find.text('۵۴ کیلو'), findsOneWidget);
    expect(find.text('۰ کیلو'), findsNothing);
    await tester.pumpAndSettle();

    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(page());
    expect(find.text('۵۴ کیلو'), findsOneWidget);

    // A new measurement updates from the displayed weight, never from zero.
    store.addWeight(55);
    await tester.pump();
    expect(find.text('۵۴ کیلو'), findsOneWidget);
    expect(find.text('۰ کیلو'), findsNothing);
    await tester.pumpAndSettle();
    expect(find.text('۵۵ کیلو'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());

    // A fresh app workspace gets its own first entrance.
    final fresh = DemoStore()..applyOnboardingWeight(54);
    addTearDown(fresh.dispose);
    await tester.pumpWidget(
      footerHost(fresh, const HomeWeightCard(), disableAnimations: false),
    );
    expect(find.text('۰ کیلو'), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.text('۵۴ کیلو'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'one weight explains the starting point until a second day is recorded',
    (tester) async {
      var now = DateTime(2026, 11, 17);
      final store = DemoStore(clock: () => now)..applyOnboardingWeight(74);
      await tester.pumpWidget(footerHost(store, const HomeWeightCard()));
      await tester.pumpAndSettle();
      expect(find.text('شروع مسیر ثبت شد'), findsOneWidget);
      expect(find.byKey(const ValueKey('home-weight-trend')), findsNothing);

      await tester.tap(find.text('ثبت وزن'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '۷۳.۵');
      await tester.tap(find.text('ثبت'));
      await tester.pumpAndSettle();
      expect(store.latestWeight, 73.5);
      expect(store.weightEntries.length, 1);
      expect(find.text('شروع مسیر ثبت شد'), findsOneWidget);

      now = DateTime(2026, 11, 18);
      store.addWeight(73);
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('home-weight-trend')), findsOneWidget);
      expect(find.byKey(const ValueKey('home-weight-start')), findsNothing);
      expect(find.text('۲ ثبت'), findsOneWidget);
      expect(find.text('۰٫۵ کیلو کمتر از اولین ثبت'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets('no measurements does not show a placeholder weight or chart', (
    tester,
  ) async {
    final store = DemoStore()..weightEntries.clear();
    await tester.pumpWidget(footerHost(store, const HomeWeightCard()));
    await tester.pumpAndSettle();
    expect(find.text('اولین وزنت را ثبت کن'), findsOneWidget);
    expect(find.text('هنوز ثبت نشده'), findsOneWidget);
    expect(find.byKey(const ValueKey('home-weight-trend')), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets(
    'explained streak counts completed days rather than logins or weights',
    (tester) async {
      final store = DemoStore(clock: () => DateTime(2026, 11, 17))
        ..loginDemoUser();
      store.approveActiveUserRequest();
      await tester.pumpWidget(
        footerHost(store, const StreakChip(explained: true)),
      );
      await tester.pumpAndSettle();
      expect(find.text('۰ روز پیاپی'), findsOneWidget);
      expect(tester.widget<JourneyPath>(find.byType(JourneyPath)).completed, 0);
      expect(
        find.text('با ثبت همهٔ وعده‌ها، یک روز کامل می‌شود.'),
        findsOneWidget,
      );
      store.addWeight(74);
      await store.setMealEaten(store.today, 0, true);
      await tester.pumpAndSettle();
      expect(find.text('۰ روز پیاپی'), findsOneWidget);
      for (var i = 1; i < store.mealsOn(store.today).length; i++) {
        await store.setMealEaten(store.today, i, true);
      }
      await tester.pumpAndSettle();
      expect(find.text('۱ روز پیاپی'), findsOneWidget);
      expect(tester.widget<JourneyPath>(find.byType(JourneyPath)).completed, 1);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'footer fits a narrow screen with large text and opens the coach explicitly',
    (tester) async {
      tester.view.physicalSize = const Size(320, 740);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final store = DemoStore(clock: () => DateTime(2026, 11, 17))
        ..loginDemoUser();
      store.applyOnboardingWeight(74);
      store.approveActiveUserRequest();
      await tester.pumpWidget(footerHost(store, const HomeTab(), scale: 1.5));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('home-open-coach')),
        400,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      expect(find.text('امروز را با مربی ببند'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byKey(const ValueKey('home-open-coach')));
      await tester.pumpAndSettle();
      expect(find.byType(CoachPage), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
}
