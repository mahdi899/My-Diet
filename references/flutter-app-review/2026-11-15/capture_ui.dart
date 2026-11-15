// Visual review harness only. All data is local DemoStore fixture data.
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
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await (FontLoader('MaterialIcons')
          ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf')))
        .load();
    await FoodPhotoResolver.load();
  });

  testWidgets('capture current customer screens for review', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    Future<void> settle() async {
      await tester.pump();
      for (var i = 0; i < 12; i++) {
        await tester.pump(const Duration(milliseconds: 200));
      }
      await tester.runAsync(() async {
        await Future<void>.delayed(const Duration(milliseconds: 200));
      });
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pump();
    }

    Future<void> shot(String name) async {
      await settle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('captures/$name.png'),
      );
    }

    final store = DemoStore(clock: () => DateTime(2026, 11, 9, 9, 30))
      ..loginDemoUser();
    store.approveActiveUserRequest();
    await tester.pumpWidget(SabzineApp(store: store, splashDuration: Duration.zero));
    await tester.runAsync(() async {
      final context = tester.element(find.byType(Scaffold).first);
      for (final meal in store.mealsOn(store.today)) {
        final photo = FoodPhotoResolver.instance!.resolve(
          title: meal.title,
          mealType: meal.name,
          ingredients: [for (final ingredient in meal.ingredients) ingredient.name],
        );
        await precacheImage(AssetImage(photo.path), context);
        await precacheImage(AssetImage(photo.thumb), context);
      }
    });
    await shot('01-home-fixture');
    await tester.tap(find.byKey(const ValueKey('tab-plan')));
    await shot('02-plan-fixture');
    await tester.tap(find.byKey(const ValueKey('tab-coach')));
    await shot('03-coach-fixture');
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
    store.dispose();

    final waiting = DemoStore(clock: () => DateTime(2026, 11, 9, 9, 30))
      ..loginDemoUser();
    await tester.pumpWidget(SabzineApp(store: waiting, splashDuration: Duration.zero));
    await settle();
    await tester.tap(find.byKey(const ValueKey('tab-plan')));
    await shot('04-waiting-fixture');
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
    waiting.dispose();

    final anonymous = DemoStore();
    await tester.pumpWidget(SabzineApp(store: anonymous, splashDuration: Duration.zero));
    await shot('05-first-login');
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
    anonymous.dispose();
    expect(tester.takeException(), isNull);
  });
}
