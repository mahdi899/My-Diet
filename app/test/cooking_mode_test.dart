import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/domain/plan/meal.dart';
import 'package:sabzine_flutter/features/plan/cooking_page.dart';

const cookingMeal = Meal(
  name: 'ناهار',
  title: 'خوراک مرغ و هویج',
  time: '۱۲:۳۰',
  amount: 'یک وعده',
  details: '',
  instructions:
      'هویج را خرد کن.\nمرغ را اضافه کن و طبق دستور بپز.\nغذا را سرو کن.',
  ingredients: [
    MealIngredient('carrot', 'هویج', 100, 'گرم'),
    MealIngredient('chicken', 'مرغ', 150, 'گرم'),
  ],
);

Widget cookingHost(Widget child, {double scale = 1}) => MaterialApp(
  theme: appTheme(),
  debugShowCheckedModeBanner: false,
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(
      context,
    ).copyWith(disableAnimations: true, textScaler: TextScaler.linear(scale)),
    child: Directionality(textDirection: TextDirection.rtl, child: child!),
  ),
  home: child,
);

Future<void> tapCooking(WidgetTester t, Finder finder) async {
  if (finder.evaluate().isEmpty) {
    await t.scrollUntilVisible(
      finder,
      140,
      scrollable: find.byType(Scrollable).first,
    );
  }
  await t.ensureVisible(finder);
  await t.pumpAndSettle();
  await t.tap(finder);
  await t.pumpAndSettle();
}

void main() {
  testWidgets(
    'step ingredients are grounded in the recipe and missing details stay explicit',
    (t) async {
      t.view.physicalSize = const Size(320, 720);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      await t.pumpWidget(
        cookingHost(const CookingPage(meal: cookingMeal), scale: 1.5),
      );
      await t.pumpAndSettle();
      expect(find.text('مرحلهٔ ۱ از ۳'), findsOneWidget);
      await t.scrollUntilVisible(
        find.byKey(const ValueKey('cooking-ingredient-carrot')),
        140,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('۱۰۰ گرم'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('cooking-ingredient-chicken')),
        findsNothing,
      );
      await t.tap(find.byKey(const ValueKey('cooking-next')));
      await t.pumpAndSettle();
      expect(find.text('مرحلهٔ ۲ از ۳'), findsOneWidget);
      await t.scrollUntilVisible(
        find.byKey(const ValueKey('cooking-ingredient-chicken')),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('۱۵۰ گرم'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('cooking-next')));
      await t.pumpAndSettle();
      await t.scrollUntilVisible(
        find.textContaining('مواد این مرحله جداگانه مشخص نشده'),
        140,
        scrollable: find.byType(Scrollable).first,
      );
      expect(
        find.textContaining('مواد این مرحله جداگانه مشخص نشده'),
        findsOneWidget,
      );
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      await t.pumpWidget(
        cookingHost(CookingPage(meal: cookingMeal.copyWith(instructions: ''))),
      );
      await t.pumpAndSettle();
      expect(
        find.text('دستور تهیهٔ این غذا هنوز درج نشده است.'),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('cooking-add-timer')), findsNothing);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'timer validates, survives steps, pauses, and catches up after backgrounding',
    (t) async {
      var now = DateTime(2026, 11, 16, 12);
      await t.pumpWidget(
        cookingHost(CookingPage(meal: cookingMeal, clock: () => now)),
      );
      await t.pumpAndSettle();
      await tapCooking(t, find.byKey(const ValueKey('cooking-add-timer')));
      final minutes = find.byKey(const ValueKey('cooking-timer-minutes'));
      await t.enterText(minutes, '۰');
      await t.tap(find.text('شروع تایمر'));
      await t.pumpAndSettle();
      expect(find.textContaining('زمانی بین ۱ تا ۱۸۰'), findsOneWidget);
      await t.enterText(minutes, '١');
      await t.tap(find.text('شروع تایمر'));
      await t.pumpAndSettle();
      now = now.add(const Duration(seconds: 10));
      await t.pump(const Duration(seconds: 1));
      expect(find.text('۰۰:۵۰'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('cooking-next')));
      await t.pumpAndSettle();
      await t.scrollUntilVisible(
        find.text('تایمر مرحلهٔ ۱'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('تایمر مرحلهٔ ۱'), findsOneWidget);
      await tapCooking(t, find.byKey(const ValueKey('cooking-pause')));
      now = now.add(const Duration(minutes: 2));
      await t.pump(const Duration(seconds: 2));
      expect(find.text('۰۰:۵۰'), findsOneWidget);
      await tapCooking(t, find.text('ادامهٔ تایمر'));
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      now = now.add(const Duration(minutes: 1));
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pumpAndSettle();
      expect(find.text('زمان تمام شد'), findsOneWidget);
      expect(
        find.textContaining('پایان تایمر به معنی آماده‌بودن غذا نیست'),
        findsOneWidget,
      );
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets('exit protects the active timer and never logs a meal', (
    t,
  ) async {
    await t.pumpWidget(
      cookingHost(
        Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              child: const Text('باز کردن دستور'),
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => const CookingPage(meal: cookingMeal),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tapCooking(t, find.text('باز کردن دستور'));
    await tapCooking(t, find.byKey(const ValueKey('cooking-add-timer')));
    await t.tap(find.text('شروع تایمر'));
    await t.pumpAndSettle();
    await t.tap(find.byTooltip('خروج از حالت آشپزی'));
    await t.pumpAndSettle();
    expect(find.text('از حالت آشپزی خارج می‌شوی؟'), findsOneWidget);
    await tapCooking(t, find.text('ادامهٔ آشپزی'));
    expect(find.byType(CookingPage), findsOneWidget);
    await t.tap(find.byTooltip('خروج از حالت آشپزی'));
    await t.pumpAndSettle();
    await tapCooking(t, find.text('خروج و توقف تایمر'));
    expect(find.byType(CookingPage), findsNothing);
    expect(find.text('باز کردن دستور'), findsOneWidget);
    await t.pumpWidget(const SizedBox());
  });
}
