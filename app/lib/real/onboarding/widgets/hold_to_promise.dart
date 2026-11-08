import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../theme.dart';
import '../../core/motion.dart';

/// A commitment gesture: press and hold until the ring closes.
/// Releasing early drains it again, so it only completes when it is meant.
class HoldToPromise extends StatefulWidget {
  const HoldToPromise({
    super.key,
    required this.onCompleted,
    this.label = 'نگه دار تا قول بدی',
    this.doneLabel = 'قول دادی',
    this.duration = const Duration(milliseconds: 1500),
  });
  final VoidCallback onCompleted;
  final String label, doneLabel;
  final Duration duration;

  @override
  State<HoldToPromise> createState() => _HoldToPromiseState();
}

class _HoldToPromiseState extends State<HoldToPromise>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.duration,
    reverseDuration: const Duration(milliseconds: 400),
  );
  bool done = false;

  @override
  void initState() {
    super.initState();
    _c.addStatusListener((s) {
      if (s == AnimationStatus.completed && !done) {
        setState(() => done = true);
        Haptics.success();
        widget.onCompleted();
      }
    });
    _c.addListener(() {
      // A faint tick as the ring fills.
      if (!done && (_c.value * 10).floor() != _lastTick) {
        _lastTick = (_c.value * 10).floor();
        if (_c.isAnimating && _c.status == AnimationStatus.forward) {
          Haptics.tap();
        }
      }
    });
  }

  int _lastTick = 0;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: widget.label,
    child: GestureDetector(
      onTapDown: (_) {
        if (!done) _c.forward();
      },
      onTapUp: (_) {
        if (!done) _c.reverse();
      },
      onTapCancel: () {
        if (!done) _c.reverse();
      },
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 112,
              height: 112,
              child: CustomPaint(
                painter: _PromisePainter(_c.value, done),
                child: Center(
                  child: AnimatedSwitcher(
                    duration: Motion.base,
                    child: Icon(
                      done ? Icons.check_rounded : Icons.fingerprint,
                      key: ValueKey(done),
                      size: 52,
                      color: done ? Colors.white : pine,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              done ? widget.doneLabel : widget.label,
              style: TextStyle(
                color: done ? pine : muted,
                fontWeight: done ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _PromisePainter extends CustomPainter {
  _PromisePainter(this.value, this.done);
  final double value;
  final bool done;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 6;
    canvas.drawCircle(c, r, Paint()..color = done ? pine : sage);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6
        ..color = const Color(0xFFCFDDBB),
    );
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r),
      -math.pi / 2,
      2 * math.pi * value,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round
        ..color = done ? Colors.white : pine,
    );
  }

  @override
  bool shouldRepaint(_PromisePainter old) =>
      old.value != value || old.done != done;
}
