// Renders the real Flutter character and records one finite reaction per mood.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_companion.dart';

Widget gallery() => MaterialApp(
  debugShowCheckedModeBanner: false,
  theme: appTheme(),
  home: Directionality(
    textDirection: TextDirection.rtl,
    child: Scaffold(
      body: RepaintBoundary(
        key: const ValueKey('companion-gallery'),
        child: ColoredBox(
          color: AppColors.bg,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'جوانه',
                  style: TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.bold,
                    color: AppColors.emeraldDark,
                  ),
                ),
                const Text(
                  'همراه کوچک تو در مسیر رژیم من',
                  style: TextStyle(fontSize: 14, color: AppColors.inkSoft),
                ),
                const SizedBox(height: 20),
                Expanded(
                  child: GridView.count(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: .99,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      for (final mood in CompanionMood.values)
                        DecoratedBox(
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: AppColors.line),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              CoachCompanion(mood: mood, size: 108),
                              Text(
                                switch (mood) {
                                  CompanionMood.calm => 'همراهت هستم',
                                  CompanionMood.greeting => 'سلام!',
                                  CompanionMood.thinking => 'دارم فکر می‌کنم',
                                  CompanionMood.reply => 'جوابت آماده است',
                                  CompanionMood.support => 'کنارت می‌مانم',
                                  CompanionMood.celebrate => 'آفرین به پیگیریت',
                                },
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.emeraldDark,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const Text(
                  'واکنش‌های کوتاه؛ هماهنگ با اتفاق‌های واقعی گفتگو',
                  style: TextStyle(fontSize: 11, color: AppColors.inkSoft),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  ),
);

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

  testWidgets('capture six expressions and actual single-reaction frames', (
    t,
  ) async {
    t.view.physicalSize = const Size(390, 700);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    await t.pumpWidget(gallery());
    final output = Directory(
      'D:/ad/My-Diet/references/flutter-app-review/2026-11-15/coach-companion/frames',
    );
    await t.runAsync(() => output.create(recursive: true));
    for (var i = 0; i <= 24; i++) {
      if (i > 0) await t.pump(const Duration(milliseconds: 60));
      await t.runAsync(() async {
        final boundary = t.renderObject<RenderRepaintBoundary>(
          find.byKey(const ValueKey('companion-gallery')),
        );
        final picture = await boundary.toImage(pixelRatio: 1);
        final data = await picture.toByteData(format: ui.ImageByteFormat.png);
        await File('${output.path}/frame-${i.toString().padLeft(2, '0')}.png')
            .writeAsBytes(data!.buffer.asUint8List());
        picture.dispose();
      });
    }
    expect(t.takeException(), isNull);
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('coach-companion/expressions.png'),
    );
    await t.pumpWidget(const SizedBox());
  });

  testWidgets(
    'capture greeting and confirmed-water reaction inside the real coach',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final store = DemoStore(clock: () => DateTime(2026, 11, 9, 12, 30))
        ..loginDemoUser();
      store.approveActiveUserRequest();
      await t.pumpWidget(
        SabzineApp(store: store, splashDuration: Duration.zero),
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
      await t.tap(find.byKey(const ValueKey('tab-coach')));
      await t.pumpAndSettle();
      expect(t.takeException(), isNull);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('coach-companion/greeting.png'),
      );
      await t.tap(find.byKey(const ValueKey('coach-quick-water')));
      await t.pumpAndSettle();
      expect(t.takeException(), isNull);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('coach-companion/celebration.png'),
      );
      await t.pumpWidget(const SizedBox());
      await t.pump();
      store.dispose();
    },
  );
}
