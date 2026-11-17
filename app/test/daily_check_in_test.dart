import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/day.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/habit_garden.dart';
import 'package:sabzine_flutter/features/home/home_tab.dart';
import 'package:sabzine_flutter/features/home/water_card.dart'
    show WaterGlassPainter;
import 'package:sabzine_flutter/features/home/water_log.dart';
import 'package:sabzine_flutter/features/plan/consume_sheet.dart';
import 'nutrition_test.dart' show LogMemory;

class MemoryWaterPreferences implements SharedPreferencesAsync {
  final data = <String, String>{};
  final _failure = [false];
  bool get fail => _failure.first;
  set fail(bool value) => _failure[0] = value;
  @override
  Future<String?> getString(String key) async => data[key];
  @override
  Future<void> setString(String key, String value) async {
    if (fail) throw StateError('disk unavailable');
    data[key] = value;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Widget dailyHost(
  DemoStore store,
  Widget child, {
  bool reduced = true,
  double scale = 1,
}) => DemoScope(
  store: store,
  child: MaterialApp(
    theme: appTheme(),
    builder: (context, body) => MediaQuery(
      data: MediaQuery.of(context).copyWith(
        disableAnimations: reduced,
        textScaler: TextScaler.linear(scale),
      ),
      child: Directionality(textDirection: TextDirection.rtl, child: body!),
    ),
    home: Scaffold(body: child),
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

  test(
    'concurrent water writes preserve both days, failed saves do not notify and the queue recovers',
    () async {
      final preferences = MemoryWaterPreferences();
      final log = WaterLog(preferences: preferences);
      final day = DateTime(2026, 11, 9);
      final previous = DateTime(2026, 11, 8);
      await Future.wait([log.write(day, 2), log.write(previous, 4)]);
      expect(await log.read(day), 2);
      expect(await log.history(), {dateKey(day): 2, dateKey(previous): 4});
      final revision = WaterLog.changes.value;
      preferences.fail = true;
      await expectLater(log.write(day, 7), throwsStateError);
      expect(await log.read(day), 2);
      expect(WaterLog.changes.value, revision);
      preferences.fail = false;
      await log.write(day, 3);
      expect(await log.read(day), 3);
    },
  );

  test(
    'meal Undo restores exact prior quantities, guards newer writes and rolls back a cached daily total',
    () async {
      var now = DateTime(2026, 11, 9, 12);
      final disk = LogMemory();
      final store = DemoStore(nutritionStorage: disk, clock: () => now)
        ..loginDemoUser();
      addTearDown(store.dispose);
      store.approveActiveUserRequest();
      store.coachDay = dateKey(now);
      store.coachConsumedKcal = 100;
      final empty = store.checkpointMeal(now, 0);
      final kcal = store.mealsOn(now).first.calories;
      await store.recordMeal(now, 0, 'according');
      final first = store.checkpointMeal(now, 0);
      expect(store.consumedCalories(now), 100 + kcal);
      disk.fail = true;
      await expectLater(
        store.restoreMealCheckpoint(empty, expected: first),
        throwsStateError,
      );
      expect(store.consumedCalories(now), 100 + kcal);
      expect(store.mealCheckInsOn(now), 1);
      disk.fail = false;
      await store.restoreMealCheckpoint(empty, expected: first);
      expect(store.consumedCalories(now), 100);
      expect(store.mealRecordOn(now, 0), isNull);
      await store.recordMeal(
        now,
        0,
        'different',
        foodName: 'غذای خانگی',
        quantity: 120,
        unit: 'گرم',
      );
      final prior = store.checkpointMeal(now, 0);
      final oldRecord = store.mealRecordOn(now, 0);
      await store.recordMeal(now, 0, 'skipped');
      await store.restoreMealCheckpoint(
        prior,
        expected: store.checkpointMeal(now, 0),
      );
      expect(store.mealRecordOn(now, 0), oldRecord);
      final stale = store.checkpointMeal(now, 0);
      await store.recordMeal(
        now,
        0,
        'different',
        foodName: 'غذای خانگی',
        quantity: 120,
        unit: 'گرم',
      );
      await expectLater(
        store.restoreMealCheckpoint(empty, expected: stale),
        throwsStateError,
      );
      now = DateTime(2026, 11, 10, 1);
      await expectLater(
        store.clearMealRecord(DateTime(2026, 11, 9), 0),
        throwsStateError,
      );
      expect(store.mealCheckInsOn(DateTime(2026, 11, 9)), 1);
      now = DateTime(2026, 11, 16);
      expect(store.mealCheckInsOn(DateTime(2026, 11, 9)), 1);
    },
  );

  testWidgets(
    'water rises after success, Undo persists, failures preserve the count and midnight starts a new day',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      var now = DateTime(2026, 11, 9, 12);
      final store = DemoStore(clock: () => now)..loginDemoUser();
      store.approveActiveUserRequest();
      final preferences = MemoryWaterPreferences();
      final log = WaterLog(preferences: preferences);
      await log.write(now, 2);
      await t.pumpWidget(
        dailyHost(
          store,
          SingleChildScrollView(child: WaterCard(goal: 6, log: log)),
          reduced: false,
        ),
      );
      await t.pumpAndSettle();
      expect(find.text('۲ از ۶ لیوان'), findsOneWidget);
      double level(int index) =>
          (t
                      .widget<CustomPaint>(
                        find.byKey(ValueKey('water-glass-$index')),
                      )
                      .painter!
                  as WaterGlassPainter)
              .level;
      expect(level(0), 1);
      expect(level(1), 1);
      expect(level(2), 0);
      await t.tap(find.byKey(const ValueKey('water-add')));
      await t.pump();
      await t.pump(const Duration(milliseconds: 120));
      expect(level(2), greaterThan(0));
      expect(level(2), lessThan(1));
      expect(level(1), 1);
      expect(level(3), 0);
      await t.pumpAndSettle();
      expect(level(2), 1);
      expect(await log.read(now), 3);
      expect(store.waterGlassesOn(now), 3);
      expect(find.text('یک لیوان به آب امروزت اضافه شد.'), findsOneWidget);
      expect(t.binding.transientCallbackCount, 0);
      await t.tap(find.byKey(const ValueKey('water-undo')));
      await t.pump();
      await t.pump(const Duration(milliseconds: 120));
      expect(level(2), greaterThan(0));
      expect(level(2), lessThan(1));
      await t.pumpAndSettle();
      expect(level(2), 0);
      expect(await log.read(now), 2);
      expect(find.text('۲ از ۶ لیوان'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('water-remove')));
      await t.pump();
      await t.pump(const Duration(milliseconds: 120));
      expect(level(1), greaterThan(0));
      expect(level(1), lessThan(1));
      await t.pumpAndSettle();
      expect(await log.read(now), 1);
      expect(level(1), 0);
      await t.tap(find.byKey(const ValueKey('water-undo')));
      await t.pumpAndSettle();
      expect(await log.read(now), 2);
      expect(level(1), 1);
      preferences.fail = true;
      await t.tap(find.byKey(const ValueKey('water-add')));
      await t.pumpAndSettle();
      expect(find.text('۲ از ۶ لیوان'), findsOneWidget);
      expect(find.textContaining('ذخیره نشد'), findsOneWidget);
      preferences.fail = false;
      now = DateTime(2026, 11, 10, 1);
      store.update();
      await t.pumpAndSettle();
      expect(find.text('۰ از ۶ لیوان'), findsOneWidget);
      expect(await log.read(DateTime(2026, 11, 9)), 2);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  test(
    'a rejected server Undo leaves the saved meal and disk record intact',
    () async {
      final day = DateTime(2026, 11, 9);
      final disk = LogMemory();
      final store = DemoStore(nutritionStorage: disk, clock: () => day)
        ..loginDemoUser();
      addTearDown(store.dispose);
      store.approveActiveUserRequest();
      await store.recordMeal(day, 0, 'according');
      final saved = disk.value;
      store.serverMealUids['${dateKey(day)}|0'] = 'server-meal';
      store.reportEaten = (_, _) async => throw StateError('server rejected');
      await expectLater(store.clearMealRecord(day, 0), throwsStateError);
      expect(disk.value, saved);
      expect(store.mealRecordOn(day, 0), isNotNull);
      var reported = true;
      store.reportEaten = (_, eaten) async {
        reported = eaten;
      };
      await store.clearMealRecord(day, 0);
      expect(reported, isFalse);
      expect(store.mealRecordOn(day, 0), isNull);
    },
  );

  testWidgets(
    'garden reflects meal and water records, Undo removes growth, future days cannot be logged',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      var now = DateTime(2026, 11, 7, 12);
      final store = DemoStore(clock: () => now)..loginDemoUser();
      store.approveActiveUserRequest();
      await store.recordMeal(now, 0, 'skipped');
      now = DateTime(2026, 11, 9, 12);
      final log = WaterLog(preferences: MemoryWaterPreferences());
      var continued = false;
      await t.pumpWidget(
        dailyHost(
          store,
          SingleChildScrollView(
            child: HabitGarden(log: log, onContinue: () => continued = true),
          ),
        ),
      );
      await t.pumpAndSettle();
      expect(find.text('این هفته · ۱ روز دارای ثبت'), findsOneWidget);
      await log.write(now, 1);
      await t.pumpAndSettle();
      expect(find.text('این هفته · ۲ روز دارای ثبت'), findsOneWidget);
      expect(find.text('۰ ثبت وعده · ۱ لیوان آب'), findsOneWidget);
      await log.write(now, 0);
      await t.pumpAndSettle();
      expect(find.text('این هفته · ۱ روز دارای ثبت'), findsOneWidget);
      final future = t.widget<InkWell>(
        find.byKey(const ValueKey('habit-day-2026-11-10')),
      );
      expect(future.onTap, isNull);
      await t.tap(find.byKey(const ValueKey('habit-day-2026-11-08')));
      await t.pumpAndSettle();
      expect(find.textContaining('هر روز فرصت تازه‌ای'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('habit-continue-today')));
      await t.pumpAndSettle();
      expect(continued, isTrue);
      expect(store.mealCheckInsOn(now), 0);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'home meal tick and daily summary undo together; the edit sheet keeps a permanent Undo',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final now = DateTime(2026, 11, 9, 12);
      final store = DemoStore(clock: () => now)..loginDemoUser();
      store.approveActiveUserRequest();
      await t.pumpWidget(
        dailyHost(
          store,
          HomeTab(waterLog: WaterLog(preferences: MemoryWaterPreferences())),
        ),
      );
      await t.pumpAndSettle();
      final chip = find.byKey(const ValueKey('home-log-meal-0'));
      Future<void> tapMealChip() async {
        // The focus card changes height after a record; center the action again.
        await Scrollable.ensureVisible(t.element(chip), alignment: .5);
        await t.pumpAndSettle();
        await t.tap(chip);
        await t.pumpAndSettle();
      }

      await t.scrollUntilVisible(
        chip,
        220,
        scrollable: find.byType(Scrollable).first,
      );
      await tapMealChip();
      await t.tap(find.text('انجام شد'));
      await t.pumpAndSettle();
      expect(store.mealRecordOn(now, 0), isNotNull);
      await t.tap(find.text('برگرداندن'));
      await t.pumpAndSettle();
      expect(store.mealRecordOn(now, 0), isNull);
      expect(store.consumedCalories(now), 0);
      await tapMealChip();
      await t.tap(find.text('انجام شد'));
      await t.pumpAndSettle();
      await tapMealChip();
      expect(find.byType(ConsumeSheet), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('meal-undo-registration')));
      await t.pumpAndSettle();
      expect(store.mealCheckInsOn(now), 0);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
  testWidgets(
    'water and habit calendar fit narrow large text with reduced motion',
    (t) async {
      t.view.physicalSize = const Size(320, 740);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final day = DateTime(2026, 11, 9);
      final store = DemoStore(clock: () => day)..loginDemoUser();
      store.approveActiveUserRequest();
      final log = WaterLog(preferences: MemoryWaterPreferences());
      await t.pumpWidget(
        dailyHost(
          store,
          SingleChildScrollView(
            child: Column(
              children: [
                WaterCard(goal: 6, log: log),
                HabitGarden(log: log),
              ],
            ),
          ),
          scale: 1.5,
        ),
      );
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('water-add')));
      await t.pumpAndSettle();
      await t.ensureVisible(find.byKey(const ValueKey('habit-garden')));
      await t.pumpAndSettle();
      expect(find.text('این هفته · ۱ روز دارای ثبت'), findsOneWidget);
      expect(t.binding.transientCallbackCount, 0);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
}
