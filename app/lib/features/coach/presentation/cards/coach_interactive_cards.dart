import 'package:flutter/material.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/format/digits.dart';

/// کارت پیشرفت روزانه با نمایش زنده
class DailyProgressCard extends StatelessWidget {
  const DailyProgressCard({
    super.key,
    required this.eaten,
    required this.goal,
    required this.waterGlasses,
    required this.waterGoal,
    required this.mealsLogged,
    required this.totalMeals,
  });

  final int eaten;
  final int goal;
  final int waterGlasses;
  final int waterGoal;
  final int mealsLogged;
  final int totalMeals;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFE8F5E8), Color(0xFFF0F9F0)],
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.emeraldDeep.withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.today_rounded, color: AppColors.emeraldDeep),
              const SizedBox(width: 8),
              const Text(
                'پیشرفت امروز',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.emeraldDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _ProgressRow(
            icon: Icons.restaurant_rounded,
            label: 'کالری',
            current: fa(eaten),
            target: fa(goal),
            percent: goal > 0 ? eaten / goal : 0,
            color: AppColors.emeraldDeep,
          ),
          const SizedBox(height: 12),
          _ProgressRow(
            icon: Icons.water_drop_rounded,
            label: 'آب',
            current: fa(waterGlasses),
            target: fa(waterGoal),
            percent: waterGoal > 0 ? waterGlasses / waterGoal : 0,
            color: AppColors.sky,
          ),
          const SizedBox(height: 12),
          _ProgressRow(
            icon: Icons.check_circle_rounded,
            label: 'وعده‌ها',
            current: fa(mealsLogged),
            target: fa(totalMeals),
            percent: totalMeals > 0 ? mealsLogged / totalMeals : 0,
            color: AppColors.coral,
          ),
        ],
      ),
    );
  }
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({
    required this.icon,
    required this.label,
    required this.current,
    required this.target,
    required this.percent,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String current;
  final String target;
  final double percent;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.ink,
              ),
            ),
            const Spacer(),
            Text(
              '$current / $target',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: percent.clamp(0.0, 1.0),
            backgroundColor: AppColors.line,
            valueColor: AlwaysStoppedAnimation(color),
            minHeight: 8,
          ),
        ),
      ],
    );
  }
}

/// کارت سوال سریع با انیمیشن
class QuickQuestionCard extends StatefulWidget {
  const QuickQuestionCard({
    super.key,
    required this.question,
    required this.options,
    required this.onSelect,
  });

  final String question;
  final List<String> options;
  final ValueChanged<String> onSelect;

  @override
  State<QuickQuestionCard> createState() => _QuickQuestionCardState();
}

class _QuickQuestionCardState extends State<QuickQuestionCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  String? _selected;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.95).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleSelect(String option) {
    setState(() => _selected = option);
    _controller.forward().then((_) {
      _controller.reverse();
      widget.onSelect(option);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.mint,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.lime, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.lime,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.question_answer_rounded,
                  size: 20,
                  color: AppColors.emeraldDark,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  widget.question,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.emeraldDark,
                    height: 1.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: widget.options.map((option) {
              final isSelected = option == _selected;
              return ScaleTransition(
                scale: isSelected ? _scaleAnimation : const AlwaysStoppedAnimation(1.0),
                child: Material(
                  color: isSelected ? AppColors.emeraldDeep : Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  elevation: isSelected ? 2 : 0,
                  child: InkWell(
                    onTap: () => _handleSelect(option),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      child: Text(
                        option,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: isSelected
                              ? Colors.white
                              : AppColors.emeraldDark,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

/// نوتیفیکیشن موفقیت
class SuccessToast extends StatelessWidget {
  const SuccessToast({
    super.key,
    required this.message,
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.emeraldDeep, AppColors.emerald],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.emeraldDeep.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(
            Icons.check_circle_rounded,
            color: Colors.white,
            size: 28,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w700,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
