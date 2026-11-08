import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/presentation/session/live_plan.dart';
import 'package:sabzine_flutter/domain/plan/plan.dart';

void main() {
  test('a published plan shows on the original home for that day', () {
    final store = DemoStore();
    showServerPlan(
      store,
      name: 'نگار رضایی',
      track: 'weight_loss',
      targetKcal: 1525,
      plan: PublishedPlan.fromJson({
        'requestId': 'req-1',
        'weekStart': '2026-11-07',
        'expired': false,
        'days': [
          {
            'date': '2026-11-08',
            'dayIndex': 1,
            'meals': [
              {
                'mealUid': 'm1',
                'mealType': 'breakfast',
                'suggestedTime': '08:00',
                'title': 'نان و سرشیر',
                'calories': 400,
                'options': [
                  {
                    'optionId': 'p',
                    'kind': 'primary',
                    'title': 'نان و سرشیر',
                    'calories': 400,
                    'preparationMinutes': 10,
                    'instructions': 'سرو شود',
                    'ingredients': [
                      {'name': 'نان'},
                    ],
                  },
                  {
                    'optionId': 'a',
                    'kind': 'ai_alternative',
                    'title': 'عدسی',
                    'calories': 350,
                    'preparationMinutes': 20,
                    'instructions': 'بپز',
                    'ingredients': [
                      {'name': 'عدس'},
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect(store.liveReady, isTrue);
    expect(store.questionnaire.name, 'نگار رضایی');
    expect(store.questionnaire.goal, 'کاهش وزن');
    final meals = store.mealsOn(DateTime(2026, 11, 8));
    expect(meals, hasLength(1));
    expect(meals.single.title, 'نان و سرشیر');
    expect(meals.single.alternatives.single.meal.title, 'عدسی');
    expect(store.mealsOn(DateTime(2026, 11, 7)), isEmpty);
    expect(store.calorieTarget(DateTime(2026, 11, 8)), 1525);
    expect(store.serverMealUids['2026-11-08|0'], 'm1');
  });
}
