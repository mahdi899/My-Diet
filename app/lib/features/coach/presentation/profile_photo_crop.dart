import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../domain/common/digits.dart';

/// Returns only a confirmed, square crop. Leaving the editor preserves the photo.
class ProfilePhotoCrop extends StatefulWidget {
  const ProfilePhotoCrop({super.key, required this.bytes});
  final Uint8List bytes;

  @override
  State<ProfilePhotoCrop> createState() => _ProfilePhotoCropState();
}

class _ProfilePhotoCropState extends State<ProfilePhotoCrop> {
  ui.Image? image;
  bool failed = false;

  @override
  void initState() {
    super.initState();
    decode();
  }

  Future<void> decode() async {
    try {
      final codec = await ui.instantiateImageCodec(widget.bytes);
      late final ui.FrameInfo frame;
      try {
        frame = await codec.getNextFrame();
      } finally {
        codec.dispose();
      }
      if (!mounted) {
        frame.image.dispose();
        return;
      }
      setState(() => image = frame.image);
    } catch (_) {
      if (mounted) setState(() => failed = true);
    }
  }

  @override
  void dispose() {
    image?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF111916),
    appBar: AppBar(
      backgroundColor: const Color(0xFF111916),
      foregroundColor: Colors.white,
      title: const Text('تنظیم عکس پروفایل'),
      titleTextStyle: AppTypography.cardTitle.copyWith(color: Colors.white),
      leading: IconButton(
        tooltip: 'لغو',
        onPressed: () => Navigator.pop(context),
        icon: const Icon(Icons.close_rounded),
      ),
    ),
    body: SafeArea(
      top: false,
      child: image == null
          ? Center(
              child: failed
                  ? const Text(
                      'عکس باز نشد؛ عکس دیگری انتخاب کن.',
                      style: TextStyle(color: Colors.white),
                    )
                  : const CircularProgressIndicator(color: Colors.white),
            )
          : LayoutBuilder(
              builder: (context, constraints) {
                final controlsHeight =
                    130 + MediaQuery.textScalerOf(context).scale(16) * 2;
                final side = math.max(
                  1.0,
                  math.min(
                    constraints.maxWidth - 32,
                    constraints.maxHeight - controlsHeight,
                  ),
                );
                return _CropEditor(
                  key: ValueKey(side),
                  image: image!,
                  side: side,
                );
              },
            ),
    ),
  );
}

class _CropEditor extends StatefulWidget {
  const _CropEditor({super.key, required this.image, required this.side});
  final ui.Image image;
  final double side;

  @override
  State<_CropEditor> createState() => _CropEditorState();
}

class _CropEditorState extends State<_CropEditor> {
  late final fit = math.max(
    widget.side / widget.image.width,
    widget.side / widget.image.height,
  );
  late final imageWidth = widget.image.width * fit;
  late final imageHeight = widget.image.height * fit;
  late final transform = TransformationController(
    Matrix4.identity()..setTranslationRaw(
      (widget.side - imageWidth) / 2,
      (widget.side - imageHeight) / 2,
      0,
    ),
  );
  bool saving = false;
  String? error;

  void zoom(double next) {
    final scale = next.clamp(1.0, 5.0);
    final center = transform.toScene(Offset(widget.side / 2, widget.side / 2));
    final x = (widget.side / 2 - center.dx * scale).clamp(
      widget.side - imageWidth * scale,
      0.0,
    );
    final y = (widget.side / 2 - center.dy * scale).clamp(
      widget.side - imageHeight * scale,
      0.0,
    );
    transform.value = Matrix4.diagonal3Values(scale, scale, 1)
      ..setTranslationRaw(x, y, 0);
  }

  Future<void> confirm() async {
    setState(() {
      saving = true;
      error = null;
    });
    try {
      final scale = transform.value.getMaxScaleOnAxis();
      final origin = transform.toScene(Offset.zero);
      final sourceSide = math.min(
        widget.side / (fit * scale),
        math.min(widget.image.width, widget.image.height).toDouble(),
      );
      final source = Rect.fromLTWH(
        (origin.dx / fit).clamp(0.0, widget.image.width - sourceSide),
        (origin.dy / fit).clamp(0.0, widget.image.height - sourceSide),
        sourceSide,
        sourceSide,
      );
      // Keep the encoded crop within the personal-details API's photo limit.
      for (final size in [512, 320, 256]) {
        final recorder = ui.PictureRecorder();
        final canvas = Canvas(recorder);
        canvas.drawImageRect(
          widget.image,
          source,
          Rect.fromLTWH(0, 0, size.toDouble(), size.toDouble()),
          Paint()..filterQuality = FilterQuality.high,
        );
        final picture = recorder.endRecording();
        final cropped = await picture.toImage(size, size);
        picture.dispose();
        final data = await cropped.toByteData(format: ui.ImageByteFormat.png);
        cropped.dispose();
        if (data == null) continue;
        final bytes = data.buffer.asUint8List();
        if (bytes.length <= 330000) {
          if (mounted) Navigator.pop(context, bytes);
          return;
        }
      }
      throw StateError('Photo too large');
    } catch (_) {
      if (mounted) {
        setState(() {
          saving = false;
          error = 'تنظیم عکس انجام نشد؛ دوباره تلاش کن.';
        });
      }
    }
  }

  @override
  void dispose() {
    transform.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Expanded(
        child: Center(
          child: SizedBox.square(
            dimension: widget.side,
            child: Stack(
              fit: StackFit.expand,
              children: [
                InteractiveViewer(
                  key: const ValueKey('profile-photo-viewport'),
                  transformationController: transform,
                  constrained: false,
                  alignment: Alignment.topLeft,
                  minScale: 1,
                  maxScale: 5,
                  panEnabled: !saving,
                  scaleEnabled: !saving,
                  child: SizedBox(
                    width: imageWidth,
                    height: imageHeight,
                    child: RawImage(image: widget.image, fit: BoxFit.fill),
                  ),
                ),
                const IgnorePointer(
                  child: ExcludeSemantics(
                    child: CustomPaint(painter: _CircleCropMask()),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Column(
          children: [
            const Text(
              'عکس را جابه‌جا کن',
              style: TextStyle(color: Colors.white70, fontSize: 12),
            ),
            ValueListenableBuilder<Matrix4>(
              valueListenable: transform,
              builder: (context, matrix, _) {
                final scale = matrix.getMaxScaleOnAxis().clamp(1.0, 5.0);
                return Directionality(
                  textDirection: TextDirection.ltr,
                  child: Row(
                    children: [
                      IconButton(
                        tooltip: 'کوچک‌نمایی',
                        onPressed: saving || scale <= 1
                            ? null
                            : () => zoom(scale - .25),
                        color: Colors.white,
                        disabledColor: Colors.white38,
                        icon: const Icon(Icons.remove_rounded),
                      ),
                      Expanded(
                        child: Semantics(
                          label: 'بزرگ‌نمایی عکس',
                          child: Slider(
                            key: const ValueKey('profile-photo-zoom'),
                            min: 1,
                            max: 5,
                            value: scale,
                            semanticFormatterCallback: (value) =>
                                '${fa(value.toStringAsFixed(1))} برابر',
                            activeColor: AppColors.emerald,
                            onChanged: saving ? null : zoom,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'بزرگ‌نمایی',
                        onPressed: saving || scale >= 5
                            ? null
                            : () => zoom(scale + .25),
                        color: Colors.white,
                        disabledColor: Colors.white38,
                        icon: const Icon(Icons.add_rounded),
                      ),
                    ],
                  ),
                );
              },
            ),
            if (error != null)
              Text(error!, style: const TextStyle(color: Colors.white)),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                key: const ValueKey('profile-photo-confirm'),
                onPressed: saving ? null : confirm,
                child: Text(saving ? 'در حال آماده‌سازی…' : 'تأیید عکس'),
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

class _CircleCropMask extends CustomPainter {
  const _CircleCropMask();

  @override
  void paint(Canvas canvas, Size size) {
    final circle = Rect.fromLTWH(0, 0, size.width, size.height);
    canvas.drawPath(
      Path()
        ..fillType = PathFillType.evenOdd
        ..addRect(circle)
        ..addOval(circle),
      Paint()..color = const Color(0xB3111916),
    );
    canvas.drawOval(
      circle.deflate(1),
      Paint()
        ..color = Colors.white70
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
  }

  @override
  bool shouldRepaint(_CircleCropMask oldDelegate) => false;
}
