import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/day.dart';
import 'package:sabzine_flutter/data/nutrition_log_storage.dart';
import 'package:sabzine_flutter/screens/questionnaire.dart';
import 'widget_test.dart'
    show MemoryStorage, validAnswers, mobile, next, choose;

class LogMemory implements NutritionLogStorage {
  String? value;
  bool fail = false;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String v) async {
    if (fail) throw StateError('offline');
    value = v;
  }
}

void main() {
  test('Persian calendar, week start and advice follow the calendar day', () {
    expect(jalali(DateTime(2026, 10, 26)), (1405, 8, 4));
    expect(jalali(DateTime(2025, 3, 21)), (1404, 1, 1));
    expect(jalali(DateTime(2024, 3, 20)), (1403, 1, 1));
    expect(startOfWeek(DateTime(2026, 10, 26)), DateTime(2026, 10, 24));
    expect(
      dailyEncouragement(DateTime(2026, 10, 26, 1)),
      dailyEncouragement(DateTime(2026, 10, 26, 23)),
    );
    expect(
      dailyEncouragement(DateTime(2026, 10, 26)),
      isNot(dailyEncouragement(DateTime(2026, 10, 27))),
    );
  });
  test(
    'Meal logs add once, undo exactly, persist and stay separate by date',
    () async {
      final log = LogMemory(),
          date = DateTime(2026, 10, 26),
          tomorrow = DateTime(2026, 10, 27);
      final s = DemoStore(nutritionStorage: log, clock: () => date)
        ..loginDemoUser();
      s.approveActiveUserRequest();
      final energy = s.mealsOn(date).first.calories;
      expect(
        s.calorieTarget(date),
        s.mealsOn(date).fold<int>(0, (n, m) => n + m.calories),
      );
      await s.setMealEaten(date, 0, true);
      await s.setMealEaten(date, 0, true);
      expect(s.consumedCalories(date), energy);
      expect(s.consumedCalories(tomorrow), 0);
      expect(s.mealEaten(tomorrow, 0), false);
      await s.setMealEaten(tomorrow, 0, true);
      final restored = DemoStore(nutritionStorage: log, clock: () => date)
        ..loginDemoUser();
      restored.approveActiveUserRequest();
      await restored.restoreNutritionLog();
      expect(restored.mealEaten(date, 0), true);
      expect(restored.consumedCalories(date), energy);
      await restored.setMealEaten(date, 0, false);
      expect(restored.consumedCalories(date), 0);
      expect(restored.consumedCalories(tomorrow), greaterThan(0));
      log.fail = true;
      await expectLater(restored.setMealEaten(date, 1, true), throwsStateError);
      expect(restored.consumedCalories(date), 0);
      expect(restored.savingMeal, false);
      s.dispose();
      restored.dispose();
    },
  );
  test(
    'All seven days publish distinct meals and drafts cannot change them',
    () {
      final s = DemoStore()..loginDemoUser();
      final r = s.userRequest;
      s.approve(r.id);
      expect(
        List.generate(7, (i) => r.mealsForDay(i).first.title).toSet().length,
        7,
      );
      final original = r.mealsForDay(4).first;
      s.editMeal(
        r.id,
        0,
        original.copyWith(title: 'تغییر آزمایشی', calories: 999),
        day: 4,
      );
      expect(r.mealsForDay(4).first.title, original.title);
      expect(r.mealsForDay(4).first.calories, original.calories);
      s.approve(r.id);
      expect(r.mealsForDay(4).first.title, 'تغییر آزمایشی');
      expect(r.mealsForDay(4).first.calories, 999);
      s.dispose();
    },
  );
  test(
    'Pregnancy branch requires week and pre-pregnancy data and persists every answer',
    () {
      final q = validAnswers()
        ..lifeStage = 'باردار هستم'
        ..goal = 'کاهش وزن';
      expect(q.isComplete, false);
      q.pregnancyWeek = '۴۳';
      q.prePregnancyWeight = '۶۵';
      expect(q.isComplete, false);
      q.pregnancyWeek = '۲۴';
      expect(q.isComplete, true);
      q.babies = 'دوقلو یا بیشتر';
      q.health
        ..clear()
        ..add('دارو مصرف می‌کنم');
      q.healthDetails = 'نمونه';
      expect(q.isComplete, false);
      q.medicines = 'مکمل نمونه';
      expect(q.isComplete, true);
      final saved = QuestionnaireData.fromJson(q.toJson());
      expect(saved.toJson(), q.toJson());
      expect(saved.summary['هفتهٔ بارداری'], '۲۴');
      q.lifeStage = 'هیچ‌کدام';
      q.goal = 'افزایش وزن';
      q.targetWeight = '۶۰';
      expect(q.isComplete, false);
      q.targetWeight = '۷۶';
      expect(q.isComplete, true);
    },
  );
  test(
    'Older answers are retained and marked for the newly required questions',
    () async {
      final old = validAnswers().toJson()
        ..remove('sex')
        ..remove('lifeStage');
      final storage = MemoryStorage()
        ..value = jsonEncode({'version': 1, 'completed': true, 'answers': old});
      final s = DemoStore(storage: storage);
      await s.restoreQuestionnaire();
      expect(s.questionnaire.name, old['name']);
      expect(s.questionnaireComplete, false);
      expect(s.questionnaireNeedsReview, true);
      s.dispose();
    },
  );
  testWidgets(
    'Home checkbox and food modal update the same calories and weekly tab',
    (t) async {
      mobile(t);
      final date = DateTime(2026, 10, 26),
          s = DemoStore(clock: () => DateTime(2026, 10, 26));
      s.questionnaireComplete = true;
      s.loginDemoUser();
      s.approveActiveUserRequest();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      expect(find.text(persianDate(date, year: true)), findsOneWidget);
      final meal = find.text(s.mealsOn(date).first.title);
      await t.ensureVisible(meal);
      await t.pumpAndSettle();
      await t.tap(meal);
      await t.pumpAndSettle();
      expect(find.text('چه مقدار بخورم؟'), findsOneWidget);
      expect(
        find.text(s.mealsOn(date).first.amount.split('\n').first),
        findsOneWidget,
      );
      final done = find.text('این وعده را خوردم');
      await t.ensureVisible(done);
      await t.tap(done);
      await t.pumpAndSettle();
      expect(s.consumedCalories(date), s.mealsOn(date).first.calories);
      await t.tap(find.byTooltip('بستن جزئیات غذا'));
      await t.pumpAndSettle();
      expect(s.mealEaten(date, 0), true);
      final full = find.text('برنامهٔ کامل');
      await t.ensureVisible(full);
      await t.pumpAndSettle();
      await t.tap(full);
      await t.pumpAndSettle();
      expect(find.text(s.mealsOn(date).first.title), findsOneWidget);
      expect(find.text('برنامهٔ غذایی من'), findsOneWidget);
      final nextTab = find.byKey(const ValueKey('plan-day-3'));
      if (nextTab.evaluate().isEmpty) {
        await t.scrollUntilVisible(
          nextTab,
          -100,
          scrollable: find.byType(Scrollable).last,
        );
      }
      await t.ensureVisible(nextTab);
      await t.tap(nextTab);
      await t.pumpAndSettle();
      expect(
        find.text(s.mealsOn(DateTime(2026, 10, 27)).first.title),
        findsOneWidget,
      );
      expect(s.eatenCount(DateTime(2026, 10, 27)), 0);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
  testWidgets(
    'Pregnancy questions appear conditionally and clear when the branch changes',
    (t) async {
      mobile(t);
      final s = DemoStore();
      await t.pumpWidget(
        DemoScope(
          store: s,
          child: MaterialApp(
            theme: ThemeData(),
            home: const QuestionnaireScreen(editing: true),
          ),
        ),
      );
      await t.pumpAndSettle();
      await next(t);
      await choose(t, 'lifeStage', 'باردار هستم');
      expect(find.byKey(const ValueKey('pregnancyWeek')), findsOneWidget);
      await choose(t, 'pregnancyWeek', 'هفتهٔ ۲۴');
      await choose(t, 'babies', 'دوقلو یا بیشتر');
      final pre = find.byKey(const ValueKey('وزن پیش از بارداری / کیلوگرم'));
      await t.ensureVisible(pre);
      await t.enterText(pre, '۶۲');
      expect(find.byKey(const ValueKey('وزن هدف / کیلوگرم')), findsOneWidget);
      await choose(t, 'lifeStage', 'هیچ‌کدام');
      expect(find.byKey(const ValueKey('pregnancyWeek')), findsNothing);
      await choose(t, 'lifeStage', 'باردار هستم');
      expect(t.widget<TextFormField>(pre).initialValue, isEmpty);
      expect(s.questionnaire.lifeStage, 'هیچ‌کدام');
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
}
