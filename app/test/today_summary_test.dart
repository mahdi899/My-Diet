import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/home_day_focus.dart';
import 'package:sabzine_flutter/features/home/today_summary.dart';
import 'package:sabzine_flutter/features/plan/goal_math.dart';

import 'daily_check_in_test.dart' show dailyHost;

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets(
    'summary distinguishes remaining calories, excess and missing targets',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final store = DemoStore(clock: () => DateTime(2026, 11, 9))
        ..loginDemoUser();
      addTearDown(store.dispose);
      store.approveActiveUserRequest();

      Future<void> show(
        int consumed,
        int target, {
        bool unknown = false,
      }) async {
        await t.pumpWidget(
          dailyHost(
            store,
            SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: TodaySummary(
                day: DayNutrition(
                  targetKcal: target,
                  eatenKcal: consumed,
                  planned: MacroGrams.zero,
                  eaten: MacroGrams.zero,
                  unknown: unknown,
                ),
                focus: HomeDayFocus.from(store),
              ),
            ),
          ),
        );
        await t.pumpAndSettle();
      }

      await show(670, 1790);
      expect(find.text('۱۱۲۰'), findsOneWidget);
      expect(find.text('کالری باقی‌مانده'), findsOneWidget);
      expect(find.text('از ۱۷۹۰ کالری برنامه'), findsOneWidget);
      await show(1900, 1790);
      expect(find.text('۱۱۰'), findsOneWidget);
      expect(find.text('کالری بیشتر از برنامه'), findsOneWidget);
      expect(find.text('کالری باقی‌مانده'), findsNothing);
      await show(0, 0, unknown: true);
      expect(
        find.byKey(const ValueKey('home-calories-remaining')),
        findsNothing,
      );
      expect(find.text('مجموع ثبت‌های امروز'), findsOneWidget);
      expect(find.text('بعضی ثبت‌ها کالری مشخص ندارند.'), findsOneWidget);
      expect(t.takeException(), isNull);
      expect(t.binding.transientCallbackCount, 0);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'all meal stations remain usable on narrow screens with large text',
    (t) async {
      t.view.physicalSize = const Size(320, 740);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final now = DateTime(2026, 11, 9, 12);
      final store = DemoStore(clock: () => now)..loginDemoUser();
      addTearDown(store.dispose);
      store.approveActiveUserRequest();
      await t.pumpWidget(
        dailyHost(
          store,
          SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: TodaySummary(
              day: nutritionOn(store, now),
              focus: HomeDayFocus.from(store),
            ),
          ),
          scale: 1.5,
        ),
      );
      await t.pumpAndSettle();
      final meals = store.mealsOn(now);
      for (var i = 0; i < meals.length; i++) {
        expect(find.byKey(ValueKey('home-log-meal-$i')), findsOneWidget);
      }
      final last = find.byKey(ValueKey('home-log-meal-${meals.length - 1}'));
      await t.ensureVisible(last);
      await t.tap(last);
      await t.pumpAndSettle();
      await t.ensureVisible(find.text('انجام شد'));
      await t.tap(find.text('انجام شد'));
      await t.pumpAndSettle();
      expect(store.mealRecordOn(now, meals.length - 1), isNotNull);
      expect(store.mealRecordOn(now, 0), isNull);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      await t.pumpAndSettle();
    },
  );
}
