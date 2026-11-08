import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../theme.dart';
import '../../core/digits.dart';
import '../../core/motion.dart';

/// A 24-hour dial with two handles: bedtime (moon) and wake-up (sun).
/// Drag either handle, or use the steppers below for precise, accessible control.
class SleepWakeDial extends StatefulWidget {
  const SleepWakeDial({
    super.key,
    required this.sleep,
    required this.wake,
    required this.onChanged,
  });
  final int sleep, wake;
  final void Function(int sleep, int wake) onChanged;

  @override
  State<SleepWakeDial> createState() => _SleepWakeDialState();
}

class _SleepWakeDialState extends State<SleepWakeDial> {
  _Handle? _dragging;

  double _angle(int hour) => hour / 24 * 2 * math.pi - math.pi / 2;

  int _hourAt(Offset local, Size size) {
    final c = size.center(Offset.zero);
    var a = math.atan2(local.dy - c.dy, local.dx - c.dx) + math.pi / 2;
    if (a < 0) a += 2 * math.pi;
    return (a / (2 * math.pi) * 24).round() % 24;
  }

  Offset _pos(int hour, Size size, double radius) {
    final c = size.center(Offset.zero);
    final a = _angle(hour);
    return c + Offset(math.cos(a), math.sin(a)) * radius;
  }

  void _start(Offset local, Size size) {
    final r = size.width / 2 - 34;
    final ds = (local - _pos(widget.sleep, size, r)).distance;
    final dw = (local - _pos(widget.wake, size, r)).distance;
    _dragging = ds <= dw ? _Handle.sleep : _Handle.wake;
    _move(local, size);
  }

  void _move(Offset local, Size size) {
    final hour = _hourAt(local, size);
    if (_dragging == _Handle.sleep && hour != widget.sleep) {
      Haptics.tap();
      widget.onChanged(hour, widget.wake);
    } else if (_dragging == _Handle.wake && hour != widget.wake) {
      Haptics.tap();
      widget.onChanged(widget.sleep, hour);
    }
  }

  int get _hours => (widget.wake - widget.sleep + 24) % 24;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      LayoutBuilder(
        builder: (context, c) {
          final side = math.min(c.maxWidth - 40, 300.0);
          final size = Size.square(side);
          return SizedBox(
            width: side,
            height: side,
            child: GestureDetector(
              onPanStart: (d) => _start(d.localPosition, size),
              onPanUpdate: (d) => _move(d.localPosition, size),
              onPanEnd: (_) => _dragging = null,
              child: CustomPaint(
                painter: _DialPainter(widget.sleep, widget.wake),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        fa(_hours),
                        style: const TextStyle(
                          fontSize: 44,
                          fontWeight: FontWeight.bold,
                          color: pine,
                        ),
                      ),
                      const Text(
                        'ساعت خواب',
                        style: TextStyle(color: muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
      const SizedBox(height: 18),
      Row(
        children: [
          Expanded(
            child: _HourStepper(
              icon: Icons.nightlight_round,
              label: 'خواب',
              hour: widget.sleep,
              onChanged: (h) => widget.onChanged(h, widget.wake),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _HourStepper(
              icon: Icons.wb_sunny_rounded,
              label: 'بیداری',
              hour: widget.wake,
              onChanged: (h) => widget.onChanged(widget.sleep, h),
            ),
          ),
        ],
      ),
    ],
  );
}

enum _Handle { sleep, wake }

class _HourStepper extends StatelessWidget {
  const _HourStepper({
    required this.icon,
    required this.label,
    required this.hour,
    required this.onChanged,
  });
  final IconData icon;
  final String label;
  final int hour;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFDDE5D4)),
    ),
    child: Row(
      children: [
        IconButton(
          tooltip: 'یک ساعت بعد',
          onPressed: () {
            Haptics.tap();
            onChanged((hour + 1) % 24);
          },
          icon: const Icon(Icons.keyboard_arrow_up_rounded),
        ),
        Expanded(
          child: Column(
            children: [
              Icon(icon, size: 18, color: amber),
              Text(
                '${fa(hour.toString().padLeft(2, '0'))}:۰۰',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              Text(label, style: const TextStyle(color: muted, fontSize: 11)),
            ],
          ),
        ),
        IconButton(
          tooltip: 'یک ساعت قبل',
          onPressed: () {
            Haptics.tap();
            onChanged((hour + 23) % 24);
          },
          icon: const Icon(Icons.keyboard_arrow_down_rounded),
        ),
      ],
    ),
  );
}

class _DialPainter extends CustomPainter {
  _DialPainter(this.sleep, this.wake);
  final int sleep, wake;

  double _a(int h) => h / 24 * 2 * math.pi - math.pi / 2;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 34;
    final rect = Rect.fromCircle(center: c, radius: r);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 26
        ..color = const Color(0xFFE6EEDB),
    );
    final sweep = ((wake - sleep + 24) % 24) / 24 * 2 * math.pi;
    canvas.drawArc(
      rect,
      _a(sleep),
      sweep == 0 ? 2 * math.pi : sweep,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 26
        ..strokeCap = StrokeCap.round
        ..shader = const SweepGradient(
          colors: [Color(0xFF3F5B8C), Color(0xFF7C9C58)],
        ).createShader(rect),
    );
    final label = TextPainter(textDirection: TextDirection.rtl);
    for (final h in [0, 6, 12, 18]) {
      label
        ..text = TextSpan(
          text: fa(h),
          style: const TextStyle(color: muted, fontSize: 11),
        )
        ..layout();
      final p = c + Offset(math.cos(_a(h)), math.sin(_a(h))) * (r + 28);
      label.paint(canvas, p - Offset(label.width / 2, label.height / 2));
    }
    _knob(
      canvas,
      c + Offset(math.cos(_a(sleep)), math.sin(_a(sleep))) * r,
      Icons.nightlight_round,
      const Color(0xFF3F5B8C),
    );
    _knob(
      canvas,
      c + Offset(math.cos(_a(wake)), math.sin(_a(wake))) * r,
      Icons.wb_sunny_rounded,
      amber,
    );
  }

  void _knob(Canvas canvas, Offset at, IconData icon, Color color) {
    canvas.drawCircle(at, 17, Paint()..color = Colors.white);
    canvas.drawCircle(
      at,
      17,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..color = color,
    );
    final tp = TextPainter(
      text: TextSpan(
        text: String.fromCharCode(icon.codePoint),
        style: TextStyle(
          fontFamily: icon.fontFamily,
          fontSize: 18,
          color: color,
        ),
      ),
      textDirection: TextDirection.rtl,
    )..layout();
    tp.paint(canvas, at - Offset(tp.width / 2, tp.height / 2));
  }

  @override
  bool shouldRepaint(_DialPainter old) =>
      old.sleep != sleep || old.wake != wake;
}
