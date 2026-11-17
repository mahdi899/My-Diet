// flutter test tool/capture_fast_food_icons.dart --update-goldens
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

const _out =
    '../../references/flutter-app-review/2026-11-17/fast-food-frequency-icons';
const _choices = [
  (DietIconKind.fastFood, 1, 'به‌ندرت'),
  (DietIconKind.fastFood, 2, '۱ تا ۲ بار در هفته'),
  (DietIconKind.fastFood, 3, '۳ تا ۴ بار در هفته'),
  (DietIconKind.fastFood, 4, 'تقریباً هر روز'),
];

void main() {
  setUpAll(() async {
    final fonts = FontLoader('Vazirmatn')
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'));
    await fonts.load();
  });
  testWidgets('render distinct fast food frequency illustrations', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(620, 212);
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
                    width: 138,
                    height: 172,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0F8F3),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        DietIcon(item.$1, variant: item.$2, size: 104),
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
    for (final key in ['fast_food_freq']) {
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
      controller.answers[key] = question.options[2].code;
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
