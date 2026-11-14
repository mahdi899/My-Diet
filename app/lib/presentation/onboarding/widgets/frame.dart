import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../../../core/theme/theme.dart';
import '../../../core/format/digits.dart';
import '../../../core/motion/motion.dart';
import '../../widgets/kit/pill_button.dart';
import 'blur_ink.dart';
import 'camera_progress.dart';

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
              color: AppColors.emeraldDeep,
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
      ..color = AppColors.mint;
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round
      ..shader = const SweepGradient(
        colors: [AppColors.lime, AppColors.emerald],
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
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final hasCamera = topCameraBounds(media) != null;
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AppGradients.warmBackground),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        resizeToAvoidBottomInset: true,
        body: Stack(
          children: [
            CameraProgressRing(progress: progress),
            SafeArea(
          child: Column(
            children: [
              if (!hasCamera)
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 10, 24, 0),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      value: progress.clamp(0, 1),
                      minHeight: 5,
                      backgroundColor: AppColors.mint,
                      color: AppColors.emerald,
                    ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 20, 0),
                child: Row(
                  children: [
                    _CircleBack(onPressed: onBack),
                    Expanded(
                      child: BlurSwap(
                        text: groupTitle ?? '',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    const SizedBox(width: 44),
                  ],
                ),
              ),
              Expanded(child: child),
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
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppColors.danger,
                            fontSize: 12.5,
                            height: 1.6,
                          ),
                        ),
                      ),
                    PillButton(
                      label: primaryLabel,
                      onPressed: busy ? null : onPrimary,
                      loading: busy,
                    ),
                    ?secondary,
                  ],
                ),
              ),
            ],
          ),
        ),
          ],
        ),
      ),
    );
  }
}

class _CircleBack extends StatelessWidget {
  const _CircleBack({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onPressed == null ? 0 : 1,
      child: Material(
        color: Colors.white,
        shape: const CircleBorder(),
        elevation: 0,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: const SizedBox(
            width: 44,
            height: 44,
            child: Icon(Icons.arrow_forward_rounded, color: AppColors.ink),
          ),
        ),
      ),
    );
  }
}

/// Headline + helper line used at the top of a question.
class QuestionHeader extends StatelessWidget {
  const QuestionHeader({super.key, required this.title, this.subtitle});
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(28, 8, 28, 18),
    child: Column(
      children: [
        BlurSwap(
          text: title,
          style: Theme.of(context).textTheme.headlineMedium!,
        ),
        if (subtitle != null && subtitle!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: BlurSwap(
              text: subtitle!,
              style: const TextStyle(color: muted, fontSize: 13, height: 1.7),
            ),
          ),
      ],
    ),
  );
}
