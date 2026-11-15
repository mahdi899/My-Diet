import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/presentation/profile_goal_card.dart';

Future<void> showGoal(
  WidgetTester tester,
  DemoStore store, {
  double width = 390,
  double scale = 1,
  VoidCallback? onEdit,
}) async {
  tester.view.physicalSize = Size(width, 1100);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    MaterialApp(
      theme: appTheme(),
      home: MediaQuery(
        data: MediaQueryData(
          size: Size(width, 1100),
          textScaler: TextScaler.linear(scale),
        ),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(18),
              child: ProfileGoalCard(source: store, onEdit: onEdit ?? () {}),
            ),
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets(
    'Healthy eating shows current weight and provides an edit action',
    (tester) async {
      final store = DemoStore();
      var edits = 0;
      await showGoal(tester, store, onEdit: () => edits++);
      expect(find.text('تغذیهٔ سالم'), findsOneWidget);
      expect(find.text('وزن فعلی'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsNothing);
      await tester.tap(find.text('ویرایش هدف'));
      expect(edits, 1);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets('Weight goal shows measured progress and completion', (
    tester,
  ) async {
    final store = DemoStore()..latestWeight = 75;
    store.questionnaire
      ..goal = 'کاهش وزن'
      ..weight = '۸۰'
      ..targetWeight = '۷۰';
    await showGoal(tester, store);
    expect(
      tester
          .widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator))
          .value,
      .5,
    );
    expect(find.text('۵ کیلو تا هدف'), findsOneWidget);
    store.latestWeight = 70;
    await showGoal(tester, store);
    expect(
      tester
          .widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator))
          .value,
      1,
    );
    expect(find.text('به وزن هدفت رسیدی'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets('Pregnancy hides weight target and projected progress', (
    tester,
  ) async {
    final store = DemoStore();
    store.questionnaire
      ..goal = 'کاهش وزن'
      ..targetWeight = '۶۰'
      ..lifeStage = 'باردار هستم';
    await showGoal(tester, store);
    expect(find.text('وزن هدف'), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets('Narrow screens accommodate larger accessibility text', (
    tester,
  ) async {
    final store = DemoStore()..latestWeight = 95.5;
    store.questionnaire
      ..goal = 'کاهش وزن'
      ..weight = '۱۰۰'
      ..targetWeight = '۸۰';
    await showGoal(tester, store, width: 320, scale: 1.8);
    expect(find.text('وزن فعلی'), findsOneWidget);
    expect(find.text('وزن هدف'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });
}
