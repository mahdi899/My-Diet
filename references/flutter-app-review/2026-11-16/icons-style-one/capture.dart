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
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/core/icons/diet_icon.dart';

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
  testWidgets('capture approved vector icons in the actual app', (t) async {
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
        final file = File(
          '../references/flutter-app-review/2026-11-16/icons-style-one/implemented/$name.png',
        );
        await file.parent.create(recursive: true);
        await file.writeAsBytes(data!.buffer.asUint8List());
        picture.dispose();
      });
    }

    await mount(const PanelShell(role: AppRole.user));
    await shot('home');
    await t.drag(find.byType(ListView).first, const Offset(0, -510));
    await t.pumpAndSettle();
    await shot('daily-summary');
    t.view.physicalSize = const Size(640, 1440);
    await mount(const PanelShell(role: AppRole.user), scale: 1.5);
    await shot('home-large-text');
    t.view.physicalSize = const Size(780, 1688);
    await mount(const PanelShell(role: AppRole.user));
    await t.tap(find.byKey(const ValueKey('tab-plan')));
    await t.pumpAndSettle();
    await shot('plan');
    await t.tap(find.byKey(const ValueKey('tab-coach')));
    await t.pumpAndSettle();
    await shot('coach');
    await mount(
      Scaffold(
        appBar: AppBar(title: const Text('آیکن‌های اختصاصی رژیم من')),
        body: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              for (final row in [
                [DietIconKind.home, DietIconKind.coach, DietIconKind.plan],
                [DietIconKind.water, DietIconKind.meal, DietIconKind.progress],
              ]) ...[
                Row(
                  children: [
                    for (final kind in row)
                      Expanded(
                        child: Column(
                          children: [
                            DietIcon(kind, size: 72, selected: true),
                            const SizedBox(height: 16),
                            Text(
                              switch (kind) {
                                DietIconKind.home => 'خانه',
                                DietIconKind.coach => 'مربی',
                                DietIconKind.plan => 'برنامه',
                                DietIconKind.water => 'آب',
                                DietIconKind.meal => 'غذا',
                                DietIconKind.progress => 'پیشرفت',
                              },
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 40),
              ],
              const Divider(),
              const SizedBox(height: 24),
              const Text('اندازهٔ واقعی داخل اپ'),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  for (final kind in DietIconKind.values)
                    DietIcon(kind, size: 26),
                ],
              ),
              const SizedBox(height: 36),
              const Text('حالت انتخاب‌شده و عادی'),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  for (final kind in [DietIconKind.home, DietIconKind.plan])
                    Row(
                      children: [
                        DietIcon(kind, size: 32, selected: true),
                        const SizedBox(width: 16),
                        DietIcon(kind, size: 32, color: AppColors.muted),
                      ],
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    await shot('icon-family');
    await t.pumpWidget(const SizedBox());
  });
}
