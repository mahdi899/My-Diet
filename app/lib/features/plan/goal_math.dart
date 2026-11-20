import 'dart:math' as math;

import '../../domain/common/day.dart';
import '../../domain/common/digits.dart';
import '../../domain/common/number_format.dart';
import '../../domain/plan/meal.dart';
import '../../domain/plan/nutrition_source.dart';
import '../../domain/onboarding/questionnaire.dart';

/// Space the shell's floating bar needs. Tabs must not draw their own bar.
const double shellBottomInset = 134;

class MacroGrams {
  const MacroGrams(this.protein, this.carbs, this.fat);
  final int protein, carbs, fat;
  static const zero = MacroGrams(0, 0, 0);
}

class DayNutrition {
  const DayNutrition({
    required this.targetKcal,
    required this.eatenKcal,
    required this.planned,
    required this.eaten,
    required this.unknown,
  });

  final int targetKcal, eatenKcal;
  final MacroGrams planned, eaten;
  final bool unknown;

  double get calorieUnit => unitRatio(eatenKcal, targetKcal);
}

class GoalView {
  const GoalView({
    required this.current,
    required this.target,
    required this.progress,
    required this.etaDays,
    required this.project,
    required this.goal,
    required this.pregnant,
  });

  final double current;
  final double? target;
  final double progress;
  final int? etaDays;
  final bool project;
  final String goal;
  final bool pregnant;
}

class NextMeal {
  const NextMeal(this.date, this.index, this.meal);
  final DateTime date;
  final int index;
  final Meal meal;
}

const consumeLabels = {
  'according': 'طبق برنامه',
  'adjusted': 'مقدار دیگر',
  'different': 'غذای دیگر',
  'skipped': 'نخورده',
};

double unitRatio(num eaten, num planned) {
  if (planned <= 0) return 0;
  final value = eaten / planned;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value.toDouble();
}

int fractionDigits(double value) =>
    (value - value.roundToDouble()).abs() < 0.05 ? 0 : 1;

String kilos(double value) => persianNumber(value);

String etaLabel(int? days) {
  if (days == null) return '';
  if (days < 14) return 'حدود ${fa(days)} روز';
  return 'حدود ${fa((days / 7).round())} هفته';
}

int journeyWeeks(int? days) {
  if (days == null) return 8;
  return (days / 7).round().clamp(4, 16);
}

/// Smooth projected weights from [from] down (or up) to [to], inclusive.
List<double> projectSeries(double from, double to, int weeks) {
  final steps = math.max(2, weeks);
  return [
    for (var i = 0; i <= steps; i++) from + (to - from) * _smooth(i / steps),
  ];
}

double _smooth(double t) => t * t * (3 - 2 * t);

(double, double, double) _split(String name) {
  if (name.contains('صبحانه')) return (0.22, 0.53, 0.25);
  if (name.contains('ناهار')) return (0.34, 0.40, 0.26);
  if (name.contains('شام')) return (0.36, 0.32, 0.32);
  if (name.contains('میان')) return (0.18, 0.52, 0.30);
  return (0.30, 0.45, 0.25);
}

/// Gram estimate from a meal's calories and its place in the day.
MacroGrams macrosFor(int kcal, String mealName) {
  if (kcal <= 0) return MacroGrams.zero;
  final split = _split(mealName);
  return MacroGrams(
    (kcal * split.$1 / 4).round(),
    (kcal * split.$2 / 4).round(),
    (kcal * split.$3 / 9).round(),
  );
}

DayNutrition nutritionOn(NutritionSource store, DateTime date) {
  final meals = store.mealsOn(date);
  var protein = 0, carbs = 0, fat = 0;
  var eatenProtein = 0, eatenCarbs = 0, eatenFat = 0;
  for (var i = 0; i < meals.length; i++) {
    final meal = meals[i];
    final hasNutrition = [
      'proteinG',
      'carbsG',
      'fatG',
    ].every(meal.nutrition.containsKey);
    MacroGrams macros(int kcal) {
      if (!hasNutrition || meal.calories <= 0) {
        return macrosFor(kcal, meal.name);
      }
      final ratio = kcal / meal.calories;
      return MacroGrams(
        (meal.nutrition['proteinG']! * ratio).round(),
        (meal.nutrition['carbsG']! * ratio).round(),
        (meal.nutrition['fatG']! * ratio).round(),
      );
    }

    final planned = macros(meal.calories);
    protein += planned.protein;
    carbs += planned.carbs;
    fat += planned.fat;
    if (!store.mealEaten(date, i)) continue;
    final record = store.consumedMealOn(date, i);
    final recorded = record?['calories'];
    final kcal = recorded is num ? recorded.round() : meal.calories;
    final eaten = record?['state'] == 'different'
        ? macrosFor(kcal, meal.name)
        : macros(kcal);
    eatenProtein += eaten.protein;
    eatenCarbs += eaten.carbs;
    eatenFat += eaten.fat;
  }
  if (store.coachDay == dateKey(date)) {
    final protein = store.coachProtein;
    final carbs = store.coachCarbs;
    final fat = store.coachFat;
    if (protein != null) eatenProtein = protein;
    if (carbs != null) eatenCarbs = carbs;
    if (fat != null) eatenFat = fat;
  }
  final mealKcal = meals.fold<int>(0, (sum, meal) => sum + meal.calories);
  final targetKcal = store.calorieTarget(date);
  if (mealKcal > 0 &&
      targetKcal > 0 &&
      targetKcal != mealKcal &&
      meals.every((meal) => meal.nutrition.isEmpty)) {
    final scale = targetKcal / mealKcal;
    protein = (protein * scale).round();
    carbs = (carbs * scale).round();
    fat = (fat * scale).round();
  } else if (meals.isEmpty && targetKcal > 0) {
    final fallback = macrosFor(targetKcal, '');
    protein = fallback.protein;
    carbs = fallback.carbs;
    fat = fallback.fat;
  }
  return DayNutrition(
    targetKcal: targetKcal,
    eatenKcal: store.consumedCalories(date),
    planned: MacroGrams(protein, carbs, fat),
    eaten: MacroGrams(eatenProtein, eatenCarbs, eatenFat),
    unknown: store.hasUnknownCalories(date),
  );
}

GoalView goalOf(NutritionSource store) {
  final answers = store.questionnaire;
  final current = store.latestWeight;
  final target = QuestionnaireData.number(answers.targetWeight);
  final start =
      QuestionnaireData.number(answers.weight) ??
      (store.weightEntries.isEmpty ? current : store.weightEntries.first);
  final pregnant = answers.pregnant;
  final showTarget = target != null && !pregnant;
  final project = showTarget && (current - target).abs() >= 0.25;
  var progress = 0.0;
  int? eta;
  if (project) {
    final span = target - start;
    if (span.abs() > 0.05) {
      final raw = (current - start) / span;
      progress = raw <= 0 ? 0 : (raw >= 1 ? 1 : raw);
    }
    eta = ((current - target).abs() / 0.5 * 7).ceil().clamp(7, 420);
  }
  return GoalView(
    current: current,
    target: showTarget ? target : null,
    progress: progress,
    etaDays: eta,
    project: project,
    goal: answers.goal,
    pregnant: pregnant,
  );
}

NextMeal? findNextMeal(NutritionSource store) {
  final date = store.today;
  final meals = store.mealsOn(date);
  for (var i = 0; i < meals.length; i++) {
    if (!store.mealEaten(date, i)) return NextMeal(date, i, meals[i]);
  }
  return null;
}

String mealHeroTag(DateTime date, int index) =>
    'plan-meal-${dateKey(date)}-$index';

String swapPrefill(Meal meal) =>
    'می‌خوام ${meal.name} «${meal.title}» را عوض کنم. یک جایگزین هم‌کالری پیشنهاد بده.';

bool canLogMeal(NutritionSource store, DateTime date) =>
    dateKey(date) == dateKey(store.today) &&
    !store.savingMeal &&
    !store.savingSubstitution &&
    !store.savingShopping;

List<String> recipeSteps(String instructions) {
  final raw = instructions.trim();
  if (raw.isEmpty) return const [];
  final parts = raw
      .split(RegExp(r'\n+|؛+'))
      .map((part) => part.trim())
      .where((part) => part.isNotEmpty)
      .toList();
  return parts.isEmpty ? [raw] : parts;
}

String ingredientLine(MealIngredient item) {
  if (item.quantity == null) return item.name;
  return '${item.name}  ${persianQuantity(item.quantity!, item.unit)}';
}

DateTime weekDate(DateTime start, int index) =>
    DateTime(start.year, start.month, start.day + index);
