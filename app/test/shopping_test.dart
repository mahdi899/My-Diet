import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/day.dart';
import 'package:sabzine_flutter/data/share_text_native.dart';
import 'package:sabzine_flutter/screens/shopping.dart';
import 'nutrition_test.dart' show LogMemory;

void main() {
  final date = DateTime(2026, 11, 1, 12);
  DemoStore ready([LogMemory? storage]) {
    final s = DemoStore(nutritionStorage: storage, clock: () => date)
      ..loginDemoUser();
    s.approveActiveUserRequest();
    addTearDown(s.dispose);
    return s;
  }

  void fixture(DemoStore s) {
    final meals = s.userRequest.publishedOtherDays[0].toList(),
        original = meals.first;
    meals[0] = original.copyWith(
      ingredients: const [
        MealIngredient(
          'test-rice',
          'برنج نمونه',
          100,
          'گرم',
          basis: 'پخته',
          category: 'نان و غلات',
        ),
      ],
      alternatives: [
        MealAlternative(
          id: 'ai',
          source: AlternativeSource.ai,
          approved: true,
          reviewedBy: 'demo',
          reviewedAt: date,
          meal: original.copyWith(
            ingredients: const [
              MealIngredient(
                'test-rice',
                'برنج نمونه',
                200,
                'گرم',
                basis: 'پخته',
                category: 'نان و غلات',
              ),
              MealIngredient(
                'test-bean',
                'لوبیای نمونه',
                1,
                'پیمانه',
                category: 'حبوبات',
              ),
            ],
          ),
        ),
      ],
    );
    s.userRequest.publishedOtherDays[0] = meals;
  }

  test(
    'Only compatible units and preparation bases combine; missing values remain flagged',
    () {
      const meal = Meal(
        name: 'ناهار',
        title: 'نمونه',
        time: '۱۳',
        amount: 'سهم نمونه',
        details: '',
        ingredients: [
          MealIngredient('rice', 'برنج', 100, 'گرم', basis: 'پخته'),
          MealIngredient('rice', 'برنج', 50, 'گرم', basis: 'پخته'),
          MealIngredient('rice', 'برنج', 1, 'پیمانه', basis: 'پخته'),
          MealIngredient('rice', 'برنج', 30, 'گرم', basis: 'خام'),
          MealIngredient('unknown', 'ماده ناقص', null, 'گرم'),
          MealIngredient('bad', 'نامعتبر', double.infinity, 'گرم'),
        ],
      );
      final data = aggregateShoppingIngredients([meal]);
      expect(data.rows.length, 3);
      expect(data.missing.length, 2);
      expect(
        data.rows
            .where(
              (r) => r.ingredient.unit == 'گرم' && r.ingredient.basis == 'پخته',
            )
            .single
            .quantity,
        150,
      );
      expect(shoppingQuantity(100), '100');
      expect(shoppingQuantity(.5), '0.5');
    },
  );
  test(
    'Marks survive substitution/revert and restart, increased amounts need review, new versions isolate marks',
    () async {
      final log = LogMemory(), s = ready(log);
      fixture(s);
      var row = s.shoppingIngredients().firstWhere(
        (r) => r.ingredient.id == 'test-rice',
      );
      await s.setShoppingMark(row, 'purchased');
      await s.substituteMeal(date, 0, 'ai', 'dislike');
      row = s.shoppingIngredients().firstWhere(
        (r) => r.ingredient.id == 'test-rice',
      );
      expect(row.quantity, 200);
      expect(s.shoppingMark(row)!.quantity, 100);
      expect(
        s.shoppingChanges.any(
          (c) =>
              c['name'] == 'برنج نمونه' &&
              c['previous'] == 100 &&
              c['next'] == 200,
        ),
        true,
      );
      final restored = ready(log);
      fixture(restored);
      await restored.restoreNutritionLog();
      expect(restored.shoppingMark(row)!.quantity, 100);
      expect(restored.shoppingChanges, isNotEmpty);
      await s.substituteMeal(date, 0, 'original', 'time');
      row = s.shoppingIngredients().firstWhere(
        (r) => r.ingredient.id == 'test-rice',
      );
      expect(s.shoppingMark(row)!.quantity, row.quantity);
      expect(s.shoppingChanges, isEmpty);
      s.approveActiveUserRequest();
      expect(s.shoppingMark(s.shoppingIngredients().first), isNull);
    },
  );
  test(
    'Selected days deduplicate; marks cover only bought quantity; failure preserves old state',
    () async {
      final log = LogMemory(), s = ready(log);
      final one = s.shoppingList(dates: [date, date]);
      expect(
        one.rows.map((r) => r.quantity).toList(),
        s.shoppingList(dates: [date]).rows.map((r) => r.quantity).toList(),
      );
      final row = one.rows.first;
      await s.setShoppingMark(row, 'have');
      expect(s.shoppingMark(row)!.status, 'have');
      log.fail = true;
      await expectLater(s.setShoppingMark(row, 'purchased'), throwsStateError);
      expect(s.shoppingMark(row)!.status, 'have');
      expect(s.savingShopping, false);
      log.fail = false;
      await s.setShoppingMark(row, null);
      expect(s.shoppingMark(row), isNull);
      expect(
        s.shoppingList(dates: [date.add(const Duration(days: 7))]).rows,
        isEmpty,
      );
    },
  );
  test(
    'Share text includes quantities, selected dates, status and missing data without invented values',
    () async {
      final s = ready();
      final meals = s.userRequest.publishedOtherDays[0].toList();
      meals[0] = meals[0].copyWith(
        ingredients: const [
          MealIngredient('missing', 'ماده نامشخص', null, 'گرم'),
        ],
      );
      s.userRequest.publishedOtherDays[0] = meals;
      final row = s.shoppingList(dates: [date]).rows.first;
      await s.setShoppingMark(row, 'have');
      final text = shoppingListText(s, [date]);
      expect(text, contains(persianDate(date)));
      expect(text, contains('موجود دارم'));
      expect(text, contains('ماده نامشخص'));
      expect(text, contains('کامل نیست'));
      expect(text, isNot(contains('null')));
    },
  );
  testWidgets(
    'Shopping entry, day filters, checkmark, copy and mobile screenshot work',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      await (FontLoader(
        'Vazirmatn',
      )..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))).load();
      await (FontLoader(
        'MaterialIcons',
      )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
      final s = ready();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      await t.tap(find.text('برنامه'));
      await t.pumpAndSettle();
      await t.tap(find.byTooltip('لیست خرید هفته'));
      await t.pumpAndSettle();
      expect(find.byType(ShoppingScreen), findsOneWidget);
      for (var i = 0; i < 7; i++) {
        if (i != 1) {
          await t.tap(find.byKey(ValueKey('shopping-day-$i')));
          await t.pumpAndSettle();
        }
      }
      final check = find.byType(Checkbox).first;
      await t.ensureVisible(check);
      await t.pumpAndSettle();
      await t.tap(check);
      await t.pumpAndSettle();
      expect(t.widget<Checkbox>(check).value, true);
      expect(t.takeException(), isNull);
      await t.drag(find.byType(SingleChildScrollView), const Offset(0, 1500));
      await t.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('../../references/screenshots/phase4/shopping-demo.png'),
      );
      String? copied;
      t.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            copied = (call.arguments as Map)['text'] as String;
          }
          return null;
        },
      );
      addTearDown(
        () => t.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      await t.ensureVisible(find.text('کپی لیست'));
      await t.pumpAndSettle();
      await t.tap(find.text('کپی لیست'));
      await t.pumpAndSettle();
      expect(copied, contains('لیست خرید رژیم من'));
      expect(t.takeException(), isNull);
    },
  );
  testWidgets('Native sharing requests the OS chooser with exact text', (
    t,
  ) async {
    const channel = MethodChannel('ir.sabzine/share');
    String? sent;
    t.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
      call,
    ) async {
      expect(call.method, 'text');
      sent = (call.arguments as Map)['text'] as String;
      return true;
    });
    addTearDown(
      () => t.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      ),
    );
    expect(await shareShoppingText('لیست نمونه'), true);
    expect(sent, 'لیست نمونه');
  });
}
