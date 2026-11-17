import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';

enum CompanionMood { calm, greeting, thinking, reply, support, celebrate }

/// An original, drawn-in-Flutter brand companion. Every reaction has an end;
/// there is no idle loop or asset download, and reduced motion is respected.
class CoachCompanion extends StatefulWidget {
  const CoachCompanion({
    super.key,
    this.mood = CompanionMood.calm,
    this.size = 88,
    this.cue = 0,
  });
  final CompanionMood mood;
  final double size;
  final int cue;
  @override
  State<CoachCompanion> createState() => _CoachCompanionState();
}

class _CoachCompanionState extends State<CoachCompanion>
    with SingleTickerProviderStateMixin {
  late final AnimationController _reaction = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
    value: 1,
  );

  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context) || !TickerMode.valuesOf(context).enabled) {
      _reaction.stop();
      _reaction.value = 1;
    } else if (!_initialized && widget.mood != CompanionMood.calm) {
      _reaction.forward(from: 0);
    }
    _initialized = true;
  }

  @override
  void didUpdateWidget(CoachCompanion oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.mood != widget.mood || oldWidget.cue != widget.cue) {
      if (!Motion.reduced(context) && TickerMode.valuesOf(context).enabled) {
        _reaction.forward(from: 0);
      } else {
        _reaction.stop();
        _reaction.value = 1;
      }
    }
  }

  @override
  void dispose() {
    _reaction.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    image: true,
    label: switch (widget.mood) {
      CompanionMood.calm => 'جوانه، همراه رژیم من',
      CompanionMood.greeting => 'جوانه سلام می‌کند',
      CompanionMood.thinking => 'جوانه در حال پاسخ‌دادن',
      CompanionMood.reply => 'جوانه؛ پاسخ آماده است',
      CompanionMood.support => 'جوانه در کنارت است',
      CompanionMood.celebrate => 'جوانه؛ ثبت موفق',
    },
    child: RepaintBoundary(
      child: SizedBox.square(
        dimension: widget.size,
        child: CustomPaint(painter: _SproutPainter(widget.mood, _reaction)),
      ),
    ),
  );
}

/// Animated leaves, expression and pot are painted directly at display size.
/// Each cue is a single 1.2 second reaction, with no idle or waiting loop.
class _SproutPainter extends CustomPainter {
  _SproutPainter(this.mood, this.reaction) : super(repaint: reaction);
  final CompanionMood mood;
  final Animation<double> reaction;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 120, size.height / 120);
    final p = reaction.value;
    final pulse = math.sin(p * math.pi);
    final sway = math.sin(p * math.pi * 4) * (1 - p);
    final happy = mood == CompanionMood.celebrate;
    final greeting = mood == CompanionMood.greeting;
    final thinking = mood == CompanionMood.thinking;
    final support = mood == CompanionMood.support;
    final reply = mood == CompanionMood.reply;
    final fill = Paint()..isAntiAlias = true;
    final line = Paint()
      ..isAntiAlias = true
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawCircle(const Offset(60, 60), 54, fill..color = AppColors.mint);
    canvas.drawCircle(
      const Offset(43, 34),
      29,
      fill..color = const Color(0x45FFFFFF),
    );
    canvas.drawOval(
      Rect.fromCenter(
        center: const Offset(60, 106),
        width: happy ? 37 - pulse * 8 : 37,
        height: 5,
      ),
      fill..color = const Color(0x140A5C42),
    );
    canvas.save();
    final hop = happy ? math.sin(p * math.pi * 2).abs() * (1 - p) * 12 : 0.0;
    canvas.translate(0, -hop);
    canvas.translate(60, 83);
    canvas.rotate(
      thinking
          ? -.065 + sway * .035
          : greeting
          ? sway * .06
          : support
          ? -.04
          : sway * .025,
    );
    canvas.scale(
      1 + (reply ? pulse * .025 : 0),
      1 - (reply ? pulse * .035 : 0),
    );
    canvas.translate(-60, -83);

    // The stem and two asymmetric leaves make up the brand silhouette.
    canvas.drawPath(
      Path()
        ..moveTo(59, 75)
        ..cubicTo(57, 58, 62, 40, 66, 28),
      line
        ..color = AppColors.emeraldDark
        ..strokeWidth = 3.7,
    );
    canvas.save();
    canvas.translate(59, 56);
    canvas.rotate(sway * (happy ? .14 : .055));
    canvas.translate(-59, -56);
    canvas.drawPath(
      Path()
        ..moveTo(59, 56)
        ..cubicTo(35, 58, 26, 40, 31, 25)
        ..cubicTo(51, 25, 64, 39, 59, 56)
        ..close(),
      fill..color = AppColors.emeraldDeep,
    );
    canvas.drawPath(
      Path()
        ..moveTo(37, 33)
        ..quadraticBezierTo(43, 46, 56, 52),
      line
        ..color = const Color(0x88B7E8CF)
        ..strokeWidth = 1.4,
    );
    canvas.restore();
    canvas.save();
    canvas.translate(63, 45);
    canvas.rotate(
      greeting
          ? sway * .32
          : thinking
          ? sway * .10
          : happy
          ? sway * .18
          : 0,
    );
    canvas.translate(-63, -45);
    canvas.drawPath(
      Path()
        ..moveTo(63, 45)
        ..cubicTo(59, 24, 77, 13, 96, 20)
        ..cubicTo(97, 38, 79, 51, 63, 45)
        ..close(),
      fill..color = AppColors.emerald,
    );
    canvas.drawPath(
      Path()
        ..moveTo(68, 41)
        ..quadraticBezierTo(78, 33, 89, 24),
      line
        ..color = const Color(0xB8D6F3B6)
        ..strokeWidth = 1.7,
    );
    canvas.restore();

    // Soft ceramic pot, with its own face and tiny cheek marks.
    canvas.drawPath(
      Path()
        ..moveTo(34, 72)
        ..lineTo(86, 72)
        ..lineTo(82, 93)
        ..quadraticBezierTo(79, 106, 60, 106)
        ..quadraticBezierTo(41, 106, 38, 93)
        ..close(),
      fill..color = const Color(0xFFFEFBF0),
    );
    canvas.drawPath(
      Path()
        ..moveTo(76, 77)
        ..lineTo(73, 94)
        ..quadraticBezierTo(71, 100, 65, 102),
      line
        ..color = const Color(0xFFF0E9D7)
        ..strokeWidth = 3,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(31, 65, 58, 13),
        const Radius.circular(6),
      ),
      fill..color = AppColors.emeraldDark,
    );
    canvas.drawLine(
      const Offset(37, 68),
      const Offset(73, 68),
      line
        ..color = const Color(0x557DCEAB)
        ..strokeWidth = 2,
    );
    canvas.drawOval(
      const Rect.fromLTWH(40, 91, 8, 4),
      fill..color = const Color(0xFFEFCDB3),
    );
    canvas.drawOval(const Rect.fromLTWH(72, 91, 8, 4), fill);
    line
      ..color = AppColors.emeraldDark
      ..strokeWidth = 2.3;
    final blink = (greeting || reply) && p > .34 && p < .51;
    if (happy || blink || support) {
      canvas.drawPath(
        Path()
          ..moveTo(46, 87)
          ..quadraticBezierTo(49, happy ? 82 : 85, 52, 87)
          ..moveTo(68, 87)
          ..quadraticBezierTo(71, happy ? 82 : 85, 74, 87),
        line,
      );
    } else {
      final gaze = thinking ? -2.0 : 0.0;
      canvas.drawOval(
        Rect.fromLTWH(47 + gaze, 83, 4.4, 6),
        fill..color = AppColors.emeraldDark,
      );
      canvas.drawOval(Rect.fromLTWH(69 + gaze, 83, 4.4, 6), fill);
    }
    if (thinking) {
      canvas.drawOval(
        const Rect.fromLTWH(57, 93, 5, 4),
        line..strokeWidth = 1.8,
      );
    } else if (happy) {
      canvas.drawPath(
        Path()
          ..moveTo(53, 93)
          ..quadraticBezierTo(60, 104, 67, 93)
          ..close(),
        fill..color = AppColors.emeraldDark,
      );
      canvas.drawOval(
        const Rect.fromLTWH(57, 97, 7, 3),
        fill..color = const Color(0xFFE5B59E),
      );
    } else {
      canvas.drawPath(
        Path()
          ..moveTo(55, 94)
          ..quadraticBezierTo(60, support ? 97 : 100, 65, 94),
        line..strokeWidth = 2.3,
      );
    }
    canvas.restore();

    if (happy) {
      _spark(
        canvas,
        Offset(21 - pulse * 2, 48 - pulse * 5),
        5 + pulse * 2,
        AppColors.amber,
      );
      _spark(
        canvas,
        Offset(99 + pulse * 2, 65 - pulse * 3),
        4 + pulse * 2,
        AppColors.emerald,
      );
      canvas.drawCircle(
        Offset(100, 36 - pulse * 4),
        3,
        fill..color = AppColors.lime,
      );
    } else if (support) {
      canvas.drawPath(
        Path()
          ..moveTo(98, 68)
          ..cubicTo(85, 58, 90, 51, 98, 57)
          ..cubicTo(106, 51, 111, 58, 98, 68)
          ..close(),
        fill..color = AppColors.emerald,
      );
    } else if (thinking) {
      for (var i = 0; i < 3; i++) {
        canvas.drawCircle(
          Offset(86 + i * 9.0, 51 - (i == 1 ? 4 : 0)),
          2 + (1 - p) * math.sin(p * math.pi * 3 + i).abs(),
          fill..color = AppColors.emeraldDeep.withValues(alpha: .45 + i * .2),
        );
      }
    } else {
      _spark(canvas, const Offset(101, 42), greeting ? 5 : 3.5, AppColors.lime);
      canvas.drawCircle(
        const Offset(22, 77),
        2.5,
        fill..color = AppColors.amber,
      );
    }
    canvas.restore();
  }

  void _spark(Canvas canvas, Offset c, double radius, Color color) {
    canvas.drawPath(
      Path()
        ..moveTo(c.dx, c.dy - radius)
        ..quadraticBezierTo(c.dx + 1, c.dy - 1, c.dx + radius, c.dy)
        ..quadraticBezierTo(c.dx + 1, c.dy + 1, c.dx, c.dy + radius)
        ..quadraticBezierTo(c.dx - 1, c.dy + 1, c.dx - radius, c.dy)
        ..quadraticBezierTo(c.dx - 1, c.dy - 1, c.dx, c.dy - radius)
        ..close(),
      Paint()
        ..color = color
        ..isAntiAlias = true,
    );
  }

  @override
  bool shouldRepaint(_SproutPainter oldDelegate) =>
      oldDelegate.mood != mood || oldDelegate.reaction != reaction;
}

class CoachCompanionNote extends StatelessWidget {
  const CoachCompanionNote({
    super.key,
    required this.typing,
    required this.celebrated,
    this.cue = 0,
    this.mood,
  });
  final CompanionMood? mood;
  final bool typing, celebrated;
  final int cue;

  @override
  Widget build(BuildContext context) {
    final mood =
        this.mood ??
        (typing
            ? CompanionMood.thinking
            : celebrated
            ? CompanionMood.celebrate
            : CompanionMood.calm);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 6, 20, 6),
      child: Row(
        children: [
          CoachCompanion(mood: mood, size: 76, cue: cue),
          const SizedBox(width: 10),
          Expanded(
            child: AnimatedSwitcher(
              duration: Motion.of(context, Motion.quick),
              child: Column(
                key: ValueKey(mood),
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    switch (mood) {
                      CompanionMood.greeting ||
                      CompanionMood.calm => 'قدم بعدی را با هم برداریم',
                      CompanionMood.thinking => 'دارم به حرفت فکر می‌کنم…',
                      CompanionMood.celebrate => 'یک قدم دیگر برای خودت',
                      CompanionMood.support => 'با هم ادامه می‌دیم',
                      CompanionMood.reply => 'جوابت آماده است',
                    },
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.emeraldDark,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    switch (mood) {
                      CompanionMood.greeting || CompanionMood.calm =>
                        'از وعده‌ها، سلیقه‌ات یا حال امروزت بگو.',
                      CompanionMood.thinking =>
                        'پاسخ همین‌جا نمایش داده می‌شود.',
                      CompanionMood.celebrate =>
                        'ثبتت انجام شد؛ آفرین به پیگیریت.',
                      CompanionMood.support =>
                        'هر وقت آماده بودی، از همین‌جا ادامه بده.',
                      CompanionMood.reply =>
                        'می‌تونی گفتگو را از همین‌جا ادامه بدی.',
                    },
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.inkSoft,
                      height: 1.7,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
