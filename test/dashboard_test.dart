import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/day.dart';
import 'package:sabzine_flutter/theme.dart';
import 'package:sabzine_flutter/widgets/nutrition.dart';
import 'package:sabzine_flutter/widgets/celebration.dart';
import 'package:sabzine_flutter/widgets/ui.dart';
import 'widget_test.dart' show mobile;

void main() {
  setUpAll(() async {
    final font = FontLoader('Vazirmatn')
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'));
    await font.load();
  });
  testWidgets(
    'Compact energy retains its metrics and pastel message follows immediately',
    (t) async {
      mobile(t);
      final s = DemoStore(clock: () => DateTime(2026, 10, 26))..loginDemoUser();
      s.approveActiveUserRequest();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      final energy = find.byKey(const ValueKey('daily-energy-card')),
          advice = find.byKey(const ValueKey('daily-advice'));
      expect(t.getSize(energy).height, lessThan(260));
      expect(find.text(persianDate(s.today, year: true)), findsOneWidget);
      expect(
        find.byKey(const ValueKey('daily-calorie-target')),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('consumed-calories')), findsOneWidget);
      expect(find.text('هدف روزانه'), findsOneWidget);
      expect(find.text('با تیک «خوردم»'), findsOneWidget);
      expect(
        t.getTopLeft(advice).dy - t.getBottomLeft(energy).dy,
        closeTo(18, 1),
      );
      expect(t.widget<Surface>(advice).color, const Color(0xFFEAF3E4));
      expect(find.text('توصیهٔ امروز'), findsNothing);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
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
      await t.tap(find.byType(NavigationDestination).at(1));
      await t.pumpAndSettle();
      expect(find.text('همین هفته'), findsOneWidget);
      final list = t.widget<ListView>(find.byType(ListView));
      expect(
        (list.childrenDelegate as SliverChildBuilderDelegate)
            .estimatedChildCount,
        13,
      );
      final yesterday = find.byKey(const ValueKey('plan-day-4'));
      expect(t.widget<InkWell>(yesterday).onTap, isNull);
      final tomorrow = find.byKey(const ValueKey('plan-day-6'));
      expect(t.widget<InkWell>(tomorrow).onTap, isNotNull);
      await t.ensureVisible(tomorrow);
      await t.pumpAndSettle();
      await t.tap(tomorrow);
      await t.pumpAndSettle();
      expect(find.text(persianDate(DateTime(2026, 10, 30))), findsOneWidget);
      final checkbox = find.descendant(
        of: find.byType(ScheduledMealTile).first,
        matching: find.byType(Checkbox),
      );
      expect(t.widget<Checkbox>(checkbox).onChanged, isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
  testWidgets(
    'Successful meal check celebrates once then disables the whole meal',
    (t) async {
      mobile(t);
      final s = DemoStore(clock: () => DateTime(2026, 10, 26))..loginDemoUser();
      s.approveActiveUserRequest();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      final tile = find.byType(ScheduledMealTile).first;
      final check = find.descendant(of: tile, matching: find.byType(Checkbox));
      await t.ensureVisible(check);
      await t.pumpAndSettle();
      await t.tap(check);
      await t.pump();
      await t.pump(const Duration(milliseconds: 200));
      expect(find.byType(MealCelebration), findsOneWidget);
      expect(s.consumedCalories(s.today), s.mealsOn(s.today).first.calories);
      expect(t.widget<Checkbox>(check).onChanged, isNull);
      expect(
        t
            .widget<Surface>(
              find.descendant(of: tile, matching: find.byType(Surface)),
            )
            .onTap,
        isNull,
      );
      await t.pump(const Duration(seconds: 3));
      await t.pump();
      expect(find.byType(MealCelebration), findsNothing);
      expect(s.eatenCount(s.today), 1);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
}
