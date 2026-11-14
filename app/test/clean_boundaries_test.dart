import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/application/commerce/settle_topup.dart';
import 'package:sabzine_flutter/domain/common/failure.dart';
import 'package:sabzine_flutter/domain/commerce/commerce.dart';
import 'package:sabzine_flutter/domain/onboarding/questionnaire.dart';
import 'package:sabzine_flutter/domain/plan/meal.dart';
import 'package:sabzine_flutter/domain/plan/nutrition_source.dart';
import 'package:sabzine_flutter/features/plan/goal_math.dart';

class _Nutrition implements NutritionSource {
  @override
  final today = DateTime(2026, 11, 14);
  @override
  final questionnaire = QuestionnaireData()
    ..weight = '۸۰'
    ..targetWeight = '۷۰';
  @override
  double latestWeight = 75;
  @override
  List<double> weightEntries = [80, 75];
  @override
  final String? coachDay = null;
  @override
  final int? coachProtein = null, coachCarbs = null, coachFat = null;
  @override
  final savingMeal = false, savingSubstitution = false, savingShopping = false;
  @override
  List<Meal> mealsOn(DateTime date) => const [];
  @override
  bool mealEaten(DateTime date, int index) => false;
  @override
  Map<String, dynamic>? consumedMealOn(DateTime date, int index) => null;
  @override
  int calorieTarget(DateTime date) => 1800;
  @override
  int consumedCalories(DateTime date) => 0;
  @override
  bool hasUnknownCalories(DateTime date) => false;
}

class _HostedCommerce implements CommerceRepository {
  @override
  Future<List<String>> gateways() async => ['zarinpal'];
  @override
  Future<TopupStart> startTopup(String code, {String? gateway}) async =>
      const TopupStart(
        paymentId: 'payment',
        gateway: 'zarinpal',
        redirectUrl: 'https://gateway.test/pay',
      );
  @override
  Future<String> topupStatus(String id) async => 'pending';
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  test('goal and nutrition calculations work without a DemoStore', () {
    final source = _Nutrition();
    expect(goalOf(source).progress, 0.5);
    expect(goalOf(source).target, 70);
    expect(nutritionOn(source, source.today).targetKcal, 1800);
    expect(findNextMeal(source), isNull);
    source.questionnaire.lifeStage = 'باردار هستم';
    expect(goalOf(source).target, isNull);
    expect(goalOf(source).project, isFalse);
  });

  test(
    'a hosted top-up needs an injected browser and reports an application failure',
    () async {
      await expectLater(
        settleTopup(_HostedCommerce(), 'package'),
        throwsA(isA<CommerceException>()),
      );
      var opened = 0;
      await expectLater(
        settleTopup(
          _HostedCommerce(),
          'package',
          attempts: 1,
          pollEvery: Duration.zero,
          openUrl: (_) async {
            opened++;
          },
        ),
        throwsA(isA<CommerceException>()),
      );
      expect(opened, 1);
    },
  );

  test(
    'inner layers cannot depend transitively on Flutter or data implementations',
    () {
      final visited = <String>{};
      void inspect(File file) {
        final absolute = file.absolute.path;
        if (!visited.add(absolute)) return;
        final text = file.readAsStringSync();
        final imports = RegExp(r'''(?:import|export)\s+['"]([^'"]+)['"]''');
        for (final match in imports.allMatches(text)) {
          final uri = match.group(1)!;
          expect(uri, isNot(startsWith('package:flutter')), reason: absolute);
          expect(uri, isNot(contains('/data/')), reason: absolute);
          expect(uri, isNot(contains('/presentation/')), reason: absolute);
          if (!uri.contains(':')) inspect(File.fromUri(file.uri.resolve(uri)));
        }
      }

      for (final entry in [
        'lib/features/coach/application/coach_session.dart',
        'lib/application/commerce/settle_topup.dart',
        'lib/application/session/customer_workspace.dart',
        'lib/features/plan/goal_math.dart',
      ]) {
        inspect(File(entry));
      }
    },
  );
}
