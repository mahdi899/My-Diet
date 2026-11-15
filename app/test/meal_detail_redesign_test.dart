import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/day.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/plan/consume_sheet.dart';
import 'package:sabzine_flutter/features/plan/meal_detail_page.dart';
import 'package:sabzine_flutter/features/plan/meal_substitution_sheet.dart';

final day = DateTime(2026, 11, 9, 12, 30);

DemoStore ready() {
  final store = DemoStore(clock: () => day)..loginDemoUser();
  store.approveActiveUserRequest();
  return store;
}

Widget host(DemoStore store, {DateTime? date, double scale = 1}) => DemoScope(
  store: store,
  child: MaterialApp(
    theme: appTheme(),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(disableAnimations: true, textScaler: TextScaler.linear(scale)),
      child: Directionality(textDirection: TextDirection.rtl, child: child!),
    ),
    home: MealDetailPage(date: date ?? day, index: 1),
  ),
);

Future<void> tapVisible(WidgetTester t, Finder finder) async {
  await t.ensureVisible(finder);
  await t.pumpAndSettle();
  await t.tap(finder);
  await t.pumpAndSettle();
}

void main() {
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await FoodPhotoResolver.load();
  });
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets(
    'recipe switch preserves portions; recording requires confirmation',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final store = ready();
      await t.pumpWidget(host(store));
      await t.pumpAndSettle();
      expect(find.text('سهم تو در این وعده'), findsOneWidget);
      expect(find.text('ماهی پخته'), findsOneWidget);
      await tapVisible(t, find.byKey(const ValueKey('meal-tab-recipe')));
      expect(find.text('ماهی پخته'), findsNothing);
      expect(
        find.textContaining('سالاد تازه را کنار آن سرو کن'),
        findsOneWidget,
      );
      await tapVisible(t, find.byKey(const ValueKey('meal-tab-portions')));
      expect(find.text('ماهی پخته'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('meal-record')));
      await t.pumpAndSettle();
      expect(find.byType(ConsumeSheet), findsOneWidget);
      expect(store.mealRecordOn(day, 1), isNull);
      Navigator.pop(t.element(find.byType(ConsumeSheet)));
      await t.pumpAndSettle();
      expect(store.mealRecordOn(day, 1), isNull);
      await t.tap(find.byKey(const ValueKey('meal-record')));
      await t.pumpAndSettle();
      await t.tap(find.text('انجام شد'));
      await t.pumpAndSettle();
      expect(store.mealRecordOn(day, 1), isNotNull);
      expect(find.text('ثبت شد'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'replacement requires a reason and explicit confirmation for recorded food',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final store = ready();
      await store.setMealEaten(day, 1, true);
      final consumed = store.consumedCalories(day);
      final replacement = store.alternativesOn(day, 1).first;
      await t.pumpWidget(host(store));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('meal-alternatives')));
      await t.pumpAndSettle();
      await tapVisible(t, find.text(replacement.meal.title));
      await tapVisible(t, find.text('تأیید جایگزینی'));
      expect(find.text('دلیل را انتخاب کن'), findsOneWidget);
      expect(store.selectedOptionOn(day, 1), 'original');
      await tapVisible(
        t,
        find.widgetWithText(ChoiceChip, store.substitutionReasons.values.first),
      );
      await tapVisible(t, find.text('تأیید جایگزینی'));
      expect(find.text('قبلاً ثبت شده'), findsOneWidget);
      await t.tap(find.text('انصراف'));
      await t.pumpAndSettle();
      expect(store.selectedOptionOn(day, 1), 'original');
      await tapVisible(t, find.text('تأیید جایگزینی'));
      await t.tap(find.text('عوض کن'));
      await t.pumpAndSettle();
      expect(store.selectedOptionOn(day, 1), replacement.id);
      expect(find.byType(MealSubstitutionSheet), findsNothing);
      expect(find.text(replacement.meal.title), findsWidgets);
      expect(store.mealEaten(day, 1), isTrue);
      expect(store.consumedCalories(day), consumed);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'missing structured ingredients retain stated amount; missing recipe stays empty',
    (t) async {
      final store = ready();
      final index = weekDayIndex(day) - 1;
      final meals = store.userRequest.publishedOtherDays[index].toList();
      meals[1] = meals[1].copyWith(
        ingredients: [],
        instructions: '',
        amount: 'سهم درج‌شدهٔ متخصص: ۱ بشقاب',
      );
      store.userRequest.publishedOtherDays[index] = meals;
      await t.pumpWidget(host(store));
      await t.pumpAndSettle();
      expect(find.text('سهم درج‌شدهٔ متخصص: ۱ بشقاب'), findsOneWidget);
      await tapVisible(t, find.byKey(const ValueKey('meal-tab-recipe')));
      expect(
        find.text('دستور تهیهٔ این غذا هنوز درج نشده است.'),
        findsOneWidget,
      );
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'narrow large text, keyboard and past-day alternatives remain usable',
    (t) async {
      t.view.physicalSize = const Size(320, 740);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final store = ready();
      await t.pumpWidget(host(store, scale: 1.5));
      await t.pumpAndSettle();
      expect(t.takeException(), isNull);
      final record = find.byKey(const ValueKey('meal-record'));
      final before = t.getRect(record);
      await t.drag(
        find.byKey(const ValueKey('meal-detail-scroll')),
        const Offset(0, -500),
      );
      await t.pumpAndSettle();
      expect(t.getRect(record), before);
      await t.tap(find.byKey(const ValueKey('meal-alternatives')));
      await t.pumpAndSettle();
      await tapVisible(
        t,
        find.text(store.alternativesOn(day, 1).first.meal.title),
      );
      await tapVisible(t, find.byType(TextField));
      t.view.viewInsets = const FakeViewPadding(bottom: 260);
      await t.pumpAndSettle();
      await t.enterText(find.byType(TextField), 'توضیح آزمایشی');
      await t.ensureVisible(find.text('تأیید جایگزینی'));
      await t.pumpAndSettle();
      expect(t.takeException(), isNull);
      t.view.resetViewInsets();
      await t.pumpWidget(const SizedBox());
      await t.pumpWidget(
        host(store, date: day.subtract(const Duration(days: 1)), scale: 1.5),
      );
      await t.pumpAndSettle();
      final button = t.widget<FilledButton>(
        find.byKey(const ValueKey('meal-record')),
      );
      expect(button.onPressed, isNull);
      await t.tap(find.byKey(const ValueKey('meal-alternatives')));
      await t.pumpAndSettle();
      await t.ensureVisible(find.text('روز گذشته عوض نمی‌شود'));
      await t.pumpAndSettle();
      expect(find.text('تأیید جایگزینی'), findsNothing);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
}
