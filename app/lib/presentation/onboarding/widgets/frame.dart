import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/theme/theme.dart';
import '../../../core/format/digits.dart';
import '../../../core/motion/motion.dart';

/// Circular progress that eases to its value, with the percent in the middle.
class ProgressRing extends StatelessWidget {
  const ProgressRing({super.key, required this.value, this.size = 46});
  final double value;
  final double size;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: value),
    duration: Motion.slow,
    curve: Motion.curve,
    builder: (context, v, _) => SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(size: Size.square(size), painter: _RingPainter(v)),
          Text(
            '${fa((v * 100).round())}٪',
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: pine,
            ),
          ),
        ],
      ),
    ),
  );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.value);
  final double value;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final deflated = rect.deflate(3);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..color = const Color(0xFFDDE7CF);
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round
      ..shader = const SweepGradient(
        colors: [Color(0xFF7C9C58), pine],
        transform: GradientRotation(-math.pi / 2),
      ).createShader(rect);
    canvas.drawArc(deflated, 0, math.pi * 2, false, base);
    canvas.drawArc(deflated, -math.pi / 2, math.pi * 2 * value, false, arc);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.value != value;
}

/// The chrome around every step: back, group title, progress ring, content, primary action.
class OnboardingFrame extends StatelessWidget {
  const OnboardingFrame({
    super.key,
    required this.progress,
    required this.child,
    required this.stepKey,
    this.groupTitle,
    this.onBack,
    this.primaryLabel = 'ادامه',
    this.onPrimary,
    this.busy = false,
    this.syncHint,
    this.secondary,
    this.forward = true,
  });
  final double progress;
  final Widget child;
  final String stepKey;
  final String? groupTitle, syncHint;
  final VoidCallback? onBack, onPrimary;
  final String primaryLabel;
  final bool busy, forward;
  final Widget? secondary;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 20, 0),
            child: Row(
              children: [
                IconButton(
                  tooltip: 'قبلی',
                  onPressed: onBack,
                  icon: Icon(
                    Icons.arrow_forward_rounded,
                    color: onBack == null ? Colors.transparent : ink,
                  ),
                ),
                Expanded(
                  child: AnimatedSwitcher(
                    duration: Motion.base,
                    child: Text(
                      groupTitle ?? '',
                      key: ValueKey(groupTitle),
                      style: const TextStyle(
                        color: muted,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
                ProgressRing(value: progress),
              ],
            ),
          ),
          Expanded(
            child: AnimatedSwitcher(
              duration: Motion.page,
              switchInCurve: Motion.curve,
              switchOutCurve: Curves.easeIn,
              transitionBuilder: (child, animation) {
                final entering = child.key == ValueKey(stepKey);
                final from = Offset(forward ? -0.12 : 0.12, 0);
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween(
                      begin: entering ? from : -from,
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                );
              },
              child: KeyedSubtree(key: ValueKey(stepKey), child: child),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (syncHint != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      syncHint!,
                      style: const TextStyle(color: amber, fontSize: 11),
                    ),
                  ),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: busy ? null : onPrimary,
                    child: AnimatedSwitcher(
                      duration: Motion.quick,
                      child: busy
                          ? const SizedBox(
                              key: ValueKey('busy'),
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                color: Colors.white,
                              ),
                            )
                          : Text(primaryLabel, key: ValueKey(primaryLabel)),
                    ),
                  ),
                ),
                ?secondary,
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

/// Headline + helper line used at the top of a question.
class QuestionHeader extends StatelessWidget {
  const QuestionHeader({super.key, required this.title, this.subtitle});
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Reveal(
          child: Text(title, style: Theme.of(context).textTheme.headlineMedium),
        ),
        if (subtitle != null && subtitle!.isNotEmpty)
          Reveal(
            index: 1,
            child: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                subtitle!,
                style: const TextStyle(color: muted, fontSize: 13),
              ),
            ),
          ),
      ],
    ),
  );
}
