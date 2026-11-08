import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/theme.dart';
import '../../../core/format/digits.dart';
import '../../../core/motion/motion.dart';

/// A big number with round +/- buttons (press and hold to run) and a slider underneath.
class BigNumberPicker extends StatefulWidget {
  const BigNumberPicker({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    required this.step,
    required this.unit,
    required this.onChanged,
  });
  final double value, min, max, step;
  final String unit;
  final ValueChanged<double> onChanged;

  @override
  State<BigNumberPicker> createState() => _BigNumberPickerState();
}

class _BigNumberPickerState extends State<BigNumberPicker> {
  Timer? _repeat;

  void _bump(int direction) {
    final next = (widget.value + direction * widget.step).clamp(
      widget.min,
      widget.max,
    );
    if (next != widget.value) {
      Haptics.tap();
      widget.onChanged(double.parse(next.toStringAsFixed(1)));
    }
  }

  void _hold(int direction) {
    _bump(direction);
    _repeat?.cancel();
    _repeat = Timer.periodic(
      const Duration(milliseconds: 90),
      (_) => _bump(direction),
    );
  }

  void _release() => _repeat?.cancel();

  @override
  void dispose() {
    _repeat?.cancel();
    super.dispose();
  }

  Widget _round(IconData icon, int direction, String tip) => Tooltip(
    message: tip,
    child: GestureDetector(
      onTapDown: (_) => _hold(direction),
      onTapUp: (_) => _release(),
      onTapCancel: _release,
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFB7C9A1)),
        ),
        child: Icon(icon, color: pine),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _round(Icons.remove, -1, 'کمتر'),
          const SizedBox(width: 22),
          SizedBox(
            width: 150,
            child: Column(
              children: [
                AnimatedSwitcher(
                  duration: Motion.quick,
                  transitionBuilder: (child, a) => ScaleTransition(
                    scale: Tween(begin: 0.9, end: 1.0).animate(a),
                    child: FadeTransition(opacity: a, child: child),
                  ),
                  child: Text(
                    faNumber(widget.value),
                    key: ValueKey(widget.value),
                    style: const TextStyle(
                      fontSize: 56,
                      fontWeight: FontWeight.bold,
                      color: pine,
                      height: 1.2,
                    ),
                  ),
                ),
                Text(widget.unit, style: const TextStyle(color: muted)),
              ],
            ),
          ),
          const SizedBox(width: 22),
          _round(Icons.add, 1, 'بیشتر'),
        ],
      ),
      const SizedBox(height: 24),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Slider(
          value: widget.value.clamp(widget.min, widget.max),
          min: widget.min,
          max: widget.max,
          divisions: ((widget.max - widget.min) / widget.step).round(),
          onChanged: (v) {
            if (v != widget.value) Haptics.tap();
            widget.onChanged(double.parse(v.toStringAsFixed(1)));
          },
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 30),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(faNumber(widget.min), style: const TextStyle(color: muted)),
            Text(faNumber(widget.max), style: const TextStyle(color: muted)),
          ],
        ),
      ),
    ],
  );
}

/// Horizontal ruler: drag the scale under a fixed needle. Ideal for height.
class RulerPicker extends StatefulWidget {
  const RulerPicker({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    required this.unit,
    required this.onChanged,
  });
  final double value, min, max;
  final String unit;
  final ValueChanged<double> onChanged;

  @override
  State<RulerPicker> createState() => _RulerPickerState();
}

class _RulerPickerState extends State<RulerPicker> {
  static const tick = 14.0;
  late final ScrollController _controller;
  int _last = 0;

  int get _count => (widget.max - widget.min).round() + 1;

  @override
  void initState() {
    super.initState();
    _last = widget.value.round();
    _controller = ScrollController(
      initialScrollOffset: (widget.value - widget.min) * tick,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Text(
        faNumber(widget.value),
        style: const TextStyle(
          fontSize: 64,
          fontWeight: FontWeight.bold,
          color: pine,
          height: 1.2,
        ),
      ),
      Text(widget.unit, style: const TextStyle(color: muted)),
      const SizedBox(height: 22),
      Directionality(
        textDirection: TextDirection.ltr,
        child: SizedBox(
          height: 110,
          child: LayoutBuilder(
            builder: (context, c) {
              final pad = c.maxWidth / 2;
              return Stack(
                alignment: Alignment.topCenter,
                children: [
                  NotificationListener<ScrollNotification>(
                    onNotification: (n) {
                      if (n is ScrollUpdateNotification) {
                        final v = (widget.min + n.metrics.pixels / tick)
                            .round()
                            .clamp(widget.min.round(), widget.max.round());
                        if (v != _last) {
                          _last = v;
                          HapticFeedback.selectionClick();
                          widget.onChanged(v.toDouble());
                        }
                      }
                      return false;
                    },
                    child: ListView.builder(
                      controller: _controller,
                      scrollDirection: Axis.horizontal,
                      reverse: false,
                      physics: const _SnapPhysics(tick),
                      padding: EdgeInsets.symmetric(horizontal: pad),
                      itemExtent: tick,
                      itemCount: _count,
                      itemBuilder: (context, i) {
                        final n = widget.min.round() + i;
                        final major = n % 10 == 0, mid = n % 5 == 0;
                        return Column(
                          mainAxisAlignment: MainAxisAlignment.start,
                          children: [
                            Container(
                              width: 2,
                              height: major ? 56 : (mid ? 40 : 26),
                              color: major ? pine : const Color(0xFFB7C9A1),
                            ),
                            if (major)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(
                                  fa(n),
                                  softWrap: false,
                                  overflow: TextOverflow.visible,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: muted,
                                  ),
                                ),
                              ),
                          ],
                        );
                      },
                    ),
                  ),
                  IgnorePointer(
                    child: Container(width: 3, height: 74, color: amber),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    ],
  );
}

class _SnapPhysics extends ScrollPhysics {
  const _SnapPhysics(this.extent, {super.parent});
  final double extent;

  @override
  _SnapPhysics applyTo(ScrollPhysics? ancestor) =>
      _SnapPhysics(extent, parent: buildParent(ancestor));

  double _target(ScrollMetrics m, double velocity) {
    final page = m.pixels / extent + velocity / 2600;
    return (page.roundToDouble() * extent).clamp(
      m.minScrollExtent,
      m.maxScrollExtent,
    );
  }

  @override
  Simulation? createBallisticSimulation(
    ScrollMetrics position,
    double velocity,
  ) {
    final target = _target(position, velocity);
    if ((target - position.pixels).abs() < 0.5) return null;
    return ScrollSpringSimulation(
      spring,
      position.pixels,
      target,
      velocity,
      tolerance: toleranceFor(position),
    );
  }

  @override
  bool get allowImplicitScrolling => false;
}

/// Exact-age wheel for the age question.
class AgeWheel extends StatefulWidget {
  const AgeWheel({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
  });
  final int value, min, max;
  final ValueChanged<int> onChanged;

  @override
  State<AgeWheel> createState() => _AgeWheelState();
}

class _AgeWheelState extends State<AgeWheel> {
  late final FixedExtentScrollController _controller =
      FixedExtentScrollController(initialItem: widget.value - widget.min);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  // A wheel needs a bounded height; the onboarding page gives its body unbounded
  // height (it sits in a scroll view), so the wheel brings its own.
  Widget build(BuildContext context) => SizedBox(
    height: 300,
    child: Stack(
      alignment: Alignment.center,
      children: [
        Container(
          height: 62,
          margin: const EdgeInsets.symmetric(horizontal: 60),
          decoration: BoxDecoration(
            color: sage,
            borderRadius: BorderRadius.circular(18),
          ),
        ),
        ListWheelScrollView.useDelegate(
          controller: _controller,
          itemExtent: 62,
          diameterRatio: 2.2,
          perspective: 0.004,
          physics: const FixedExtentScrollPhysics(),
          onSelectedItemChanged: (i) {
            Haptics.tap();
            widget.onChanged(widget.min + i);
          },
          childDelegate: ListWheelChildBuilderDelegate(
            childCount: widget.max - widget.min + 1,
            builder: (context, i) {
              final selected = widget.min + i == widget.value;
              return Center(
                child: AnimatedDefaultTextStyle(
                  duration: Motion.quick,
                  style: TextStyle(
                    fontFamily: 'Vazirmatn',
                    fontSize: selected ? 34 : 22,
                    fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                    color: selected ? pine : muted,
                  ),
                  child: Text('${fa(widget.min + i)} سال'),
                ),
              );
            },
          ),
        ),
      ],
    ),
  );
}
