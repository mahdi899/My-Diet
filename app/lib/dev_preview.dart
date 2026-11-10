import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'core/theme/theme.dart';
import 'presentation/screens/kit_gallery.dart';

/// Optional debug-only capture of the running Flutter frame, not a mockup.
/// Normal runs do not create a file or skip the entry screen.
class DevPreview extends StatefulWidget {
  const DevPreview({super.key, required this.child});
  final Widget child;
  @override
  State<DevPreview> createState() => _DevPreviewState();
}

class _DevPreviewState extends State<DevPreview> {
  final boundaryKey = GlobalKey();
  static const capturePath = String.fromEnvironment('PREVIEW_SCREENSHOT');

  /// --dart-define=KIT_GALLERY=true boots straight into the design-kit
  /// gallery (debug only). From code, use openKitGallery(context).
  static const kitGallery = bool.fromEnvironment('KIT_GALLERY');

  @override
  void initState() {
    super.initState();
    if (kDebugMode && capturePath.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        await Future<void>.delayed(const Duration(milliseconds: 900));
        if (!mounted) return;
        try {
          final boundary =
              boundaryKey.currentContext!.findRenderObject()
                  as RenderRepaintBoundary;
          final image = await boundary.toImage(pixelRatio: 2);
          final data = await image.toByteData(format: ui.ImageByteFormat.png);
          image.dispose();
          if (data != null) {
            await File(capturePath).writeAsBytes(data.buffer.asUint8List());
            debugPrint('Flutter preview frame saved.');
          }
        } catch (error) {
          debugPrint('Preview capture failed: $error');
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) => RepaintBoundary(
    key: boundaryKey,
    child: kDebugMode && _DevPreviewState.kitGallery
        ? MaterialApp(
            debugShowCheckedModeBanner: false,
            title: 'رژیم من',
            theme: appTheme(),
            locale: const Locale('fa'),
            supportedLocales: const [Locale('fa'), Locale('en')],
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            home: const KitGalleryScreen(),
          )
        : widget.child,
  );
}
