import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';

enum CompanionMood { calm, greeting, thinking, reply, support, celebrate }

/// A bundled coach portrait with a brief reaction for each conversational cue.
/// There is no idle loop, and reduced motion is respected.
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
      CompanionMood.calm => 'مربی رژیم من',
      CompanionMood.greeting => 'مربی سلام می‌کند',
      CompanionMood.thinking => 'مربی در حال پاسخ‌دادن',
      CompanionMood.reply => 'مربی؛ پاسخ آماده است',
      CompanionMood.support => 'مربی در کنارت است',
      CompanionMood.celebrate => 'مربی؛ ثبت موفق',
    },
    child: RepaintBoundary(
      child: SizedBox.square(
        dimension: widget.size,
        child: AnimatedBuilder(
          animation: _reaction,
          child: DecoratedBox(
            decoration: const BoxDecoration(
              color: AppColors.mint,
              shape: BoxShape.circle,
            ),
            child: Padding(
              padding: const EdgeInsets.all(2),
              child: ClipOval(
                child: Image.asset(
                  'assets/photo/expert/nutritionist_posing_in_clinic.jpg',
                  width: widget.size,
                  height: widget.size,
                  fit: BoxFit.cover,
                  alignment: const Alignment(0, -.65),
                  excludeFromSemantics: true,
                ),
              ),
            ),
          ),
          builder: (context, child) => Transform.scale(
            scale: 1 + math.sin(_reaction.value * math.pi) * .025,
            child: child,
          ),
        ),
      ),
    ),
  );
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
