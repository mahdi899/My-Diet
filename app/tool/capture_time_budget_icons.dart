// flutter test tool/capture_time_budget_icons.dart --update-goldens
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/icons/diet_icon.dart';
import 'package:sabzine_flutter/domain/onboarding/spec.dart';
import 'package:sabzine_flutter/domain/onboarding/onboarding.dart';
import 'package:sabzine_flutter/presentation/onboarding/controller.dart';
import 'package:sabzine_flutter/presentation/onboarding/onboarding_flow.dart';
import '../test/onboarding/onboarding_test.dart' show FakeOnboarding;
import 'capture_onboarding_icons.dart' show preview;

const _out = '../../references/flutter-app-review/2026-11-17/time-budget-icons';
const _choices = [
  (DietIconKind.cookingPot, 15, 'کمتر از ۱۵ دقیقه'),
  (DietIconKind.cookingPot, 30, '۱۵ تا ۳۰ دقیقه'),
  (DietIconKind.cookingPot, 60, 'بیشتر'),
  (DietIconKind.wallet, 1, 'اقتصادی'),
  (DietIconKind.wallet, 2, 'متوسط'),
  (DietIconKind.wallet, 3, 'بدون محدودیت'),
];

void main() {
  setUpAll(() async {
    final fonts = FontLoader('Vazirmatn')
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'));
    await fonts.load();
  });
  testWidgets('render distinct preparation and budget illustrations', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(620, 400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      preview(
        Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                for (final item in _choices)
                  Container(
                    width: 188,
                    height: 172,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0F8F3),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        DietIcon(item.$1, variant: item.$2, size: 112),
                        const SizedBox(height: 8),
                        Text(item.$3, style: const TextStyle(fontSize: 13)),
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
      matchesGoldenFile('$_out/family.png'),
    );
    expect(tester.takeException(), isNull);

    tester.view.physicalSize = const Size(390, 844);
    final spec = OnboardingSpec.fromJson(
      jsonDecode(
        File(
          '../references/flutter-app-review/2026-11-15/onboarding-spec.json',
        ).readAsStringSync(),
      ),
    );
    for (final key in ['prep_time', 'budget']) {
      final question = spec.byKey(key)!;
      final controller = OnboardingController(
        repository: FakeOnboarding(),
        spec: spec,
        state: OnboardingState(
          nextStep: NextStep.start,
          claimedFromDemo: false,
          track: spec.tracks.first.id,
          missing: const [],
        ),
      );
      controller.steps = [QuestionStep(question)];
      controller.index = 0;
      controller.answers[key] = question.options[1].code;
      await tester.pumpWidget(
        preview(
          OnboardingFlow(
            key: ValueKey(key),
            controller: controller,
            onDone: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_out/$key.png'),
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      controller.dispose();
    }
  });
}
