import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/domain/onboarding/spec.dart';
import 'package:sabzine_flutter/presentation/onboarding/widgets/choices.dart';
import 'package:sabzine_flutter/presentation/onboarding/widgets/onboarding_icons.dart';

void main() {
  test('shared answer codes resolve in the context of their question', () {
    expect(onboardingSymbol('activity', 'low'), DietIconKind.walking);
    expect(onboardingSymbol('budget', 'low'), DietIconKind.wallet);
    expect(onboardingSymbol('appetite', 'low'), DietIconKind.meal);
    expect(onboardingSymbol('job_activity', 'mixed'), DietIconKind.walking);
    expect(onboardingSymbol('feeding_mode', 'mixed'), DietIconKind.pregnancy);
    expect(onboardingSymbol('sport_type', 'strength'), DietIconKind.strength);
    expect(onboardingSymbol('conditions', 'none'), DietIconKind.shield);
    expect(onboardingSymbol('water', 'under_4'), DietIconKind.water);
    expect(onboardingSymbol('allergies', 'dairy'), DietIconKind.dairy);
    expect(onboardingSymbol('allergies', 'nuts'), DietIconKind.nuts);
    expect(onboardingSymbol('allergies', 'egg'), DietIconKind.egg);
    expect(onboardingSymbol('allergies', 'gluten'), DietIconKind.wheat);
    expect(onboardingSymbol('allergies', 'other'), DietIconKind.foodAllergy);
    expect(onboardingSymbol('allergies', 'none'), DietIconKind.shield);
    expect(onboardingSymbol('meals_per_day', '1'), DietIconKind.mealOne);
    expect(onboardingSymbol('meals_per_day', '2'), DietIconKind.mealTwo);
    expect(onboardingSymbol('meals_per_day', '3'), DietIconKind.mealThree);
    expect(onboardingSymbol('meals_per_day', '4_plus'), DietIconKind.mealMore);
  });

  testWidgets(
    'activity uses five distinct brand icons even with food image ids',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final question = SpecQuestion.fromJson({
        'key': 'activity',
        'group': 'basics',
        'kind': 'single',
        'title': 'میزان فعالیت روزانه‌ات چقدره؟',
        'required': true,
        'options': [
          for (final entry in {
            'very_low': 'خیلی کم',
            'low': 'کم',
            'medium': 'متوسط',
            'high': 'زیاد',
            'very_high': 'خیلی زیاد',
          }.entries)
            {
              'code': entry.key,
              'label': entry.value,
              'image': 'persian_health_salad_photography',
            },
        ],
      });
      String? selected;
      await tester.pumpWidget(
        MaterialApp(
          theme: appTheme(),
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              body: Center(
                child: SingleChoice(
                  question: question,
                  value: 'very_low',
                  onChanged: (value) => selected = value,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final topics = tester
          .widgetList<DietIcon>(find.byType(DietIcon))
          .map((icon) => icon.kind)
          .where((kind) => kind != DietIconKind.check);
      expect(topics, [
        DietIconKind.seated,
        DietIconKind.walking,
        DietIconKind.cycling,
        DietIconKind.running,
        DietIconKind.strength,
      ]);
      expect(find.byType(Image), findsNothing);
      await tester.tap(find.text('زیاد'));
      expect(selected, 'high');
      expect(tester.takeException(), isNull);
    },
  );
}
