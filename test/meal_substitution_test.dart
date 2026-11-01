import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/day.dart';
import 'package:sabzine_flutter/screens/user.dart';
import 'package:sabzine_flutter/widgets/meal_choices.dart';
import 'nutrition_test.dart' show LogMemory;

void main() {
  final day = DateTime(2026, 11, 1, 12);
  DemoStore ready({LogMemory? storage}) {
    final store = DemoStore(nutritionStorage: storage, clock: () => day)
      ..loginDemoUser();
    store.approveActiveUserRequest();
    addTearDown(store.dispose);
    return store;
  }

  test(
    'Every fixture meal has complete details and two individually approved alternatives',
    () {
      for (var i = 0; i < 7; i++) {
        for (final meal in sampleMeals(i)) {
          expect(mealApprovalIssues(meal), isEmpty, reason: meal.title);
          expect(
            meal.alternatives.map((a) => a.source).toSet(),
            AlternativeSource.values.toSet(),
          );
        }
      }
    },
  );
  test(
    'Selection persists, restores, changes calories and shopping, and keeps original and history',
    () async {
      final log = LogMemory(), s = ready(storage: log);
      final original = s.originalMealOn(day, 0), before = s.calorieTarget(day);
      final shopping = s
          .shoppingIngredients()
          .map((r) => '${r.ingredient.id}:${r.quantity}')
          .join();
      final alternative = s.alternativesOn(day, 0).first;
      expect(
        await s.substituteMeal(
          day,
          0,
          alternative.id,
          'expensive',
          explanation: 'نمونه',
        ),
        true,
      );
      expect(s.mealsOn(day).first.title, alternative.meal.title);
      expect(
        s.calorieTarget(day),
        before - original.calories + alternative.meal.calories,
      );
      expect(s.originalMealOn(day, 0).title, original.title);
      expect(
        s
            .shoppingIngredients()
            .map((r) => '${r.ingredient.id}:${r.quantity}')
            .join(),
        isNot(shopping),
      );
      final restored = ready(storage: log);
      await restored.restoreNutritionLog();
      expect(restored.mealsOn(day).first.title, alternative.meal.title);
      expect(restored.substitutionHistory.single.explanation, 'نمونه');
      expect(
        await restored.substituteMeal(day, 0, 'original', 'dislike'),
        true,
      );
      expect(restored.mealsOn(day).first.title, original.title);
      expect(restored.substitutionHistory.length, 2);
    },
  );
  test(
    'Consumed food calories stay historical across substitution and cannot be counted twice',
    () async {
      final s = ready();
      await s.setMealEaten(day, 0, true);
      final consumed = s.consumedCalories(day);
      await expectLater(
        s.substituteMeal(day, 0, 'ai', 'dislike'),
        throwsStateError,
      );
      await s.substituteMeal(day, 0, 'ai', 'dislike', confirmConsumed: true);
      expect(s.mealEaten(day, 0), true);
      await s.setMealEaten(day, 0, true);
      expect(s.consumedCalories(day), consumed);
      await s.setMealEaten(day, 0, false);
      expect(s.consumedCalories(day), 0);
    },
  );
  test(
    'Past days, next week, unknown reasons and unapproved alternatives are rejected',
    () async {
      final s = ready();
      await expectLater(
        s.substituteMeal(
          day.subtract(const Duration(days: 1)),
          0,
          'ai',
          'dislike',
        ),
        throwsStateError,
      );
      await expectLater(
        s.substituteMeal(day.add(const Duration(days: 7)), 0, 'ai', 'dislike'),
        throwsStateError,
      );
      await expectLater(
        s.substituteMeal(day, 0, 'ai', 'invalid'),
        throwsStateError,
      );
      final original = s.originalMealOn(day, 0);
      final meals = s.userRequest.publishedOtherDays[weekDayIndex(day) - 1]
          .toList();
      meals[0] = original.copyWith(
        alternatives: [
          MealAlternative(
            id: 'unapproved',
            source: AlternativeSource.ai,
            meal: original,
          ),
        ],
      );
      s.userRequest.publishedOtherDays[weekDayIndex(day) - 1] = meals;
      expect(s.alternativesOn(day, 0), isEmpty);
      await expectLater(
        s.substituteMeal(day, 0, 'unapproved', 'dislike'),
        throwsStateError,
      );
    },
  );
  test(
    'Failed save preserves selection and shopping; repeated submit is a no-op',
    () async {
      final log = LogMemory(), s = ready(storage: log);
      final original = s.mealsOn(day).first.title;
      log.fail = true;
      await expectLater(
        s.substituteMeal(day, 0, 'ai', 'time'),
        throwsStateError,
      );
      expect(s.mealsOn(day).first.title, original);
      expect(s.substitutionHistory, isEmpty);
      expect(s.savingSubstitution, false);
      log.fail = false;
      expect(await s.substituteMeal(day, 0, 'ai', 'time'), true);
      expect(await s.substituteMeal(day, 0, 'ai', 'time'), false);
      expect(s.substitutionHistory.length, 1);
      expect(jsonDecode(log.value!)['version'], 2);
    },
  );
  test(
    'Incomplete alternatives block publication without replacing active plan',
    () {
      final s = ready();
      final current = s.userRequest.published;
      final request = s.userRequest;
      request.draft[0] = request.draft.first.copyWith(alternatives: []);
      expect(() => s.approve(request.id), throwsStateError);
      expect(identical(s.userRequest.published, current), true);
    },
  );
  testWidgets(
    'Weekly and daily options share selection; reason required; mobile layout and screenshot',
    (t) async {
      t.view.physicalSize = const Size(430, 932);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      final s = ready();
      await (FontLoader(
        'Vazirmatn',
      )..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))).load();
      await (FontLoader(
        'MaterialIcons',
      )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      final context = t.element(find.byType(Scaffold).first);
      unawaited(showMealOptions(context, day, 0, initialOption: 'ai'));
      await t.pumpAndSettle();
      await t.tap(find.text('تأیید جایگزینی'));
      await t.pumpAndSettle();
      expect(find.text('دلیل جایگزینی را انتخاب کن.'), findsOneWidget);
      await t.ensureVisible(find.byKey(const ValueKey('substitution-reason')));
      await t.tap(find.byKey(const ValueKey('substitution-reason')));
      await t.pumpAndSettle();
      await t.tap(find.text('گران است').last);
      await t.pumpAndSettle();
      await t.tap(find.text('تأیید جایگزینی'));
      await t.pumpAndSettle();
      expect(s.selectedOptionOn(day, 0), 'ai');
      Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const PlanSummaryScreen()),
      );
      await t.pumpAndSettle();
      expect(find.text(s.mealsOn(day).first.title), findsWidgets);
      expect(t.takeException(), isNull);
      unawaited(showMealOptions(t.element(find.byType(Scaffold).last), day, 0));
      await t.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('../screenshots/phase2/meal-options-demo.png'),
      );
      expect(t.takeException(), isNull);
    },
  );
}
