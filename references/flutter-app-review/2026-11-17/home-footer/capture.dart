// From app: flutter test --no-pub ../references/flutter-app-review/2026-11-17/home-footer/capture.dart
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/home_tab.dart';

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
  });
  testWidgets(
    'capture actual home footer with one and multiple weight records',
    (tester) async {
      tester.view.physicalSize = const Size(780, 1688);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      var now = DateTime(2026, 11, 17, 20);
      final store = DemoStore(clock: () => now)..loginDemoUser();
      store.approveActiveUserRequest();
      store.applyOnboardingWeight(74);
      addTearDown(store.dispose);
      const boundaryKey = ValueKey('footer-capture');
      await tester.pumpWidget(
        RepaintBoundary(
          key: boundaryKey,
          child: DemoScope(
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
              home: const Scaffold(body: HomeTab()),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('home-open-coach')),
        400,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();

      Future<void> shot(String name) async {
        expect(tester.takeException(), isNull);
        await tester.runAsync(() async {
          final boundary = tester.renderObject<RenderRepaintBoundary>(
            find.byKey(boundaryKey),
          );
          final picture = await boundary.toImage(pixelRatio: 2);
          final bytes = await picture.toByteData(
            format: ui.ImageByteFormat.png,
          );
          await File(
            '../references/flutter-app-review/2026-11-17/home-footer/$name.png',
          ).writeAsBytes(bytes!.buffer.asUint8List());
          picture.dispose();
        });
      }

      await shot('single-weight');
      now = DateTime(2026, 11, 24, 20);
      store.addWeight(73.6);
      now = DateTime(2026, 12, 1, 20);
      store.addWeight(73.8);
      now = DateTime(2026, 12, 8, 20);
      store.addWeight(73.2);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const ValueKey('home-open-coach')));
      await tester.pumpAndSettle();
      await shot('weight-history');
      await tester.pumpWidget(const SizedBox());
    },
  );
}
