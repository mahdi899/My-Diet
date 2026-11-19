// From app: flutter test --no-pub ../references/flutter-app-review/2026-11-19/doctor-profile/capture.dart
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/presentation/screens/doctor.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });

  testWidgets(
    'capture the actual doctor profile at normal and large text sizes',
    (t) async {
      t.view.physicalSize = const Size(780, 1688);
      t.view.devicePixelRatio = 2;
      addTearDown(t.view.reset);
      final store = DemoStore();
      addTearDown(store.dispose);
      const capture = ValueKey('doctor-capture');
      Future<void> mount({double scale = 1}) async {
        await t.pumpWidget(const SizedBox());
        await t.pumpWidget(
          DemoScope(
            store: store,
            child: MaterialApp(
              debugShowCheckedModeBanner: false,
              theme: appTheme(),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(context)
                    .copyWith(textScaler: TextScaler.linear(scale)),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: RepaintBoundary(key: capture, child: child!),
                ),
              ),
              initialRoute: '/doctor',
              routes: {
                '/': (_) => const Scaffold(),
                '/doctor': (_) => const DoctorDetailsScreen(),
              },
            ),
          ),
        );
        await t.pumpAndSettle();
      }

      Future<void> shot(String name) async {
        expect(t.takeException(), isNull);
        await t.runAsync(() async {
          final boundary = t.renderObject<RenderRepaintBoundary>(
            find.byKey(capture),
          );
          final picture = await boundary.toImage(pixelRatio: 2);
          final bytes = await picture.toByteData(
            format: ui.ImageByteFormat.png,
          );
          await File(
            '../references/flutter-app-review/2026-11-19/doctor-profile/$name.png',
          ).writeAsBytes(bytes!.buffer.asUint8List());
          picture.dispose();
        });
      }

      await mount();
      await shot('implemented');
      t.view.physicalSize = const Size(640, 1480);
      await mount(scale: 1.5);
      await shot('narrow-large-text');
      await t.ensureVisible(find.text(store.experts.first.degree));
      await t.pumpAndSettle();
      await shot('narrow-large-text-education');
      await t.pumpWidget(const SizedBox());
    },
  );
}
