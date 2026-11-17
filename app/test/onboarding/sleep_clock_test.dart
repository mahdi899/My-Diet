import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/presentation/onboarding/widgets/sleep_dial.dart';

Future<void> mountClock(
  WidgetTester tester, {
  int sleep = 23,
  int wake = 7,
  double width = 390,
  double textScale = 1,
}) async {
  tester.view.physicalSize = Size(width, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  var bedtime = sleep;
  var morning = wake;
  await tester.pumpWidget(
    MaterialApp(
      theme: appTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(textScale)),
        child: Directionality(textDirection: TextDirection.rtl, child: child!),
      ),
      home: Scaffold(
        body: SingleChildScrollView(
          child: StatefulBuilder(
            builder: (context, setState) => SleepWakeDial(
              sleep: bedtime,
              wake: morning,
              onChanged: (sleep, wake) => setState(() {
                bedtime = sleep;
                morning = wake;
              }),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

SleepWakeDial clock(WidgetTester tester) =>
    tester.widget(find.byType(SleepWakeDial));

Offset hourPoint(WidgetTester tester, int hour) {
  final rect = tester.getRect(find.byKey(const ValueKey('sleep-clock')));
  final angle = hour % 12 / 12 * math.pi * 2 - math.pi / 2;
  final radius = rect.width / 2 - 20;
  return rect.center + Offset(math.cos(angle), math.sin(angle)) * radius;
}

Future<void> dragHour(WidgetTester tester, int from, int to) async {
  final start = hourPoint(tester, from);
  final end = hourPoint(tester, to);
  final gesture = await tester.startGesture(start);
  await gesture.moveTo(Offset.lerp(start, end, .35)!);
  await tester.pump();
  await gesture.moveTo(end);
  await tester.pump();
  await gesture.up();
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('twelve-hour readout retains unambiguous stored 24-hour times', (
    tester,
  ) async {
    await mountClock(tester);
    expect(find.text('۱۱:۰۰'), findsOneWidget);
    expect(find.text('۰۷:۰۰'), findsOneWidget);
    expect(clock(tester).sleep, 23);
    expect(clock(tester).wake, 7);
    expect(
      tester
          .widget<ChoiceChip>(find.byKey(const ValueKey('sleep-period-pm')))
          .selected,
      isTrue,
    );
    expect(
      tester
          .widget<ChoiceChip>(find.byKey(const ValueKey('wake-period-am')))
          .selected,
      isTrue,
    );
    await tester.tap(find.byKey(const ValueKey('sleep-period-am')));
    await tester.pumpAndSettle();
    expect(clock(tester).sleep, 11);
    expect(clock(tester).wake, 7);
  });

  testWidgets(
    'dragging uses normal clock positions and carries midnight forward',
    (tester) async {
      await mountClock(tester);
      await dragHour(tester, 11, 12);
      expect(clock(tester).sleep, 0);
      expect(clock(tester).wake, 7);
      expect(find.text('۱۲:۰۰'), findsOneWidget);
      expect(
        tester
            .widget<ChoiceChip>(find.byKey(const ValueKey('sleep-period-am')))
            .selected,
        isTrue,
      );
    },
  );

  testWidgets(
    'dragging backward through midnight restores the previous evening',
    (tester) async {
      await mountClock(tester, sleep: 0, wake: 7);
      await dragHour(tester, 12, 11);
      expect(clock(tester).sleep, 23);
      expect(clock(tester).wake, 7);
    },
  );

  testWidgets('wake handle moves clockwise while preserving the sleep time', (
    tester,
  ) async {
    await mountClock(tester);
    await dragHour(tester, 7, 8);
    expect(clock(tester).sleep, 23);
    expect(clock(tester).wake, 8);
  });

  testWidgets('overlapping handles use the selected time card', (tester) async {
    await mountClock(tester, sleep: 23, wake: 11);
    await tester.tap(find.byKey(const ValueKey('wake-time-card')));
    await tester.pumpAndSettle();
    await dragHour(tester, 11, 12);
    expect(clock(tester).sleep, 23);
    expect(clock(tester).wake, 12);
  });

  testWidgets('hour buttons wrap 23 to 00 with the correct period', (
    tester,
  ) async {
    await mountClock(tester);
    await tester.tap(find.byTooltip('خواب، یک ساعت بعد'));
    await tester.pumpAndSettle();
    expect(clock(tester).sleep, 0);
    await tester.tap(find.byTooltip('خواب، یک ساعت قبل'));
    await tester.pumpAndSettle();
    expect(clock(tester).sleep, 23);
  });

  testWidgets('large text and period selectors fit a narrow mobile screen', (
    tester,
  ) async {
    await mountClock(tester, width: 320, textScale: 1.5);
    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.byKey(const ValueKey('wake-period-pm')));
    await tester.tap(find.byKey(const ValueKey('wake-period-pm')));
    await tester.pumpAndSettle();
    expect(clock(tester).wake, 19);
    expect(tester.takeException(), isNull);
  });
}
