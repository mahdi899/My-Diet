import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../../presentation/widgets/kit/app_card.dart';
import 'goal_math.dart';

/// Journey roadmap: phase nodes plus an animated projected-weight curve.
class JourneyMap extends StatefulWidget {
  const JourneyMap({super.key, required this.goal, required this.history});

  final GoalView goal;
  final List<double> history;

  @override
  State<JourneyMap> createState() => _JourneyMapState();
}

class _JourneyMapState extends State<JourneyMap>
    with SingleTickerProviderStateMixin {
  late final AnimationController _draw = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (Motion.reduced(context)) {
        _draw.value = 1;
      } else {
        _draw.forward();
      }
    });
  }

  @override
  void dispose() {
    _draw.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final goal = widget.goal;
    final history = widget.history.isEmpty ? [goal.current] : widget.history;
    final future = goal.project && goal.target != null
        ? projectSeries(goal.current, goal.target!, journeyWeeks(goal.etaDays))
        : const <double>[];
    final eta = etaLabel(goal.etaDays);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('مسیر', style: Theme.of(context).textTheme.titleLarge),
          if (eta.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              eta,
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ],
          if (goal.project) ...[
            const SizedBox(height: 14),
            PhaseNodes(progress: goal.progress),
          ],
          const SizedBox(height: 8),
          SizedBox(
            height: 150,
            child: AnimatedBuilder(
              animation: _draw,
              builder: (context, _) => CustomPaint(
                painter: WeightCurvePainter(
                  history: history,
                  future: future,
                  t: _draw.value,
                ),
                child: const SizedBox.expand(),
              ),
            ),
          ),
          if (goal.target != null)
            Text(
              '${kilos(goal.current)} به ${kilos(goal.target!)}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
        ],
      ),
    );
  }
}

class PhaseNodes extends StatelessWidget {
  const PhaseNodes({super.key, required this.progress});

  final double progress;
  static const labels = ['شروع', 'عادت', 'شتاب', 'هدف'];

  @override
  Widget build(BuildContext context) {
    final active = (progress * (labels.length - 1)).round().clamp(0, 3);
    return SizedBox(
      height: 52,
      child: Stack(
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(22, 8, 22, 0),
            child: SizedBox(
              height: 2,
              child: ColoredBox(color: AppColors.line),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < labels.length; i++)
                Expanded(
                  child: Column(
                    children: [
                      Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: i <= active
                              ? AppColors.emerald
                              : AppColors.surface,
                          border: Border.all(
                            color: i == active
                                ? AppColors.lime
                                : (i < active
                                      ? AppColors.emerald
                                      : AppColors.line),
                            width: i == active ? 4 : 2,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        labels[i],
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          height: 1.2,
                          fontWeight: i == active
                              ? FontWeight.bold
                              : FontWeight.w500,
                          color: i == active
                              ? AppColors.emeraldDark
                              : AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Draws recorded weights, then traces the projected curve as [t] goes 0→1.
class WeightCurvePainter extends CustomPainter {
  WeightCurvePainter({
    required List<double> history,
    required List<double> future,
    required this.t,
  }) : history = List<double>.from(history),
       future = List<double>.from(future),
       signature = '${history.join(',')}|${future.join(',')}';

  final List<double> history;
  final List<double> future;
  final double t;
  final String signature;

  @override
  void paint(Canvas canvas, Size size) {
    final series = <double>[
      ...history,
      if (future.length > 1) ...future.skip(1),
    ];
    if (series.isEmpty) return;
    final low = series.reduce(math.min);
    final high = series.reduce(math.max);
    final span = (high - low).abs() < 0.2 ? 1.0 : high - low;
    final bottom = low - span * 0.28;
    final top = high + span * 0.28;
    final n = math.max(1, series.length - 1);

    Offset at(int index, double weight) {
      final x = 8 + (size.width - 16) * (index / n);
      final y =
          12 + (size.height - 24) * (1 - (weight - bottom) / (top - bottom));
      return Offset(x, y);
    }

    final today = at(history.length - 1, history.last);
    if (history.length > 1) {
      _stroke(canvas, _path(history, at), AppColors.emerald, 3);
    }
    if (future.length > 1) {
      final path = _pathFrom(
        today,
        future.skip(1).toList(),
        history.length - 1,
        at,
      );
      _stroke(canvas, path, AppColors.emerald.withValues(alpha: 0.18), 3);
      final metrics = path.computeMetrics().toList();
      if (metrics.isNotEmpty) {
        final metric = metrics.first;
        final partial = metric.extractPath(0, metric.length * t.clamp(0, 1));
        _stroke(canvas, partial, AppColors.emerald, 3);
        final tip = metric.getTangentForOffset(metric.length * t.clamp(0, 1));
        if (tip != null) {
          canvas.drawCircle(tip.position, 3.2, Paint()..color = AppColors.lime);
        }
      }
    }
    canvas.drawCircle(today, 7, Paint()..color = Colors.white);
    canvas.drawCircle(today, 4.5, Paint()..color = AppColors.amber);
  }

  Path _path(List<double> weights, Offset Function(int, double) at) {
    final path = Path()
      ..moveTo(at(0, weights.first).dx, at(0, weights.first).dy);
    for (var i = 1; i < weights.length; i++) {
      final point = at(i, weights[i]);
      path.lineTo(point.dx, point.dy);
    }
    return path;
  }

  Path _pathFrom(
    Offset start,
    List<double> weights,
    int startIndex,
    Offset Function(int, double) at,
  ) {
    final path = Path()..moveTo(start.dx, start.dy);
    for (var i = 0; i < weights.length; i++) {
      final point = at(startIndex + 1 + i, weights[i]);
      path.lineTo(point.dx, point.dy);
    }
    return path;
  }

  void _stroke(Canvas canvas, Path path, Color color, double width) {
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = width
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(WeightCurvePainter oldDelegate) =>
      oldDelegate.t != t || oldDelegate.signature != signature;
}
