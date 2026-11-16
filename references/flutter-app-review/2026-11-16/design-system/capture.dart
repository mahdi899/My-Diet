// Reproducible screenshots of real application widgets with demo data.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/home_tab.dart';
import 'package:sabzine_flutter/features/home/weight_sheet.dart';
import 'package:sabzine_flutter/features/plan/meal_detail_page.dart';

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
  testWidgets('capture actual home, meal details and weight form', (t) async {
    t.view.physicalSize = const Size(780, 1688);
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final date = DateTime(2026, 11, 9, 12, 30);
    final store = DemoStore(clock: () => date)..loginDemoUser();
    store.approveActiveUserRequest();
    addTearDown(store.dispose);
    const key = ValueKey('capture-design-system');
    Future<void> mount(Widget page, {double scale = 1}) async {
      await t.pumpWidget(const SizedBox());
      await t.pumpWidget(
        RepaintBoundary(
          key: key,
          child: DemoScope(
            store: store,
            child: MaterialApp(
              debugShowCheckedModeBanner: false,
              theme: appTheme(),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(context).copyWith(
                  disableAnimations: true,
                  textScaler: TextScaler.linear(scale),
                ),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: child!,
                ),
              ),
              home: page,
            ),
          ),
        ),
      );
      await t.pumpAndSettle();
    }

    Future<void> shot(String name) async {
      for (var pass = 0; pass < 3; pass++) {
        final widgets = t.widgetList<Image>(find.byType(Image)).toList();
        final context = t.element(find.byType(MaterialApp));
        await t.runAsync(() async {
          for (final w in widgets) {
            await precacheImage(w.image, context);
          }
        });
        await t.pumpAndSettle();
      }
      expect(t.takeException(), isNull);
      await t.runAsync(() async {
        final boundary = t.renderObject<RenderRepaintBoundary>(find.byKey(key));
        final picture = await boundary.toImage(pixelRatio: 2);
        final data = await picture.toByteData(format: ui.ImageByteFormat.png);
        const phase = String.fromEnvironment(
          'CAPTURE_PHASE',
          defaultValue: 'after',
        );
        final file = File(
          '../references/flutter-app-review/2026-11-16/design-system/$phase/$name.png',
        );
        await file.parent.create(recursive: true);
        await file.writeAsBytes(data!.buffer.asUint8List());
        picture.dispose();
      });
    }

    await mount(const Scaffold(body: SafeArea(child: HomeTab())));
    await shot('home');
    await t.drag(find.byType(ListView).first, const Offset(0, -510));
    await t.pumpAndSettle();
    await shot('daily-summary');
    await mount(MealDetailPage(date: date, index: 1));
    await shot('meal');
    await t.drag(find.byType(CustomScrollView), const Offset(0, -280));
    await t.pumpAndSettle();
    await shot('portions');
    final weightPage = Scaffold(
      appBar: AppBar(title: const Text('ثبت‌های من')),
      body: Builder(
        builder: (context) => Center(
          child: FilledButton(
            onPressed: () => showWeightSheet(context),
            child: const Text('ثبت وزن امروز'),
          ),
        ),
      ),
    );
    await mount(weightPage);
    await t.tap(find.text('ثبت وزن امروز'));
    await t.pumpAndSettle();
    await shot('weight');
    t.view.physicalSize = const Size(640, 1440);
    await mount(MealDetailPage(date: date, index: 1), scale: 1.5);
    await t.drag(find.byType(CustomScrollView), const Offset(0, -300));
    await t.pumpAndSettle();
    await shot('meal-large-text');
    await t.pumpWidget(const SizedBox());
  });
}
