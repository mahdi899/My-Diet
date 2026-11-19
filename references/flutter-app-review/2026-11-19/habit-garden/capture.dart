// From app: flutter test --no-pub ../references/flutter-app-review/2026-11-19/habit-garden/capture.dart
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/habit_garden.dart';
import 'package:sabzine_flutter/features/home/water_log.dart';

import '../../../../app/test/daily_check_in_test.dart'
    show MemoryWaterPreferences;

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
  });

  testWidgets('capture the simplified empty garden card', (t) async {
    t.view.physicalSize = const Size(780, 1500);
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final store = DemoStore(clock: () => DateTime(2026, 11, 19, 12))
      ..loginDemoUser();
    store.approveActiveUserRequest();
    addTearDown(store.dispose);
    final log = WaterLog(preferences: MemoryWaterPreferences());
    await log.write(DateTime(2026, 11, 18), 1);
    const capture = ValueKey('garden-capture');
    await t.pumpWidget(
      DemoScope(
        store: store,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: appTheme(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(disableAnimations: true),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: child!,
            ),
          ),
          home: Scaffold(
            backgroundColor: Colors.white,
            body: SingleChildScrollView(
              child: RepaintBoundary(
                key: capture,
                child: ColoredBox(
                  color: Colors.white,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: HabitGarden(log: log),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.byKey(const ValueKey('habit-day-2026-11-17')));
    await t.pumpAndSettle();
    final context = t.element(find.byType(HabitGarden));
    await t.runAsync(() async {
      for (final widget in t.widgetList<Image>(find.byType(Image))) {
        await precacheImage(widget.image, context);
      }
    });
    await t.pumpAndSettle();
    expect(find.text('ثبتی برای این روز نداری'), findsOneWidget);
    expect(t.takeException(), isNull);
    await t.runAsync(() async {
      final boundary = t.renderObject<RenderRepaintBoundary>(find.byKey(capture));
      final picture = await boundary.toImage(pixelRatio: 2);
      final bytes = await picture.toByteData(format: ui.ImageByteFormat.png);
      await File(
        '../references/flutter-app-review/2026-11-19/habit-garden/empty-day.png',
      ).writeAsBytes(bytes!.buffer.asUint8List());
      picture.dispose();
    });
    await t.pumpWidget(const SizedBox());
  });
}
