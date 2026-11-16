import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/presentation/onboarding/widgets/number_inputs.dart';
import 'package:sabzine_flutter/presentation/onboarding/widgets/onboarding_icons.dart';

Future<void> showDial(
  WidgetTester tester, {
  double initial = 73.5,
  double min = 35,
  double max = 240,
}) async {
  tester.view.physicalSize = const Size(320, 700);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  var weight = initial;
  await tester.pumpWidget(
    MaterialApp(
      theme: appTheme(),
      locale: const Locale('fa'),
      supportedLocales: const [Locale('fa')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: Scaffold(
        body: Center(
          child: SingleChildScrollView(
            child: StatefulBuilder(
              builder: (context, setState) => WeightDial(
                value: weight,
                min: min,
                max: max,
                step: .5,
                unit: 'کیلوگرم',
                onChanged: (next) => setState(() => weight = next),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> openEntry(WidgetTester tester) async {
  await tester.tap(find.text('وارد کردن وزن'));
  await tester.pumpAndSettle();
}

double selectedWeight(WidgetTester tester) =>
    tester.widget<WeightDial>(find.byType(WeightDial)).value;

void main() {
  testWidgets('direct entry accepts localized decimals and large changes', (
    tester,
  ) async {
    await showDial(tester);
    for (final entry in {
      '۱۵۰٫۵': 150.5,
      '٤٥.٢': 45.2,
      '101,3': 101.3,
      '۷۳/۵': 73.5,
    }.entries) {
      await openEntry(tester);
      final input = tester.widget<TextFormField>(find.byType(TextFormField));
      expect(input.controller!.selection.baseOffset, 0);
      expect(
        input.controller!.selection.extentOffset,
        input.controller!.text.length,
      );
      await tester.enterText(find.byType(TextFormField), entry.key);
      await tester.tap(find.text('ثبت وزن'));
      await tester.pumpAndSettle();
      expect(selectedWeight(tester), entry.value);
      expect(find.byType(AlertDialog), findsNothing);
      expect(tester.takeException(), isNull);
    }
    await tester.tap(
      find.byWidgetPredicate(
        (widget) =>
            widget is OnboardingIcon &&
            widget.icon == Icons.arrow_upward_rounded,
      ),
    );
    await tester.pumpAndSettle();
    expect(selectedWeight(tester), 74);
  });

  testWidgets('invalid or out-of-range entries do not replace the answer', (
    tester,
  ) async {
    await showDial(tester, min: 60, max: 79.5);
    await openEntry(tester);
    for (final text in ['', 'NaN', 'Infinity', '-1', '70.25', '59.9', '80']) {
      await tester.enterText(find.byType(TextFormField), text);
      await tester.tap(find.text('ثبت وزن'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(selectedWeight(tester), 73.5);
      expect(tester.takeException(), isNull);
    }
    expect(find.text('وزن باید بین ۶۰ و ۷۹٫۵ باشد'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField), '۷۹٫۵');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    expect(selectedWeight(tester), 79.5);
    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets(
    'cancel preserves the weight and reopening shows the saved answer',
    (tester) async {
      await showDial(tester);
      await openEntry(tester);
      await tester.enterText(find.byType(TextFormField), '200');
      await tester.tap(find.text('انصراف'));
      await tester.pumpAndSettle();
      expect(selectedWeight(tester), 73.5);
      await openEntry(tester);
      final input = tester.widget<TextFormField>(find.byType(TextFormField));
      expect(input.controller!.text, '۷۳٫۵');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('entry remains usable with a keyboard on a narrow screen', (
    tester,
  ) async {
    await showDial(tester, min: 80.5, max: 240, initial: 90);
    await openEntry(tester);
    tester.view.viewInsets = const FakeViewPadding(bottom: 300);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), '۸۰٫۵');
    await tester.ensureVisible(find.text('ثبت وزن'));
    await tester.tap(find.text('ثبت وزن'));
    await tester.pumpAndSettle();
    expect(selectedWeight(tester), 80.5);
    expect(tester.takeException(), isNull);
  });
}
