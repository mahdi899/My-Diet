import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'onboarding_icons.dart';
import '../../../core/theme/theme.dart';
import '../../../core/format/digits.dart';
import '../../../core/motion/motion.dart';

/// A conventional twelve-hour clock face; values and callbacks use 0–23 hours.
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

enum _Handle { sleep, wake }

double _clockAngle(int hour) => hour % 12 / 12 * 2 * math.pi - math.pi / 2;
Offset _clockPoint(Offset center, double radius, double angle) =>
    center + Offset(math.cos(angle), math.sin(angle)) * radius;
String _clockTime(int hour) =>
    '${fa((hour % 12 == 0 ? 12 : hour % 12).toString().padLeft(2, '0'))}:۰۰';
String _fullTime(int hour) => '${fa(hour.toString().padLeft(2, '0'))}:۰۰';

class _SleepWakeDialState extends State<SleepWakeDial> {
  _Handle _active = _Handle.sleep;
  _Handle? _dragging;
  Offset? _pointerDown;
  int? _dragHour;

  int _hourAt(Offset local, Size size) {
    final offset = local - size.center(Offset.zero);
    final angle = math.atan2(offset.dy, offset.dx) + math.pi / 2;
    return ((angle / (2 * math.pi) * 12).round() % 12 + 12) % 12;
  }

  void _start(Offset local, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.width / 2 - 20;
    final sleepDistance =
        (local - _clockPoint(center, radius, _clockAngle(widget.sleep)))
            .distance;
    final wakeDistance =
        (local - _clockPoint(center, radius, _clockAngle(widget.wake)))
            .distance;
    final selected = (sleepDistance - wakeDistance).abs() < 8
        ? _active
        : sleepDistance < wakeDistance
        ? _Handle.sleep
        : _Handle.wake;
    setState(() {
      _active = selected;
      _dragging = selected;
      _dragHour = selected == _Handle.sleep ? widget.sleep : widget.wake;
    });
    _move(local, size);
  }

  void _move(Offset local, Size size) {
    final handle = _dragging;
    final current = _dragHour;
    if (handle == null || current == null) return;
    // Follow the shortest movement on the face, carrying AM/PM through 12.
    // Thus 23 -> 00 and 11 -> 12 behave like turning an actual clock hand.
    var delta = (_hourAt(local, size) - current % 12 + 18) % 12 - 6;
    if (delta == -6) delta = 6;
    final next = (current + delta + 24) % 24;
    if (next == current) return;
    _dragHour = next;
    Haptics.tap();
    _changed(handle, next);
  }

  void _stop() {
    if (_dragging != null) setState(() => _dragging = null);
    _dragHour = null;
    _pointerDown = null;
  }

  void _changed(_Handle handle, int hour) {
    if (_active != handle) setState(() => _active = handle);
    widget.onChanged(
      handle == _Handle.sleep ? hour : widget.sleep,
      handle == _Handle.wake ? hour : widget.wake,
    );
  }

  int get _hours => (widget.wake - widget.sleep + 24) % 24;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      LayoutBuilder(
        builder: (context, constraints) {
          final side = math.min(constraints.maxWidth - 32, 340.0);
          final size = Size.square(side);
          return Semantics(
            label: 'ساعت انتخاب خواب و بیداری، صفحهٔ ۱۲ ساعته',
            value:
                'خواب ${_fullTime(widget.sleep)}، بیداری ${_fullTime(widget.wake)}، ${fa(_hours)} ساعت خواب',
            child: SizedBox.square(
              key: const ValueKey('sleep-clock'),
              dimension: side,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onPanDown: (details) => _pointerDown = details.localPosition,
                onPanStart: (details) =>
                    _start(_pointerDown ?? details.localPosition, size),
                onPanUpdate: (details) => _move(details.localPosition, size),
                onPanEnd: (_) => _stop(),
                onPanCancel: _stop,
                onTapUp: (details) {
                  _start(details.localPosition, size);
                  _stop();
                },
                child: CustomPaint(
                  painter: _ClockPainter(
                    widget.sleep,
                    widget.wake,
                    _active,
                    _dragging,
                  ),
                  child: Center(
                    child: SizedBox(
                      width: side * .46,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            fa(_hours),
                            style: const TextStyle(
                              fontSize: 42,
                              height: 1.1,
                              fontWeight: FontWeight.w800,
                              color: AppColors.emeraldDeep,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'ساعت خواب',
                            style: TextStyle(color: muted, fontSize: 12),
                          ),
                          const SizedBox(height: 8),
                          Directionality(
                            textDirection: TextDirection.ltr,
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                '${_fullTime(widget.sleep)} – ${_fullTime(widget.wake)}',
                                style: const TextStyle(
                                  color: AppColors.inkSoft,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
      const SizedBox(height: 16),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: _TimeCard(
              key: const ValueKey('sleep-time-card'),
              id: 'sleep',
              kind: DietIconKind.moon,
              label: 'خواب',
              hour: widget.sleep,
              active: _active == _Handle.sleep,
              onSelect: () => setState(() => _active = _Handle.sleep),
              onChanged: (hour) => _changed(_Handle.sleep, hour),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _TimeCard(
              key: const ValueKey('wake-time-card'),
              id: 'wake',
              kind: DietIconKind.sun,
              label: 'بیداری',
              hour: widget.wake,
              active: _active == _Handle.wake,
              onSelect: () => setState(() => _active = _Handle.wake),
              onChanged: (hour) => _changed(_Handle.wake, hour),
            ),
          ),
        ],
      ),
      const SizedBox(height: 10),
      const Padding(
        padding: EdgeInsets.symmetric(horizontal: 20),
        child: Text(
          'ماه و خورشید را روی ساعت جابه‌جا کن',
          textAlign: TextAlign.center,
          style: TextStyle(color: muted, fontSize: 12),
        ),
      ),
    ],
  );
}

class _TimeCard extends StatelessWidget {
  const _TimeCard({
    super.key,
    required this.id,
    required this.kind,
    required this.label,
    required this.hour,
    required this.active,
    required this.onSelect,
    required this.onChanged,
  });
  final String id, label;
  final DietIconKind kind;
  final int hour;
  final bool active;
  final VoidCallback onSelect;
  final ValueChanged<int> onChanged;

  Widget _period(bool morning) => ChoiceChip(
    key: ValueKey('$id-period-${morning ? 'am' : 'pm'}'),
    label: Text(
      morning ? 'قبل از ظهر' : 'بعد از ظهر',
      style: const TextStyle(fontSize: 10.5),
    ),
    selected: morning == (hour < 12),
    showCheckmark: false,
    padding: const EdgeInsets.symmetric(horizontal: 2),
    labelPadding: const EdgeInsets.symmetric(horizontal: 3),
    selectedColor: AppColors.mint,
    side: BorderSide(
      color: morning == (hour < 12) ? AppColors.selectedLine : AppColors.line,
    ),
    onSelected: (_) {
      Haptics.tap();
      onChanged(hour % 12 + (morning ? 0 : 12));
    },
  );

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(20),
      side: BorderSide(color: active ? AppColors.selectedLine : AppColors.line),
    ),
    child: InkWell(
      onTap: onSelect,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                DietIcon(kind, size: 20),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                SizedBox.square(
                  dimension: 40,
                  child: IconButton(
                    tooltip: '$label، یک ساعت بعد',
                    onPressed: () {
                      Haptics.tap();
                      onChanged((hour + 1) % 24);
                    },
                    padding: EdgeInsets.zero,
                    icon: const DietIcon(DietIconKind.plus, size: 18),
                  ),
                ),
                Expanded(
                  child: Directionality(
                    textDirection: TextDirection.ltr,
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        _clockTime(hour),
                        style: const TextStyle(
                          fontSize: 23,
                          fontWeight: FontWeight.w800,
                          color: AppColors.ink,
                        ),
                      ),
                    ),
                  ),
                ),
                SizedBox.square(
                  dimension: 40,
                  child: IconButton(
                    tooltip: '$label، یک ساعت قبل',
                    onPressed: () {
                      Haptics.tap();
                      onChanged((hour + 23) % 24);
                    },
                    padding: EdgeInsets.zero,
                    icon: const DietIcon(DietIconKind.minus, size: 18),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 4,
              runSpacing: 4,
              children: [_period(true), _period(false)],
            ),
          ],
        ),
      ),
    ),
  );
}

class _ClockPainter extends CustomPainter {
  _ClockPainter(this.sleep, this.wake, this.active, this.dragging);
  final int sleep, wake;
  final _Handle active;
  final _Handle? dragging;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.width / 2 - 20;
    final faceRadius = radius - 13;
    canvas.drawCircle(center, faceRadius, Paint()..color = Colors.white);
    canvas.drawCircle(
      center,
      faceRadius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = AppColors.mint,
    );
    final track = Rect.fromCircle(center: center, radius: radius);
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 13
        ..color = AppColors.mint,
    );
    final duration = (wake - sleep + 24) % 24;
    if (duration > 0) {
      canvas.drawArc(
        track,
        _clockAngle(sleep),
        math.min(duration, 12) / 12 * 2 * math.pi,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 13
          ..strokeCap = StrokeCap.round
          ..color = AppColors.emerald,
      );
      if (duration > 12) {
        canvas.drawArc(
          Rect.fromCircle(center: center, radius: radius + 10),
          _clockAngle(sleep),
          (duration - 12) / 12 * 2 * math.pi,
          false,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 3
            ..strokeCap = StrokeCap.round
            ..color = AppColors.emeraldDeep,
        );
      }
    }
    // Clockwise clock marks are independent of the surrounding RTL layout.
    for (var tick = 0; tick < 60; tick++) {
      final major = tick % 5 == 0;
      final angle = tick / 60 * 2 * math.pi - math.pi / 2;
      canvas.drawLine(
        _clockPoint(center, radius - 21, angle),
        _clockPoint(center, radius - (major ? 31 : 25), angle),
        Paint()
          ..color = major ? AppColors.inkSoft : AppColors.selectedLine
          ..strokeWidth = major ? 2 : 1
          ..strokeCap = StrokeCap.round,
      );
    }
    final label = TextPainter(textDirection: TextDirection.ltr);
    for (var hour = 1; hour <= 12; hour++) {
      label.text = TextSpan(
        text: fa(hour),
        style: TextStyle(
          fontFamily: 'Vazirmatn',
          fontSize: size.width < 310 ? 13 : 15,
          fontWeight: hour % 3 == 0 ? FontWeight.w800 : FontWeight.w500,
          color: hour % 3 == 0 ? AppColors.ink : AppColors.muted,
        ),
      );
      label.layout();
      final at = _clockPoint(center, radius - 45, _clockAngle(hour));
      label.paint(canvas, at - Offset(label.width / 2, label.height / 2));
    }
    // Draw the active handle last so coincident times remain selectable.
    for (final handle in _Handle.values.where((h) => h != active).followedBy([
      active,
    ])) {
      final hour = handle == _Handle.sleep ? sleep : wake;
      _knob(
        canvas,
        _clockPoint(center, radius, _clockAngle(hour)),
        handle == _Handle.sleep ? DietIconKind.moon : DietIconKind.sun,
        handle == active,
        handle == dragging,
      );
    }
  }

  void _knob(
    Canvas canvas,
    Offset at,
    DietIconKind kind,
    bool selected,
    bool pressed,
  ) {
    canvas.drawCircle(
      at,
      18,
      Paint()..color = selected ? AppColors.mint : Colors.white,
    );
    canvas.drawCircle(
      at,
      18,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = pressed ? 3 : 2
        ..color = AppColors.emeraldDeep,
    );
    paintDietIcon(
      canvas,
      Rect.fromCenter(center: at, width: 22, height: 22),
      kind,
    );
  }

  @override
  bool shouldRepaint(_ClockPainter old) =>
      old.sleep != sleep ||
      old.wake != wake ||
      old.active != active ||
      old.dragging != dragging;
}
