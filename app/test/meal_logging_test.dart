import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/presentation/widgets/meal_logging.dart';
import 'nutrition_test.dart' show LogMemory;

void main() {
  final date = DateTime(2026, 11, 1, 12);
  DemoStore ready([LogMemory? storage]) {
    final s = DemoStore(nutritionStorage: storage, clock: () => date)
      ..loginDemoUser();
    s.approveActiveUserRequest();
    addTearDown(s.dispose);
    return s;
  }

  test(
    'Four records, correction, unknown energy, adherence and restart are distinct',
    () async {
      final log = LogMemory(), s = ready(log);
      expect(s.mealRecordOn(date, 0), isNull);
      await s.recordMeal(date, 0, 'skipped');
      expect(s.recordedCount(date), 1);
      expect(s.mealEaten(date, 0), false);
      expect(s.eatenCount(date), 0);
      expect(s.hasUnknownCalories(date), false);
      await s.recordMeal(
        date,
        0,
        'different',
        foodName: 'غذای خانگی',
        quantity: 120,
        unit: 'گرم',
      );
      expect(s.recordedCount(date), 1);
      expect(s.mealEaten(date, 0), true);
      expect(s.hasUnknownCalories(date), true);
      expect(s.consumedCalories(date), 0);
      expect(s.mealRecordOn(date, 0)!['calories'], isNull);
      expect(s.eatenCount(date), 0);
      await s.recordMeal(
        date,
        0,
        'adjusted',
        quantity: 0.5,
        unit: 'سهم برنامه',
      );
      expect(s.mealRecordOn(date, 0)!['quantity'], .5);
      expect(s.eatenCount(date), 0);
      await s.recordMeal(date, 0, 'according');
      expect(s.hasUnknownCalories(date), false);
      expect(s.eatenCount(date), 1);
      expect(s.consumedCalories(date), s.mealsOn(date).first.calories);
      await s.recordMeal(date, 0, 'according');
      expect(s.consumedCalories(date), s.mealsOn(date).first.calories);
      final restored = ready(log);
      await restored.restoreNutritionLog();
      expect(restored.mealRecordOn(date, 0)!['mode'], 'according');
      expect(restored.recordedCount(date), 1);
    },
  );
  test(
    'Invalid quantities, missing units and names, and other dates are rejected',
    () async {
      final s = ready();
      for (final n in [0.0, -1.0, double.nan, double.infinity]) {
        await expectLater(
          s.recordMeal(date, 0, 'adjusted', quantity: n, unit: 'گرم'),
          throwsArgumentError,
        );
      }
      await expectLater(
        s.recordMeal(date, 0, 'different', quantity: 1, unit: 'عدد'),
        throwsArgumentError,
      );
      await expectLater(
        s.recordMeal(date, 0, 'adjusted', quantity: 1),
        throwsArgumentError,
      );
      await expectLater(
        s.recordMeal(date.add(const Duration(days: 1)), 0, 'according'),
        throwsStateError,
      );
      expect(s.recordedCount(date), 0);
    },
  );
  test(
    'Failed correction keeps prior record and totals and can retry',
    () async {
      final log = LogMemory(), s = ready(log);
      await s.recordMeal(date, 0, 'according');
      final calories = s.consumedCalories(date);
      log.fail = true;
      await expectLater(s.recordMeal(date, 0, 'skipped'), throwsStateError);
      expect(s.mealRecordOn(date, 0)!['mode'], 'according');
      expect(s.consumedCalories(date), calories);
      expect(s.savingMeal, false);
      log.fail = false;
      await s.recordMeal(date, 0, 'skipped');
      expect(s.consumedCalories(date), 0);
    },
  );
  test(
    'Skipped and off-plan records never qualify as plan adherence or reward',
    () async {
      final s = ready();
      final balance = s.walletBalance;
      for (var i = 0; i < s.mealsOn(date).length; i++) {
        await s.recordMeal(date, i, 'skipped');
      }
      expect(s.recordedCount(date), s.mealsOn(date).length);
      expect(s.eatenCount(date), 0);
      expect(s.walletBalance, balance);
    },
  );
  testWidgets(
    'Visible form validates other food, saves and reopens for correction',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      await (FontLoader(
        'Vazirmatn',
      )..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))).load();
      await (FontLoader(
        'MaterialIcons',
      )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
      final s = ready();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      final context = t.element(find.byType(Scaffold).first);
      unawaited(showMealLog(context, date, 0));
      await t.pumpAndSettle();
      await t.tap(find.text('غذای دیگری خوردم'));
      await t.pumpAndSettle();
      await t.ensureVisible(find.text('ذخیره ثبت وعده'));
      await t.tap(find.text('ذخیره ثبت وعده'));
      await t.pumpAndSettle();
      expect(find.text('نام غذا را بنویس.'), findsOneWidget);
      await t.enterText(find.byType(TextFormField).at(0), 'غذای خانگی');
      await t.enterText(find.byType(TextFormField).at(1), '۱۲۰');
      await t.enterText(find.byType(TextFormField).at(2), 'گرم');
      await t.ensureVisible(find.text('ذخیره ثبت وعده'));
      await t.tap(find.text('ذخیره ثبت وعده'));
      await t.pumpAndSettle();
      expect(s.mealRecordOn(date, 0)!['title'], 'غذای خانگی');
      unawaited(showMealLog(context, date, 0));
      await t.pumpAndSettle();
      expect(
        find.text('۱۲۰'),
        findsNothing,
      ); // normalized saved quantity is restored from the numeric value
      expect(
        t
            .widget<TextFormField>(find.byType(TextFormField).at(0))
            .controller!
            .text,
        'غذای خانگی',
      );
      expect(t.takeException(), isNull);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('../../references/screenshots/phase3/meal-record-demo.png'),
      );
    },
  );
}
