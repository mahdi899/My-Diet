export '../../domain/plan/water_repository.dart';

/// Turns the questionnaire's water answer into a daily glass goal.
int waterGoalFrom(String answer) {
  if (answer.contains('کمتر')) return 4;
  if (answer.contains('۱۰') || answer.contains('10')) return 10;
  if (answer.contains('۷') || answer.contains('7')) return 8;
  if (answer.contains('۴') || answer.contains('4')) return 6;
  return 8;
}
