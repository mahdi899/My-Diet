import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';

/// Centered name field. New letters fade in and sharpen out of a blur.
/// The field itself is invisible; a painter keeps Persian shaping intact.
class BlurNameField extends StatefulWidget {
  const BlurNameField({
    super.key,
    required this.value,
    required this.onChanged,
    this.hint = 'اسمت',
    this.autofocus = true,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final String hint;
  final bool autofocus;

  @override
  State<BlurNameField> createState() => _BlurNameFieldState();
}

class _BlurNameFieldState extends State<BlurNameField> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.value,
  );

  @override
  void didUpdateWidget(BlurNameField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const ink = TextStyle(
      fontFamily: 'Vazirmatn',
      fontSize: 36,
      fontWeight: FontWeight.w700,
      color: AppColors.ink,
      height: 1.3,
    );
    const bare = InputBorder.none;
    return SizedBox(
      width: double.infinity,
      height: 88,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned.fill(
            child: ExcludeSemantics(
              child: IgnorePointer(
                child: _NameInk(
                  text: _controller.text,
                  caret: _controller.selection.extentOffset,
                  style: ink,
                ),
              ),
            ),
          ),
          TextField(
            controller: _controller,
            autofocus: widget.autofocus,
            maxLength: 40,
            maxLines: 1,
            textAlign: TextAlign.center,
            textInputAction: TextInputAction.done,
            cursorColor: AppColors.emeraldDeep,
            cursorWidth: 2,
            style: ink.copyWith(color: const Color(0x00000000)),
            onChanged: widget.onChanged,
            decoration: InputDecoration(
              isCollapsed: true,
              filled: false,
              fillColor: Colors.transparent,
              contentPadding: EdgeInsets.zero,
              counterText: '',
              border: bare,
              enabledBorder: bare,
              focusedBorder: bare,
              disabledBorder: bare,
              errorBorder: bare,
              focusedErrorBorder: bare,
              hintText: widget.hint,
              hintStyle: ink.copyWith(
                fontWeight: FontWeight.w500,
                color: AppColors.muted.withValues(alpha: 0.4),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Glyph {
  _Glyph(this.char, this.controller);
  final String char;
  AnimationController? controller;
  double get t => controller?.value ?? 1;
}

class _NameInk extends StatefulWidget {
  const _NameInk({required this.text, required this.caret, required this.style});

  final String text;
  final int caret;
  final TextStyle style;

  @override
  State<_NameInk> createState() => _NameInkState();
}

class _NameInkState extends State<_NameInk> with TickerProviderStateMixin {
  final List<_Glyph> _glyphs = [];

  @override
  void initState() {
    super.initState();
    _reconcile(widget.text, animate: false);
  }

  @override
  void didUpdateWidget(_NameInk oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (Motion.reduced(context)) {
      for (final g in _glyphs) {
        _release(g);
      }
    }
    if (widget.text != _glyphs.map((g) => g.char).join()) {
      _reconcile(widget.text, animate: !Motion.reduced(context));
    }
  }

  @override
  void dispose() {
    for (final g in _glyphs) {
      _release(g);
    }
    super.dispose();
  }

  void _tick() {
    if (mounted) setState(() {});
  }

  AnimationController _spawn() {
    final c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    )..addListener(_tick);
    c.forward();
    return c;
  }

  void _release(_Glyph g) {
    final c = g.controller;
    if (c == null) return;
    c.removeListener(_tick);
    c.dispose();
    g.controller = null;
  }

  void _reconcile(String next, {required bool animate}) {
    final fresh = [for (final r in next.runes) String.fromCharCode(r)];
    final old = [for (final g in _glyphs) g.char];
    var start = 0;
    final prefix = math.min(old.length, fresh.length);
    while (start < prefix && old[start] == fresh[start]) {
      start++;
    }
    var endOld = old.length;
    var endNew = fresh.length;
    while (endOld > start &&
        endNew > start &&
        old[endOld - 1] == fresh[endNew - 1]) {
      endOld--;
      endNew--;
    }
    for (var i = start; i < endOld; i++) {
      _release(_glyphs[i]);
    }
    final inserted = [
      for (var i = start; i < endNew; i++)
        _Glyph(fresh[i], animate && (endNew - start) <= 4 ? _spawn() : null),
    ];
    final nextGlyphs = [
      ..._glyphs.sublist(0, start),
      ...inserted,
      ..._glyphs.sublist(endOld),
    ];
    _glyphs
      ..clear()
      ..addAll(nextGlyphs);
  }

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _NameInkPainter(
        glyphs: [for (final g in _glyphs) (g.char, g.t)],
        caret: widget.caret,
        style: widget.style,
        direction: Directionality.of(context),
        scaler: MediaQuery.textScalerOf(context),
      ),
    );
  }
}

class _NameInkPainter extends CustomPainter {
  _NameInkPainter({
    required this.glyphs,
    required this.caret,
    required this.style,
    required this.direction,
    required this.scaler,
  });

  final List<(String, double)> glyphs;
  final int caret;
  final TextStyle style;
  final TextDirection direction;
  final TextScaler scaler;

  @override
  void paint(Canvas canvas, Size size) {
    if (glyphs.isEmpty || size.isEmpty) return;
    final color = style.color ?? AppColors.ink;
    TextPainter layout(List<TextStyle> styles) {
      return TextPainter(
        text: TextSpan(
          children: [
            for (var i = 0; i < glyphs.length; i++)
              TextSpan(text: glyphs[i].$1, style: styles[i]),
          ],
        ),
        textAlign: TextAlign.center,
        textDirection: direction,
        textScaler: scaler,
        maxLines: 1,
      )..layout(maxWidth: size.width);
    }

    final base = layout([
      for (final g in glyphs)
        g.$2 >= 1 ? style : style.copyWith(color: color.withValues(alpha: 0)),
    ]);
    // layout() shrinks to the glyphs, so center that run in the field.
    final origin = Offset(
      (size.width - base.width) / 2,
      (size.height - base.height) / 2,
    );
    base.paint(canvas, origin);
    for (var i = 0; i < glyphs.length; i++) {
      final raw = glyphs[i].$2;
      if (raw >= 1) continue;
      final p = raw.clamp(0.0, 1.0);
      final sigma = (1 - Curves.easeOutCubic.transform(p)) * 8;
      final rise = (1 - Curves.easeOutCubic.transform(p)) * 6;
      final opacity = (0.55 + 0.45 * Curves.easeOut.transform(p)).clamp(0, 1);
      final one = layout([
        for (var j = 0; j < glyphs.length; j++)
          style.copyWith(
            color: color.withValues(alpha: j == i ? opacity.toDouble() : 0),
          ),
      ]);
      final dest = Offset(
        (size.width - one.width) / 2,
        (size.height - one.height) / 2 + rise,
      );
      if (sigma > 0.35) {
        canvas.saveLayer(
          Rect.fromLTWH(-24, -16, size.width + 48, size.height + 40),
          Paint()
            ..imageFilter = ImageFilter.blur(
              sigmaX: sigma,
              sigmaY: sigma,
              tileMode: TileMode.decal,
            ),
        );
        one.paint(canvas, dest);
        canvas.restore();
      } else {
        one.paint(canvas, dest);
      }
      one.dispose();
    }
    base.dispose();
  }

  @override
  bool shouldRepaint(_NameInkPainter old) {
    if (old.glyphs.length != glyphs.length || old.caret != caret) return true;
    for (var i = 0; i < glyphs.length; i++) {
      if (old.glyphs[i] != glyphs[i]) return true;
    }
    return false;
  }
}
