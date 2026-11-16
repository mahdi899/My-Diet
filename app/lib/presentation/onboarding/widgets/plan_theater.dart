import 'dart:async';

import 'package:flutter/material.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';
import '../../../features/coach/presentation/coach_companion.dart';

/// A finite brand reaction while the caller owns the actual operation.
/// onFinished is only used to reveal an already-computed profile summary.
class PlanBuildTheater extends StatefulWidget {
  const PlanBuildTheater({
    super.key,
    this.title = 'در حال ثبت پاسخ‌ها',
    this.message =
        'پاسخ‌هایت را ثبت می‌کنیم تا آماده‌سازی برنامه و بررسی متخصص ادامه پیدا کند.',
    this.duration = const Duration(milliseconds: 3200),
    this.onFinished,
  });
  final String title, message;
  final Duration duration;
  final VoidCallback? onFinished;
  @override
  State<PlanBuildTheater> createState() => _PlanBuildTheaterState();
}

class _PlanBuildTheaterState extends State<PlanBuildTheater> {
  Timer? _reveal;
  bool _started = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (widget.onFinished == null) return;
    if (Motion.reduced(context)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onFinished?.call();
      });
    } else {
      _reveal = Timer(widget.duration, () {
        if (mounted) widget.onFinished?.call();
      });
    }
  }

  @override
  void dispose() {
    _reveal?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) => SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: (constraints.maxHeight - 56).clamp(0, double.infinity),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CoachCompanion(mood: CompanionMood.thinking, size: 150),
            const SizedBox(height: 28),
            Semantics(
              header: true,
              liveRegion: true,
              child: Text(
                widget.title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: AppColors.emeraldDark,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              widget.message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                height: 1.9,
                color: AppColors.inkSoft,
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.mint,
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Text(
                'برنامهٔ غذایی پس از تأیید متخصص منتشر می‌شود.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.emeraldDark,
                  fontSize: 12,
                  height: 1.7,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
