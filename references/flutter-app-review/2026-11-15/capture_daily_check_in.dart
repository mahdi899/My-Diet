// Real app widgets with explicit persisted sample registrations, not a generated mockup.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/water_log.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
    await FoodPhotoResolver.load();
  });
  testWidgets(
    'capture daily progress, the rising water level, garden and Undo',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      var now = DateTime(2026, 11, 7, 12, 30);
      final store = DemoStore(clock: () => now)..loginDemoUser();
      store.approveActiveUserRequest();
      final water = WaterLog();
      await store.recordMeal(now, 0, 'according');
      await water.write(now, 4);
      now = DateTime(2026, 11, 9, 12, 30);
      await store.recordMeal(now, 0, 'according');
      await water.write(now, 2);
      await t.pumpWidget(
        RepaintBoundary(
          key: const ValueKey('daily-capture'),
          child: SabzineApp(store: store, splashDuration: Duration.zero),
        ),
      );
      await t.runAsync(() async {
        final context = t.element(find.byType(Scaffold).first);
        for (final meal in store.mealsOn(store.today)) {
          final photo = FoodPhotoResolver.instance!.resolve(
            title: meal.title,
            mealType: meal.name,
            ingredients: [for (final i in meal.ingredients) i.name],
          );
          await precacheImage(
            ResizeImage(AssetImage(photo.path), width: 390),
            context,
          );
        }
      });
      await t.pumpAndSettle();
      final summary = find.byKey(const ValueKey('home-today-summary'));
      await t.scrollUntilVisible(
        summary,
        220,
        scrollable: find.byType(Scrollable).first,
      );
      await Scrollable.ensureVisible(t.element(summary), alignment: .04);
      await t.pumpAndSettle();
      expect(t.takeException(), isNull);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('daily-check-in/meal-summary.png'),
      );
      final card = find.byKey(const ValueKey('daily-water-card'));
      await t.scrollUntilVisible(
        card,
        180,
        scrollable: find.byType(Scrollable).first,
      );
      await Scrollable.ensureVisible(t.element(card), alignment: .06);
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('water-add')));
      final output = Directory(
        'D:/ad/My-Diet/references/flutter-app-review/2026-11-15/daily-check-in/frames',
      );
      await t.runAsync(() => output.create(recursive: true));
      for (var i = 0; i < 16; i++) {
        await t.pump(const Duration(milliseconds: 50));
        await t.runAsync(() async {
          final boundary = t.renderObject<RenderRepaintBoundary>(
            find.byKey(const ValueKey('daily-capture')),
          );
          final picture = await boundary.toImage(pixelRatio: 1);
          final data = await picture.toByteData(format: ui.ImageByteFormat.png);
          await File('${output.path}/frame-${i.toString().padLeft(2, '0')}.png')
              .writeAsBytes(data!.buffer.asUint8List());
          picture.dispose();
        });
      }
      await t.pumpAndSettle();
      expect(t.takeException(), isNull);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('daily-check-in/water-and-garden.png'),
      );
      await t.tap(find.byKey(const ValueKey('water-undo')));
      await t.pumpAndSettle();
      expect(await water.read(now), 2);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('daily-check-in/water-undone.png'),
      );
      await t.tap(find.byKey(const ValueKey('habit-day-2026-11-08')));
      await t.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('daily-check-in/continue-after-gap.png'),
      );
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      await t.pump();
      store.dispose();
    },
  );
}
