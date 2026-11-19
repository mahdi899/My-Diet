import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';
import 'package:sabzine_flutter/features/coach/presentation/cards/coach_cards.dart';
import 'package:sabzine_flutter/features/coach/presentation/cards/coach_food_card.dart';

CoachMessage foodSuggestion({bool nutrition = true, String? title}) =>
    CoachMessage(
      id: 'suggested-dinner',
      role: 'assistant',
      type: 'meal_card',
      createdAt: DateTime(2026, 11, 19, 12, 30),
      fallbackText: 'عدسی',
      payload: {
        'title': title ?? 'عدسی با نان سبوس‌دار',
        'meal_type_fa': 'شام',
        'photo_title': 'عدسی',
        'calories': 420,
        'preparation_minutes': 20,
        if (nutrition) ...{'protein_g': 23, 'carbs_g': 61, 'fat_g': 10},
        'items': [
          {'name': 'عدسی', 'quantity': 250, 'unit': 'g', 'calories': 420},
        ],
      },
    );

Widget foodHost(Widget child, {double scale = 1}) => MaterialApp(
  theme: appTheme(),
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
    child: Directionality(textDirection: TextDirection.rtl, child: child!),
  ),
  home: Scaffold(
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: child,
    ),
  ),
);

void main() {
  setUpAll(() async {
    await FoodPhotoResolver.load();
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
  });

  testWidgets(
    'the complete suggestion and both actions fit without an inner scroll',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      var reviews = 0, swaps = 0;
      await t.pumpWidget(
        foodHost(
          MealCardView(
            message: foodSuggestion(),
            onReview: () => reviews++,
            onSwap: () => swaps++,
          ),
        ),
      );
      await t.pumpAndSettle();
      final card = find.byType(CoachFoodCard);
      expect(t.getSize(card).height, lessThan(300));
      expect(
        find.descendant(of: card, matching: find.byType(Scrollable)),
        findsNothing,
      );
      expect(find.byType(ExpansionTile), findsNothing);
      expect(find.text('پروتئین ۲۳ گرم', findRichText: true), findsOneWidget);
      expect(
        find.text('کربوهیدرات ۶۱ گرم', findRichText: true),
        findsOneWidget,
      );
      final first = find.text('بررسی و ثبت');
      final second = find.text('پیشنهاد دیگر');
      expect(t.getCenter(first).dy, closeTo(t.getCenter(second).dy, 1));
      await t.tap(first);
      await t.tap(second);
      expect(reviews, 1);
      expect(swaps, 1);
      expect(t.takeException(), isNull);
    },
  );

  testWidgets(
    'large text wraps the full title without adding a nested scroll',
    (t) async {
      t.view.physicalSize = const Size(320, 740);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      const title = 'عدسی با نان سبوس‌دار و سبزیجات تازه برای شام';
      await t.pumpWidget(
        foodHost(
          MealCardView(
            message: foodSuggestion(title: title),
            onReview: () {},
            onSwap: () {},
          ),
          scale: 1.5,
        ),
      );
      await t.pumpAndSettle();
      expect(find.text(title), findsOneWidget);
      expect(t.widget<Text>(find.text(title)).maxLines, isNull);
      expect(
        find.descendant(
          of: find.byType(CoachFoodCard),
          matching: find.byType(Scrollable),
        ),
        findsNothing,
      );
      await t.ensureVisible(find.text('پیشنهاد دیگر'));
      await t.pumpAndSettle();
      expect(t.takeException(), isNull);
    },
  );

  testWidgets(
    'unknown nutrition is omitted instead of displaying zero amounts',
    (t) async {
      await t.pumpWidget(
        foodHost(
          MealCardView(
            message: foodSuggestion(nutrition: false),
            onReview: () {},
            onSwap: () {},
          ),
        ),
      );
      await t.pumpAndSettle();
      expect(find.textContaining('گرم', findRichText: true), findsNothing);
      expect(find.text('۴۲۰ کالری'), findsOneWidget);
      expect(t.takeException(), isNull);
    },
  );
}
