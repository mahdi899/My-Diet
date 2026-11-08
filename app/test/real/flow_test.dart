import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/real/onboarding/controller.dart';
import 'package:sabzine_flutter/real/onboarding/onboarding_flow.dart';
import 'package:sabzine_flutter/real/onboarding/repository.dart';
import 'package:sabzine_flutter/real/onboarding/spec.dart';
import 'package:sabzine_flutter/theme.dart';
import 'onboarding_test.dart' show FakeOnboarding, specJson;

Future<void> settle(WidgetTester tester, [int ms = 700]) async {
  await tester.pump();
  await tester.pump(Duration(milliseconds: ms));
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  testWidgets(
    'full flow: track, questions, insight, conditional question, review, submit',
    (tester) async {
      tester.view.physicalSize = const Size(800, 1800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      final repo = FakeOnboarding();
      final controller = OnboardingController(
        repository: repo,
        spec: OnboardingSpec.fromJson(specJson),
        state: const OnboardingState(
          nextStep: NextStep.start,
          claimedFromDemo: false,
          track: null,
          missing: [],
        ),
        saveDelay: const Duration(milliseconds: 5),
      );
      ProfileSummary? done;
      await tester.pumpWidget(
        MaterialApp(
          theme: appTheme(),
          builder: (c, child) =>
              Directionality(textDirection: TextDirection.rtl, child: child!),
          home: OnboardingFlow(controller: controller, onDone: (p) => done = p),
        ),
      );
      await settle(tester);

      // Track step: pick "lose" and the flow moves on by itself.
      await tester.tap(find.text('lose'));
      await settle(tester, 900);
      expect(controller.current, isA<QuestionStep>());
      expect(find.text('وزن'), findsOneWidget);

      // The default value is recorded, so "continue" is enabled straight away.
      expect(controller.canAdvance, isTrue);
      await tester.tap(find.text('ادامه'));
      await settle(tester);
      expect(find.text('نکته'), findsOneWidget);
      await tester.tap(find.text('بزن بریم'));
      await settle(tester);

      expect(find.text('وزن هدف'), findsOneWidget);
      await tester.tap(find.text('ادامه'));
      await settle(tester);

      // Conditions: required, so continue stays disabled until one is picked.
      expect(find.text('بیماری'), findsOneWidget);
      expect(controller.canAdvance, isFalse);
      await tester.tap(find.text('دیابت'));
      await settle(tester);
      expect(controller.canAdvance, isTrue);

      // Diabetes reveals the insulin question right after it.
      expect(
        controller.steps.whereType<QuestionStep>().map((s) => s.question.key),
        contains('insulin'),
      );
      await tester.tap(find.text('ادامه'));
      await settle(tester);
      expect(find.text('انسولین'), findsOneWidget);
      await tester.tap(find.text('خیر'));
      await settle(tester);
      await tester.tap(find.text('ادامه'));
      await settle(tester);

      // Review: needs consent AND the held promise.
      expect(controller.current, isA<ReviewStep>());
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'ثبت و ساخت برنامه'),
            )
            .onPressed,
        isNull,
      );
      await tester.tap(find.byType(Checkbox));
      await settle(tester, 100);
      final gesture = await tester.startGesture(
        tester.getCenter(find.text('نگه دار تا به خودت قول بدی')),
      );
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await gesture.up();
      await settle(tester, 300);
      await tester.tap(find.text('ثبت و ساخت برنامه'));
      await settle(tester, 300);

      expect(repo.submitted, isTrue);
      expect(done?.targetKcal, 1700);
      // Everything the person answered reached the server draft before submit.
      final all = <String, Object?>{for (final s in repo.saved) ...s};
      expect(all['conditions'], ['diabetes']);
      expect(all['insulin'], 'no');
      expect(all['weight'], isNotNull);
      controller.dispose();
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 1));
    },
  );
}
