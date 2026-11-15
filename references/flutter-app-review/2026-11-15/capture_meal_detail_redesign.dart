// Actual Flutter widgets rendered with the project's explicit local meal fixtures.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/data/demo_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
    await FoodPhotoResolver.load();
  });
  testWidgets('capture meal portions, recipe and approved alternatives', (
    t,
  ) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final store = DemoStore(clock: () => DateTime(2026, 11, 9, 12, 30))
      ..loginDemoUser();
    store.approveActiveUserRequest();
    await t.pumpWidget(SabzineApp(store: store, splashDuration: Duration.zero));
    await t.runAsync(() async {
      final context = t.element(find.byType(Scaffold).first);
      final resolver = FoodPhotoResolver.instance!;
      for (final meal in store.mealsOn(store.today)) {
        final entry = resolver.resolve(
          title: meal.title,
          mealType: meal.name,
          ingredients: [for (final item in meal.ingredients) item.name],
        );
        await precacheImage(
          ResizeImage(AssetImage(entry.path), width: 390),
          context,
        );
        for (final item in meal.ingredients) {
          final cooked = ['پلو', 'پخته', 'سالاد'].any(item.name.contains);
          final photo = (cooked ? resolver.bestMatch(title: item.name) : null) ??
              resolver.bestMatch(title: item.name, mealType: 'ingredient');
          if (photo != null) {
            await precacheImage(
              ResizeImage(AssetImage(photo.thumb), width: 64),
              context,
            );
          }
        }
      }
    });
    await t.tap(find.byKey(const ValueKey('home-meal-details')));
    await t.pumpAndSettle();
    expect(t.takeException(), isNull);
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('meal-detail-redesign/implemented-portions.png'),
    );
    await t.tap(find.byKey(const ValueKey('meal-tab-recipe')));
    await t.pumpAndSettle();
    expect(t.takeException(), isNull);
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('meal-detail-redesign/implemented-recipe.png'),
    );
    await t.tap(find.byKey(const ValueKey('meal-alternatives')));
    await t.pumpAndSettle();
    expect(t.takeException(), isNull);
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('meal-detail-redesign/implemented-alternatives.png'),
    );
    await t.pumpWidget(const SizedBox());
    await t.pump();
    store.dispose();
  });
}
