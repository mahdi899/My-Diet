import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/features/coach/presentation/profile_photo_crop.dart';

Future<Uint8List> cropTestPhoto() async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  for (final (index, color) in [
    Colors.red,
    Colors.green,
    Colors.blue,
  ].indexed) {
    canvas.drawRect(
      Rect.fromLTWH(index * 100, 0, 100, 100),
      Paint()..color = color,
    );
  }
  final picture = recorder.endRecording();
  final image = await picture.toImage(300, 100);
  picture.dispose();
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  return data!.buffer.asUint8List();
}

void main() {
  testWidgets(
    'zoom, zoom out and pan export the selected square without the mask',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final bytes = (await t.runAsync(cropTestPhoto))!;
      Future<Uint8List?>? result;
      Uint8List? resultBytes;
      await t.pumpWidget(
        MaterialApp(
          theme: appTheme(),
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () {
                  result = Navigator.of(context).push<Uint8List>(
                    MaterialPageRoute(
                      builder: (_) => ProfilePhotoCrop(bytes: bytes),
                    ),
                  );
                  result!.then((bytes) => resultBytes = bytes);
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await t.tap(find.text('open'));
      await t.pump(const Duration(milliseconds: 400));
      await t.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 50)),
      );
      await t.pumpAndSettle();
      final viewport = find.byKey(const ValueKey('profile-photo-viewport'));
      final viewer = t.widget<InteractiveViewer>(viewport);
      await t.tap(find.byTooltip('بزرگ‌نمایی'));
      await t.pump();
      expect(viewer.transformationController!.value.getMaxScaleOnAxis(), 1.25);
      await t.tap(find.byTooltip('کوچک‌نمایی'));
      await t.pump();
      expect(viewer.transformationController!.value.getMaxScaleOnAxis(), 1);

      final center = t.getCenter(viewport);
      final left = await t.startGesture(
        center - const Offset(40, 0),
        pointer: 1,
      );
      final right = await t.startGesture(
        center + const Offset(40, 0),
        pointer: 2,
      );
      await left.moveTo(center - const Offset(80, 0));
      await right.moveTo(center + const Offset(80, 0));
      await t.pump();
      expect(
        viewer.transformationController!.value.getMaxScaleOnAxis(),
        greaterThan(1),
      );
      await left.up();
      await right.up();
      t
          .widget<Slider>(find.byKey(const ValueKey('profile-photo-zoom')))
          .onChanged!(1);
      await t.pumpAndSettle();

      // The panorama starts on green; move its left red panel into the crop.
      await t.drag(viewport, Offset(t.getSize(viewport).width, 0));
      await t.pumpAndSettle();
      await t.runAsync(() async {
        await t.tap(find.byKey(const ValueKey('profile-photo-confirm')));
        await Future<void>.delayed(const Duration(milliseconds: 100));
      });
      await t.pumpAndSettle();
      final cropped = resultBytes;
      expect(find.text('تنظیم عکس انجام نشد؛ دوباره تلاش کن.'), findsNothing);
      expect(cropped, isNotNull);
      expect(cropped!.length, lessThanOrEqualTo(330000));
      await t.runAsync(() async {
        final codec = await ui.instantiateImageCodec(cropped);
        final image = (await codec.getNextFrame()).image;
        expect(image.width, image.height);
        final rgba = (await image.toByteData())!.buffer.asUint8List();
        // Corners also stay red: the circular shade is never saved into the photo.
        for (final offset in [
          0,
          ((image.width ~/ 2) * image.width + image.width ~/ 2) * 4,
        ]) {
          expect(rgba[offset], (Colors.red.toARGB32() >> 16) & 255);
          expect(rgba[offset + 1], (Colors.red.toARGB32() >> 8) & 255);
          expect(rgba[offset + 2], Colors.red.toARGB32() & 255);
          expect(rgba[offset + 3], 255);
        }
        image.dispose();
        codec.dispose();
      });
      expect(t.takeException(), isNull);
    },
  );

  testWidgets(
    'cancel returns no replacement and a broken image stays cancellable',
    (t) async {
      Future<Uint8List?>? result;
      await t.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () {
                  result = Navigator.of(context).push<Uint8List>(
                    MaterialPageRoute(
                      builder: (_) => ProfilePhotoCrop(
                        bytes: Uint8List.fromList([1, 2, 3]),
                      ),
                    ),
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await t.tap(find.text('open'));
      await t.pumpAndSettle();
      await t.tap(find.byTooltip('لغو'));
      await t.pumpAndSettle();
      expect(await result, isNull);
      expect(t.takeException(), isNull);
    },
  );
}
