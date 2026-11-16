import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/home_tab.dart';
import 'package:sabzine_flutter/features/home/home_day_focus.dart';
import 'package:sabzine_flutter/features/plan/plan_tab.dart';
import 'package:sabzine_flutter/features/plan/plan_meals.dart';
import 'package:sabzine_flutter/features/plan/consume_sheet.dart';
import 'package:shared_preferences/shared_preferences.dart';

Widget host(DemoStore store, Widget page) {
  return DemoScope(
    store: store,
    child: MaterialApp(
      theme: appTheme(),
      builder: (context, child) {
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(disableAnimations: true),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: child!,
          ),
        );
      },
      home: Scaffold(body: page),
    ),
  );
}

void phone(WidgetTester tester) {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Future<void> settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 200));
}

void main() {
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    final font = FontLoader('Vazirmatn')
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'));
    await font.load();
  });

  testWidgets('PlanTab renders a published demo plan', (tester) async {
    phone(tester);
    final store = DemoStore(clock: () => DateTime(2026, 11, 9, 9, 30))
      ..loginDemoUser();
    store.questionnaire.targetWeight = '۶۵';
    store.approveActiveUserRequest();
    addTearDown(store.dispose);

    await tester.pumpWidget(host(store, const PlanTab()));
    await settle(tester);

    expect(find.byType(PlanTab), findsOneWidget);
    expect(find.byKey(const ValueKey('plan-hero')), findsOneWidget);
    expect(find.text('شروع کن'), findsOneWidget);
    final list = find.byType(ListView).first;
    for (var i = 0; i < 6 && find.text('تعویض').evaluate().isEmpty; i++) {
      await tester.drag(list, const Offset(0, -450));
      await tester.pump();
    }
    expect(find.text('تعویض'), findsWidgets);
    expect(find.text(store.mealsOn(store.today).first.title), findsWidgets);
    for (var i = 0; i < 8 && find.text('لیست خرید').evaluate().isEmpty; i++) {
      await tester.drag(list, const Offset(0, -450));
      await tester.pump();
    }
    expect(find.text('لیست خرید'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(milliseconds: 50));
  });

  testWidgets('PlanTab shows the waiting state before a plan is published', (
    tester,
  ) async {
    phone(tester);
    final store = DemoStore(clock: () => DateTime(2026, 11, 9, 9, 30))
      ..loginDemoUser();
    addTearDown(store.dispose);

    await tester.pumpWidget(host(store, const PlanTab()));
    await settle(tester);

    expect(find.byKey(const ValueKey('plan-waiting')), findsOneWidget);
    expect(find.byKey(const ValueKey('plan-progress-card')), findsOneWidget);
    expect(find.text('بررسی متخصص'), findsOneWidget);
    expect(find.text('نمایش برنامه'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(milliseconds: 50));
  });

  testWidgets('PlanTab shows an empty state without a request', (tester) async {
    phone(tester);
    final store = DemoStore(clock: () => DateTime(2026, 11, 9, 9, 30));
    addTearDown(store.dispose);

    await tester.pumpWidget(host(store, const PlanTab()));
    await settle(tester);

    expect(find.byKey(const ValueKey('plan-empty')), findsOneWidget);
    expect(find.text('هنوز برنامه‌ای نداری'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('HomeTab renders today with DemoStore', (tester) async {
    phone(tester);
    final store = DemoStore(clock: () => DateTime(2026, 11, 9, 9, 30))
      ..loginDemoUser();
    store.approveActiveUserRequest();
    addTearDown(store.dispose);

    await tester.pumpWidget(host(store, const HomeTab()));
    await settle(tester);

    expect(find.byType(HomeTab), findsOneWidget);
    expect(find.text('صبح بخیر'), findsOneWidget);
    expect(find.text('سلام سارا جان'), findsOneWidget);
    expect(find.byKey(const ValueKey('home-calorie-ring')), findsOneWidget);
    expect(find.text('کالری'), findsOneWidget);
    expect(find.byKey(const ValueKey('home-next-meal')), findsOneWidget);
    expect(
      find.text(HomeDayFocus.from(store).next!.meal.title),
      findsOneWidget,
    );
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('home-water')),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.byKey(const ValueKey('home-water')), findsOneWidget);
    expect(find.text('۰ از ۶ لیوان'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('ثبت وزن'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('ثبت وزن'), findsOneWidget);
    expect(find.text('تعویض'), findsNothing);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(milliseconds: 50));
  });

  testWidgets('completing a plan meal uses the store', (tester) async {
    phone(tester);
    final store = DemoStore(clock: () => DateTime(2026, 11, 9, 9, 30))
      ..loginDemoUser();
    store.approveActiveUserRequest();
    addTearDown(store.dispose);

    await tester.pumpWidget(host(store, const PlanTab()));
    await settle(tester);

    final firstMeal = find.byWidgetPredicate(
      (widget) => widget is PlanMealCard && widget.index == 0,
    );
    await tester.scrollUntilVisible(
      firstMeal,
      220,
      scrollable: find.byType(Scrollable).first,
    );
    final done = find.descendant(
      of: firstMeal,
      matching: find.text('انجام شد'),
    );
    await tester.ensureVisible(done);
    await tester.pump();
    await tester.tap(done.first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    // Opening the consumption sheet does not record a meal until confirmed.
    expect(store.mealEaten(store.today, 0), isFalse);
    final confirm = find.descendant(
      of: find.byType(ConsumeSheet),
      matching: find.text('انجام شد'),
    );
    await tester.tap(confirm);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(store.mealEaten(store.today, 0), isTrue);
    expect(find.text('ثبت شد'), findsWidgets);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(milliseconds: 50));
  });
}
