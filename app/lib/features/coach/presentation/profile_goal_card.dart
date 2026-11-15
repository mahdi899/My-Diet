import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import '../../../domain/common/digits.dart';
import '../../../domain/onboarding/questionnaire.dart';
import '../../../domain/plan/nutrition_source.dart';
import '../../../presentation/widgets/kit/app_card.dart';
import '../../plan/goal_math.dart';

class ProfileGoalCard extends StatelessWidget {
  const ProfileGoalCard({
    super.key,
    required this.source,
    required this.onEdit,
  });

  final NutritionSource source;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final goal = goalOf(source);
    final target = source.questionnaire.weightGoal ? goal.target : null;
    final start = QuestionnaireData.number(source.questionnaire.weight);
    final span = start == null || target == null ? null : target - start;
    final reached = target != null && (goal.current - target).abs() < .25;
    final progress = reached
        ? 1.0
        : span == null || span.abs() < .05
        ? 0.0
        : ((goal.current - start!) / span).clamp(0.0, 1.0);

    return AppCard(
      key: const ValueKey('profile-goal-card'),
      color: AppColors.emeraldDark,
      shadows: AppShadows.soft,
      radius: AppRadius.lg,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _GoalHeader(onEdit: onEdit),
          const SizedBox(height: 10),
          Text(
            goal.goal.trim().isEmpty ? 'هدفت را انتخاب کن' : goal.goal,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            target == null
                ? 'هر روز، یک قدم برای حال بهترت'
                : 'قدم‌به‌قدم تا وزن هدفت',
            style: TextStyle(
              color: Colors.white.withValues(alpha: .82),
              fontSize: 12,
              height: 1.7,
            ),
          ),
          const SizedBox(height: 20),
          if (target == null)
            _CurrentWeight(value: goal.current)
          else ...[
            _GoalWeightsPanel(current: goal.current, target: target),
            if ((span != null && span.abs() >= .05) || reached) ...[
              const SizedBox(height: 18),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'پیشرفت تا هدف',
                      style: TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ),
                  Text(
                    '${fa((progress * 100).round())}٪',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              LinearProgressIndicator(
                value: progress,
                minHeight: 9,
                borderRadius: BorderRadius.circular(8),
                backgroundColor: Colors.white.withValues(alpha: .18),
                color: AppColors.mint,
                semanticsLabel: 'پیشرفت به سمت وزن هدف',
                semanticsValue: '${(progress * 100).round()}%',
              ),
              const SizedBox(height: 16),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 12,
                runSpacing: 6,
                children: [
                  if (start != null)
                    Text(
                      'وزن شروع: ${kilos(start)} کیلو',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: .82),
                        fontSize: 11,
                      ),
                    ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.mint,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      progress >= 1
                          ? 'به وزن هدفت رسیدی'
                          : '${kilos((goal.current - target).abs())} کیلو تا هدف',
                      style: const TextStyle(
                        color: AppColors.emeraldDark,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _GoalHeader extends StatelessWidget {
  const _GoalHeader({required this.onEdit});
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final heading = Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.white.withValues(alpha: .35)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.flag_outlined, color: Colors.white, size: 20),
        ),
        const SizedBox(width: 10),
        const Expanded(
          child: Text(
            'هدف من',
            style: TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
    final edit = OutlinedButton.icon(
      onPressed: onEdit,
      icon: const Icon(Icons.edit_outlined, size: 16),
      label: const Text('ویرایش هدف'),
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.white,
        minimumSize: const Size(48, 44),
        side: const BorderSide(color: AppColors.mint),
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        textStyle: const TextStyle(
          fontFamily: 'Vazirmatn',
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
    if (MediaQuery.textScalerOf(context).scale(12) > 16) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [heading, const SizedBox(height: 8), edit],
      );
    }
    return Row(
      children: [
        Expanded(child: heading),
        edit,
      ],
    );
  }
}

class _GoalWeightsPanel extends StatelessWidget {
  const _GoalWeightsPanel({required this.current, required this.target});
  final double current, target;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
    decoration: BoxDecoration(
      color: AppColors.mint,
      borderRadius: BorderRadius.circular(AppRadius.sm),
    ),
    child: LayoutBuilder(
      builder: (context, constraints) {
        final vertical =
            constraints.maxWidth < 236 ||
            MediaQuery.textScalerOf(context).scale(12) > 16;
        final currentMetric = _WeightMetric(label: 'وزن فعلی', value: current);
        final targetMetric = _WeightMetric(label: 'وزن هدف', value: target);
        if (vertical) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              currentMetric,
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Icon(
                  Icons.arrow_downward_rounded,
                  size: 20,
                  color: AppColors.emeraldDark,
                ),
              ),
              targetMetric,
            ],
          );
        }
        return Row(
          children: [
            Expanded(child: currentMetric),
            SizedBox(
              width: 24,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 1,
                    height: 20,
                    color: AppColors.emeraldDeep.withValues(alpha: .25),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 6),
                    child: Icon(
                      Icons.arrow_back_rounded,
                      textDirection: TextDirection.ltr,
                      size: 20,
                      color: AppColors.emeraldDark,
                    ),
                  ),
                  Container(
                    width: 1,
                    height: 20,
                    color: AppColors.emeraldDeep.withValues(alpha: .25),
                  ),
                ],
              ),
            ),
            Expanded(child: targetMetric),
          ],
        );
      },
    ),
  );
}

class _CurrentWeight extends StatelessWidget {
  const _CurrentWeight({required this.value});
  final double value;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.mint,
      borderRadius: BorderRadius.circular(AppRadius.sm),
    ),
    child: LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 220 ||
            MediaQuery.textScalerOf(context).scale(12) > 16) {
          return _WeightMetric(label: 'وزن فعلی', value: value);
        }
        return Row(
          children: [
            const Icon(
              Icons.monitor_weight_outlined,
              color: AppColors.emeraldDark,
              size: 26,
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'وزن فعلی',
                style: TextStyle(color: AppColors.emeraldDark, fontSize: 13),
              ),
            ),
            const SizedBox(width: 8),
            Flexible(child: _WeightValue(value: value)),
          ],
        );
      },
    ),
  );
}

class _WeightMetric extends StatelessWidget {
  const _WeightMetric({required this.label, required this.value});
  final String label;
  final double value;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        label,
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.emeraldDark, fontSize: 13),
      ),
      const SizedBox(height: 8),
      _WeightValue(value: value),
    ],
  );
}

class _WeightValue extends StatelessWidget {
  const _WeightValue({required this.value});
  final double value;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        kilos(value),
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: AppColors.emeraldDark,
          fontSize: 40,
          fontWeight: FontWeight.w800,
          height: 1.15,
          fontFeatures: [FontFeature.tabularFigures()],
        ),
      ),
      const SizedBox(height: 6),
      const Text(
        'کیلوگرم',
        style: TextStyle(color: AppColors.emeraldDark, fontSize: 11),
      ),
    ],
  );
}
