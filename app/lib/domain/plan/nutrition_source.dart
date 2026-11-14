import 'meal.dart';
import '../onboarding/questionnaire.dart';

/// Read-only input to nutrition and goal calculations.
abstract interface class NutritionSource {
  DateTime get today;
  QuestionnaireData get questionnaire;
  double get latestWeight;
  List<double> get weightEntries;
  List<Meal> mealsOn(DateTime date);
  bool mealEaten(DateTime date, int index);
  Map<String, dynamic>? consumedMealOn(DateTime date, int index);
  int calorieTarget(DateTime date);
  int consumedCalories(DateTime date);
  bool hasUnknownCalories(DateTime date);
  String? get coachDay;
  int? get coachProtein;
  int? get coachCarbs;
  int? get coachFat;
  bool get savingMeal;
  bool get savingSubstitution;
  bool get savingShopping;
}
