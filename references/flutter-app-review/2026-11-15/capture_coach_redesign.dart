// Renders the approved design implemented in the real Flutter app, with local fixtures.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/core/photos/food_photo_resolver.dart';
import 'package:sabzine_flutter/data/demo_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await (FontLoader('Vazirmatn')..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'))).load();
    await (FontLoader('MaterialIcons')..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
    await FoodPhotoResolver.load();
  });
  testWidgets('capture approved coach layout and expanded daily summary', (tester) async {
    tester.view.physicalSize = const Size(390,844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final store = DemoStore(clock: () => DateTime(2026,11,9,12,30))..loginDemoUser();
    store.approveActiveUserRequest();
    await tester.pumpWidget(SabzineApp(store: store,splashDuration: Duration.zero));
    await tester.runAsync(() async {
      final context = tester.element(find.byType(Scaffold).first);
      for (final meal in store.mealsOn(store.today)) {
        final entry = FoodPhotoResolver.instance!.resolve(title: meal.title, mealType: meal.name,
          ingredients: [for (final item in meal.ingredients) item.name]);
        await precacheImage(ResizeImage(AssetImage(entry.path),width:390),context);
      }
    });
    await tester.tap(find.byKey(const ValueKey('tab-coach')));
    await tester.pumpAndSettle();
    await tester.runAsync(() async { await Future<void>.delayed(const Duration(milliseconds:200)); });
    await tester.pumpAndSettle();
    expect(tester.takeException(),isNull);
    await expectLater(find.byType(MaterialApp),matchesGoldenFile('coach-redesign/implemented.png'));
    await tester.tap(find.byKey(const ValueKey('coach-summary-toggle')));
    await tester.pumpAndSettle();
    expect(tester.takeException(),isNull);
    await expectLater(find.byType(MaterialApp),matchesGoldenFile('coach-redesign/expanded.png'));
    await tester.pumpWidget(const SizedBox());
    await tester.pump(); store.dispose();
  });
}
