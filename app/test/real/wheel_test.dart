import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/real/onboarding/widgets/number_inputs.dart';

void main() {
  // Regression: the onboarding page puts non-list questions inside a scroll view, which gives
  // children unbounded height. The age wheel used to throw "infinite size" there.
  testWidgets('age wheel lays out inside a scroll view and reports changes', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    var age = 30;
    await tester.pumpWidget(
      MaterialApp(
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            body: Column(
              children: [
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      child: AgeWheel(
                        value: age,
                        min: 18,
                        max: 100,
                        onChanged: (v) => age = v,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
    expect(find.byType(AgeWheel), findsOneWidget);
    await tester.drag(find.byType(AgeWheel), const Offset(0, -124));
    await tester.pumpAndSettle();
    expect(age, greaterThan(30));
  });
}
