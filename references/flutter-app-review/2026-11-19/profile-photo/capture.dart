// From app: flutter test --no-pub ../references/flutter-app-review/2026-11-19/profile-photo/capture.dart
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/features/coach/presentation/profile_photo_crop.dart';

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
  testWidgets('capture the real profile photo editor', (t) async {
    t.view.physicalSize = const Size(780, 1688);
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final data = await rootBundle.load(
      'assets/photo/expert/nutritionist_smiling_in_clinic.jpg',
    );
    const capture = ValueKey('photo-editor-capture');
    await t.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: appTheme(),
        builder: (_, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: RepaintBoundary(key: capture, child: child!),
        ),
        home: ProfilePhotoCrop(bytes: data.buffer.asUint8List()),
      ),
    );
    await t.pump(const Duration(milliseconds: 400));
    await t.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 100)),
    );
    await t.pumpAndSettle();
    Future<void> shot(String name) async {
      expect(t.takeException(), isNull);
      await t.runAsync(() async {
        final boundary = t.renderObject<RenderRepaintBoundary>(
          find.byKey(capture),
        );
        final picture = await boundary.toImage(pixelRatio: 2);
        final png = await picture.toByteData(format: ui.ImageByteFormat.png);
        await File(
          '../references/flutter-app-review/2026-11-19/profile-photo/$name.png',
        ).writeAsBytes(png!.buffer.asUint8List());
        picture.dispose();
      });
    }

    await shot('editor');
    t
        .widget<Slider>(find.byKey(const ValueKey('profile-photo-zoom')))
        .onChanged!(1.7);
    await t.pumpAndSettle();
    await shot('zoomed');
    t.view.physicalSize = const Size(640, 1280);
    await t.pumpAndSettle();
    await shot('narrow');
    await t.pumpWidget(const SizedBox());
  });
}
