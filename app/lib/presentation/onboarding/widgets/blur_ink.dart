import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../core/format/digits.dart';
import '../../../core/motion/motion.dart';

/// A line of text that resolves out of a blur whenever [text] changes.
class BlurSwap extends StatefulWidget {
  const BlurSwap({
    super.key,
    required this.text,
    required this.style,
    this.textAlign = TextAlign.center,
    this.maxLines = 3,
  });

  final String text;
  final TextStyle style;
  final TextAlign textAlign;
  final int maxLines;

  @override
  State<BlurSwap> createState() => _BlurSwapState();
}

class _BlurSwapState extends State<BlurSwap>
    with SingleTickerProviderStateMixin {
  late final AnimationController _settle = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 520),
  );
  var _playedIn = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_playedIn) return;
    _playedIn = true;
    if (Motion.reduced(context)) {
      _settle.value = 1;
    } else {
      _settle.forward();
    }
  }

  @override
  void didUpdateWidget(BlurSwap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.text == widget.text) return;
    if (Motion.reduced(context)) {
      _settle.value = 1;
      return;
    }
    _settle.forward(from: 0);
  }

  @override
  void dispose() {
    _settle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _settle,
      builder: (context, child) {
        final t = Curves.easeOutCubic.transform(_settle.value);
        final sigma = 14 * (1 - t);
        final shown = Opacity(
          opacity: (0.35 + 0.65 * t).clamp(0, 1),
          child: child,
        );
        if (sigma < 0.4) return shown;
        return ImageFiltered(
          imageFilter: ImageFilter.blur(
            sigmaX: sigma,
            sigmaY: sigma,
            tileMode: TileMode.decal,
          ),
          child: shown,
        );
      },
      child: Text(
        widget.text,
        textAlign: widget.textAlign,
        maxLines: widget.maxLines,
        style: widget.style,
      ),
    );
  }
}

/// Fixed-width Persian digits. A cell that just changed sharpens out of blur.
class BlurDigits extends StatelessWidget {
  const BlurDigits({
    super.key,
    required this.value,
    required this.style,
    this.places = 3,
  });

  final int value;
  final TextStyle style;
  final int places;

  @override
  Widget build(BuildContext context) {
    final slots = _places(value, places);
    return Row(
      mainAxisSize: MainAxisSize.min,
      textDirection: TextDirection.ltr,
      children: [
        for (var i = 0; i < slots.length; i++)
          _DigitCell(
            key: ValueKey('digit-$i'),
            digit: slots[i],
            style: style,
          ),
      ],
    );
  }
}

List<int?> _places(int value, int count) {
  final places = List<int?>.filled(count, null);
  var v = value.abs();
  if (v == 0) {
    places[count - 1] = 0;
    return places;
  }
  for (var i = count - 1; i >= 0 && v > 0; i--) {
    places[i] = v % 10;
    v ~/= 10;
  }
  return places;
}

class _DigitCell extends StatefulWidget {
  const _DigitCell({super.key, required this.digit, required this.style});

  final int? digit;
  final TextStyle style;

  @override
  State<_DigitCell> createState() => _DigitCellState();
}

class _DigitCellState extends State<_DigitCell>
    with SingleTickerProviderStateMixin {
  late final AnimationController _settle = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
    value: 1,
  );
  Timer? _idle;

  @override
  void didUpdateWidget(_DigitCell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.digit == widget.digit) return;
    if (Motion.reduced(context) ||
        widget.digit == null ||
        oldWidget.digit == null) {
      _idle?.cancel();
      _settle.value = 1;
      return;
    }
    _settle.value = 0;
    _idle?.cancel();
    _idle = Timer(const Duration(milliseconds: 70), () {
      if (mounted) _settle.forward(from: 0);
    });
  }

  @override
  void dispose() {
    _idle?.cancel();
    _settle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final glyph = widget.digit == null ? '' : fa(widget.digit);
    return AnimatedBuilder(
      animation: _settle,
      builder: (context, child) {
        final t = Curves.easeOutCubic.transform(_settle.value);
        final sigma = 16 * (1 - t);
        final shown = Opacity(opacity: (0.4 + 0.6 * t).clamp(0, 1), child: child);
        if (sigma < 0.35) return shown;
        return ImageFiltered(
          imageFilter: ImageFilter.blur(
            sigmaX: sigma,
            sigmaY: sigma,
            tileMode: TileMode.decal,
          ),
          child: shown,
        );
      },
      child: SizedBox(
        width: (widget.style.fontSize ?? 64) * 0.62,
        child: Text(glyph, textAlign: TextAlign.center, style: widget.style),
      ),
    );
  }
}
