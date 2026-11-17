import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/day.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/presentation/widgets/kit/pill_button.dart';
import 'package:sabzine_flutter/presentation/widgets/kit/pressable_scale.dart';
import 'package:sabzine_flutter/presentation/widgets/nutrition.dart';
import 'widget_test.dart' show mobile;

void main() {
  setUpAll(() async {
    final font = FontLoader('Vazirmatn')
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'));
    await font.load();
  });
  testWidgets('Home focus shows the current meal progress in a compact card', (
    t,
  ) async {
    mobile(t);
    final s = DemoStore(clock: () => DateTime(2026, 10, 26))..loginDemoUser();
    s.approveActiveUserRequest();
    await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
    await t.pumpAndSettle();
    final focus = find.byKey(const ValueKey('home-focus-card'));
    expect(focus, findsOneWidget);
    expect(t.getSize(focus).height, lessThan(300));
    expect(find.byKey(const ValueKey('home-focus-progress')), findsOneWidget);
    expect(find.text('وعده‌های ثبت‌شده'), findsOneWidget);
    expect(find.text('هدف روزانه'), findsNothing);
    expect(find.text('کالری امروز تو'), findsNothing);
    expect(find.text('با تیک «خوردم»'), findsNothing);
    expect(find.text('توصیهٔ امروز'), findsNothing);
    await t.pumpWidget(const SizedBox());
    s.dispose();
  });
  testWidgets('Pregnancy details are secondary to current and target weights', (
    t,
  ) async {
    mobile(t);
    final s = DemoStore();
    s.questionnaire
      ..lifeStage = 'باردار هستم'
      ..targetWeight = '۸۰'
      ..pregnancyWeek = '۲۴'
      ..prePregnancyWeight = '۶۵'
      ..babies = 'تک‌قلو';
    await t.pumpWidget(
      DemoScope(
        store: s,
        child: MaterialApp(
          theme: appTheme(),
          home: const Scaffold(
            body: SingleChildScrollView(child: WeightJourneyCard()),
          ),
        ),
      ),
    );
    await t.pumpAndSettle();
    expect(find.text('وزن فعلی'), findsOneWidget);
    expect(find.text('وزن هدف'), findsOneWidget);
    expect(find.text('۸۰'), findsOneWidget);
    expect(
      t.getBottomLeft(find.text('۸۰')).dy,
      lessThan(t.getTopLeft(find.byKey(const ValueKey('pregnancy-extras'))).dy),
    );
    expect(find.text('هفتهٔ ۲۴ بارداری · تک‌قلو'), findsOneWidget);
    expect(find.text('وزن پیش از بارداری: ۶۵ کیلوگرم'), findsOneWidget);
    await t.pumpWidget(const SizedBox());
    s.dispose();
  });
  testWidgets(
    'Past days are locked in a seven-day Persian week and future meals are read-only',
    (t) async {
      mobile(t);
      final s = DemoStore(clock: () => DateTime(2026, 10, 29))..loginDemoUser();
      s.approveActiveUserRequest();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('tab-plan')));
      await t.pumpAndSettle();
      await t.scrollUntilVisible(
        find.byKey(const ValueKey('plan-day-strip')),
        250,
        scrollable: find
            .descendant(
              of: find.byKey(const ValueKey('plan-tab')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(find.text('همین هفته'), findsNothing);
      final strip = t.widget<ListView>(
        find.byKey(const ValueKey('plan-day-strip')),
      );
      expect(
        (strip.childrenDelegate as SliverChildBuilderDelegate)
            .estimatedChildCount,
        13,
      );
      final yesterday = find.byKey(const ValueKey('plan-day-4'));
      await t.ensureVisible(yesterday);
      await t.pumpAndSettle();
      expect(
        t
            .widget<PressableScale>(
              find.ancestor(
                of: yesterday,
                matching: find.byType(PressableScale),
              ),
            )
            .onTap,
        isNull,
      );
      final tomorrow = find.byKey(const ValueKey('plan-day-6'));
      await t.ensureVisible(tomorrow);
      await t.pumpAndSettle();
      expect(
        t
            .widget<PressableScale>(
              find.ancestor(
                of: tomorrow,
                matching: find.byType(PressableScale),
              ),
            )
            .onTap,
        isNotNull,
      );
      await t.tap(tomorrow);
      await t.pumpAndSettle();
      expect(find.text(persianDate(DateTime(2026, 10, 30))), findsOneWidget);
      expect(
        t
            .widget<PillButton>(
              find.widgetWithText(PillButton, 'انجام شد').first,
            )
            .onPressed,
        isNull,
      );
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
  testWidgets(
    'Meal recording saves the approved portion and leaves correction available',
    (t) async {
      mobile(t);
      final s = DemoStore(clock: () => DateTime(2026, 10, 26))..loginDemoUser();
      s.approveActiveUserRequest();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('tab-plan')));
      await t.pumpAndSettle();
      final action = find.widgetWithText(PillButton, 'انجام شد');
      await t.scrollUntilVisible(
        find.byKey(const ValueKey('plan-meal-log-0')),
        250,
        scrollable: find
            .descendant(
              of: find.byKey(const ValueKey('plan-tab')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await t.ensureVisible(action.first);
      await t.pumpAndSettle();
      await t.tap(action.first);
      await t.pumpAndSettle();
      expect(s.consumedCalories(s.today), 0);
      await t.tap(find.widgetWithText(PillButton, 'انجام شد').last);
      await t.pumpAndSettle();
      expect(s.consumedCalories(s.today), s.mealsOn(s.today).first.calories);
      expect(find.widgetWithText(PillButton, 'ثبت شد'), findsWidgets);
      expect(s.eatenCount(s.today), 1);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
}
