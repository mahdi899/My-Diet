// flutter test tool/capture_all_onboarding_icons.dart --update-goldens
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/domain/onboarding/spec.dart';
import 'package:sabzine_flutter/domain/onboarding/onboarding.dart';
import 'package:sabzine_flutter/presentation/onboarding/controller.dart';
import 'package:sabzine_flutter/presentation/onboarding/onboarding_flow.dart';
import 'package:sabzine_flutter/presentation/onboarding/widgets/onboarding_icons.dart';
import '../test/onboarding/onboarding_test.dart' show FakeOnboarding;
import 'capture_onboarding_icons.dart' show preview;

const _out =
    '../../references/flutter-app-review/2026-11-17/all-onboarding-icons';
const _groups = <String, Map<DietIconKind, String>>{
  'health': {
    DietIconKind.bloodSugar: 'قند خون',
    DietIconKind.bloodPressure: 'فشار خون',
    DietIconKind.kidneys: 'کلیه',
    DietIconKind.thyroid: 'تیروئید',
    DietIconKind.stomach: 'گوارش',
    DietIconKind.bloodDrop: 'کم‌خونی',
    DietIconKind.medicalNotes: 'توصیه پزشک',
    DietIconKind.heartburn: 'سوزش معده',
    DietIconKind.intestines: 'روده',
    DietIconKind.nausea: 'تهوع',
  },
  'food-and-habits': {
    DietIconKind.balancedMeal: 'غذای متعادل',
    DietIconKind.vegetarianMeal: 'گیاه‌خواری',
    DietIconKind.veganMeal: 'وگان',
    DietIconKind.cookingPot: 'آماده‌سازی غذا',
    DietIconKind.snack: 'میان‌وعده',
    DietIconKind.sweets: 'شیرینی',
    DietIconKind.fastFood: 'فست‌فود',
    DietIconKind.fruitBasket: 'میوه و سبزی',
    DietIconKind.homeCooking: 'غذای خانگی',
    DietIconKind.irregularMeals: 'وعده نامنظم',
  },
  'activity-and-goals': {
    DietIconKind.standing: 'سرپا',
    DietIconKind.workout: 'ورزش ترکیبی',
    DietIconKind.calendar: 'روزهای ورزش',
    DietIconKind.slowPace: 'آهسته',
    DietIconKind.steadyPace: 'تدریجی',
    DietIconKind.goalReached: 'نتیجه موفق',
    DietIconKind.firstPlan: 'اولین رژیم',
    DietIconKind.weightReturn: 'بازگشت وزن',
    DietIconKind.pausedPlan: 'توقف رژیم',
    DietIconKind.stress: 'استرس',
  },
  'maternal-and-rest': {
    DietIconKind.baby: 'نوزاد',
    DietIconKind.breastfeeding: 'شیردهی',
    DietIconKind.babyBottle: 'شیر ترکیبی',
    DietIconKind.vitamin: 'مکمل',
    DietIconKind.bed: 'کیفیت خواب',
    DietIconKind.sunrise: 'صبح',
    DietIconKind.sunset: 'عصر',
    DietIconKind.question: 'پاسخ نامشخص',
    DietIconKind.pregnancy: 'بارداری',
    DietIconKind.medicine: 'دارو',
  },
};

void main() {
  setUpAll(() async {
    final fonts = FontLoader('Vazirmatn')
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'));
    await fonts.load();
  });
  testWidgets('render remaining icon families', (tester) async {
    tester.view.physicalSize = const Size(620, 350);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    for (final group in _groups.entries) {
      await tester.pumpWidget(
        preview(
          Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(16),
              child: Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  for (final item in group.value.entries)
                    Container(
                      width: 108,
                      height: 146,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0F8F3),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          DietIcon(
                            item.key,
                            size: 82,
                            variant: item.key == DietIconKind.fruitBasket
                                ? 3
                                : 0,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            item.value,
                            style: const TextStyle(fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_out/${group.key}.png'),
      );
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('every questionnaire page renders and its last option is reachable', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final source =
        jsonDecode(
              File(
                '../references/flutter-app-review/2026-11-15/onboarding-spec.json',
              ).readAsStringSync(),
            )
            as Map<String, dynamic>;
    final spec = OnboardingSpec.fromJson(source);
    for (final question in spec.questions) {
      final hasChoices =
          question.kind == QuestionKind.single ||
          question.kind == QuestionKind.multi ||
          question.kind == QuestionKind.dishPicker;
      final controller = OnboardingController(
        repository: FakeOnboarding(),
        spec: spec,
        state: OnboardingState(
          nextStep: NextStep.start,
          claimedFromDemo: false,
          track: question.tracks?.first ?? spec.tracks.first.id,
          missing: const [],
        ),
      );
      // Isolate each server question to audit every conditional branch's real renderer.
      controller.steps = [QuestionStep(question)];
      controller.index = 0;
      controller.answers['weight_kg'] = 80;
      if (hasChoices && question.options.isNotEmpty) {
        controller.answers[question.key] = question.kind == QuestionKind.multi
            ? [question.options.first.code]
            : question.options.first.code;
      }
      await tester.pumpWidget(
        preview(
          OnboardingFlow(
            key: ValueKey(question.key),
            controller: controller,
            onDone: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: question.key);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_out/pages/${question.key}.png'),
      );
      if (hasChoices && question.options.isNotEmpty) {
        final last = find.text(question.options.last.label);
        await tester.ensureVisible(last);
        await tester.pumpAndSettle();
        expect(last.hitTestable(), findsOneWidget, reason: question.key);
        final icons = tester.widgetList<DietIcon>(find.byType(DietIcon));
        for (final option in question.options) {
          expect(
            hasOnboardingSymbol(question.key, option.code),
            isTrue,
            reason: '${question.key}/${option.code}',
          );
          expect(
            icons.any(
              (icon) =>
                  icon.kind == onboardingSymbol(question.key, option.code) &&
                  icon.variant == onboardingVariant(question.key, option.code),
            ),
            isTrue,
            reason:
                'Artwork variant missing for ${question.key}/${option.code}',
          );
        }
      }
      await tester.pumpWidget(const SizedBox());
      controller.dispose();
    }
  });
}
