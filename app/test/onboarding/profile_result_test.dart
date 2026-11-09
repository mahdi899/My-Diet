import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/presentation/onboarding/profile_result.dart';
import 'package:sabzine_flutter/domain/onboarding/onboarding.dart';

void main() {
  // Regression: the screen used to stay on "100%" forever because nothing rebuilt it
  // after the animation reported "completed".
  testWidgets('moves from the working view to the result and can continue', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    var continued = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: ProfileResultScreen(
            profile: ProfileSummary.fromJson({
              'track': 'lose',
              'bmi': 24.5,
              'weightKg': 70,
              'heightCm': 170,
              'age': 30,
              'bmrKcal': 1500,
              'tdeeKcal': 2000,
              'targetKcal': 1700,
              'proteinG': 120,
              'carbsG': 180,
              'fatG': 55,
              'safetyTier': 'standard',
            }),
            onContinue: () => continued++,
          ),
        ),
      ),
    );
    expect(find.text('در حال ساخت برنامه شما'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    expect(find.text('در حال ساخت برنامه شما'), findsNothing);
    final button = find.text('شروع کن');
    expect(button, findsOneWidget);
    await tester.ensureVisible(button);
    await tester.tap(button);
    expect(continued, 1);
  });
}
