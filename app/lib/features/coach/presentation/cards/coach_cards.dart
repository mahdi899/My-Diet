import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../../core/format/digits.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../presentation/widgets/kit/kit.dart';
import '../../presentation/coach_controller.dart';
import '../../data/coach_parse.dart';
import '../../domain/coach_message.dart';
import 'coach_food_card.dart';

class MealCardView extends StatelessWidget {
  const MealCardView({
    super.key,
    required this.message,
    required this.onReview,
    required this.onSwap,
    this.photo,
  });

  final CoachMessage message;
  final VoidCallback onReview;
  final VoidCallback onSwap;
  final Uint8List? photo;

  @override
  Widget build(BuildContext context) {
    final payload = message.payload;
    final title = asString(payload['title'], message.fallbackText);
    final meal = asString(
      payload['meal_type_fa'],
      asString(payload['meal_name']),
    );
    return CoachFoodCard(
      title: title,
      mealType: meal,
      photoTitle: asString(payload['photo_title'], title),
      photo: photo,
      time: asString(payload['time']),
      calories: asInt(payload['calories']),
      preparationMinutes: payload['preparation_minutes'] is num
          ? asInt(payload['preparation_minutes'])
          : null,
      subtitle: 'پیشنهاد مربی؛ قبل از ثبت بررسی کن',
      primaryLabel: 'بررسی و ثبت',
      onOpen: onReview,
      onSwap: onSwap,
      extra: payload.containsKey('protein_g')
          ? ExpansionTile(
              title: const Text(
                'اطلاعات تغذیه',
                style: TextStyle(fontSize: 12),
              ),
              tilePadding: EdgeInsets.zero,
              childrenPadding: const EdgeInsets.only(bottom: 8),
              children: [
                _Macros(
                  protein: asInt(payload['protein_g']),
                  carbs: asInt(payload['carbs_g']),
                  fat: asInt(payload['fat_g']),
                ),
              ],
            )
          : null,
    );
  }
}

class PlanMealView extends StatelessWidget {
  const PlanMealView({
    super.key,
    required this.message,
    required this.onOpen,
    required this.onSwap,
  });
  final CoachMessage message;
  final VoidCallback onOpen, onSwap;
  @override
  Widget build(BuildContext context) {
    final payload = message.payload;
    final title = asString(payload['title'], message.fallbackText);
    return CoachFoodCard(
      title: title,
      mealType: asString(payload['meal_type_fa']),
      time: asString(payload['time']),
      photoTitle: asString(payload['photo_title'], title),
      calories: asInt(payload['calories']),
      preparationMinutes: payload['preparation_minutes'] is num
          ? asInt(payload['preparation_minutes'])
          : null,
      subtitle: 'یک وعده از برنامهٔ مخصوص تو',
      onOpen: onOpen,
      onSwap: onSwap,
    );
  }
}

class CalorieRingView extends StatelessWidget {
  const CalorieRingView({super.key, required this.message});
  final CoachMessage message;

  @override
  Widget build(BuildContext context) {
    final eaten = asInt(message.payload['eaten']);
    final goal = asInt(message.payload['goal'], 1800);
    final safe = goal <= 0 ? 1 : goal;
    return AppCard(
      child: Row(
        children: [
          Ring(
            value: eaten / safe,
            size: 92,
            strokeWidth: 9,
            child: Text(
              fa(eaten),
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  asString(message.payload['title'], 'کالری امروز'),
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                Text(
                  'از ${fa(goal)} کالری',
                  style: const TextStyle(color: AppColors.muted, height: 1.7),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class WeighInView extends StatefulWidget {
  const WeighInView({
    super.key,
    required this.message,
    required this.controller,
  });

  final CoachMessage message;
  final CoachController controller;

  @override
  State<WeighInView> createState() => _WeighInViewState();
}

class _WeighInViewState extends State<WeighInView> {
  late double _value = asDouble(widget.message.payload['value'], 70);

  @override
  Widget build(BuildContext context) {
    final step = asDouble(widget.message.payload['step'], 0.1);
    final used = widget.controller.answered.contains(widget.message.id);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            asString(widget.message.payload['title'], 'وزن امروز'),
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _Step(
                icon: Icons.remove_rounded,
                onTap: used
                    ? null
                    : () => setState(
                        () => _value = (_value - step).clamp(30, 250),
                      ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Text(
                  fa(_value.toStringAsFixed(1)),
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _Step(
                icon: Icons.add_rounded,
                onTap: used
                    ? null
                    : () => setState(
                        () => _value = (_value + step).clamp(30, 250),
                      ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          PillButton(
            label: 'ثبت وزن',
            onPressed: used
                ? null
                : () => widget.controller.sendAction(
                    'log_weight',
                    {'value': double.parse(_value.toStringAsFixed(1))},
                    label: 'ثبت وزن',
                    sourceId: widget.message.id,
                  ),
          ),
        ],
      ),
    );
  }
}

class WaterView extends StatelessWidget {
  const WaterView({super.key, required this.message, required this.controller});

  final CoachMessage message;
  final CoachController controller;

  @override
  Widget build(BuildContext context) {
    final glasses = asInt(message.payload['glasses']);
    final goal = asInt(message.payload['goal'], 8);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            asString(message.payload['title'], 'آب امروز'),
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text(
            '${fa(glasses)} از ${fa(goal)} لیوان',
            style: const TextStyle(color: AppColors.inkSoft, height: 1.7),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            children: [
              for (var i = 0; i < goal; i++)
                Icon(
                  Icons.water_drop_rounded,
                  color: i < glasses ? AppColors.sky : AppColors.line,
                ),
            ],
          ),
          const SizedBox(height: 12),
          PillButton(
            label: 'یه لیوان دیگه',
            variant: PillVariant.soft,
            onPressed: () => controller.sendAction('log_water', const {
              'glasses': 1,
            }, label: 'یه لیوان آب'),
          ),
        ],
      ),
    );
  }
}

class QuickRepliesView extends StatelessWidget {
  const QuickRepliesView({
    super.key,
    required this.message,
    required this.onPick,
  });

  final CoachMessage message;
  final ValueChanged<Map<String, dynamic>> onPick;

  @override
  Widget build(BuildContext context) {
    final options = asMapList(message.payload['options']);
    return AppCard.tinted(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            asString(message.payload['prompt'], message.fallbackText),
            style: const TextStyle(fontWeight: FontWeight.w700, height: 1.7),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final option in options)
                ActionChip(
                  label: Text(
                    asString(option['label'], asString(option['value'])),
                  ),
                  onPressed: () => onPick(option),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class DayBriefView extends StatelessWidget {
  const DayBriefView({super.key, required this.message});
  final CoachMessage message;

  @override
  Widget build(BuildContext context) {
    final meals = asMapList(message.payload['meals']);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            asString(message.payload['title'], 'خلاصهٔ امروز'),
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 4),
          Text(
            asString(message.payload['note']),
            style: const TextStyle(color: AppColors.muted, height: 1.7),
          ),
          const SizedBox(height: 8),
          for (final meal in meals)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${asString(meal['name'])} · ${asString(meal['title'])}',
                      style: const TextStyle(height: 1.6),
                    ),
                  ),
                  Text(
                    fa(asInt(meal['calories'])),
                    style: const TextStyle(color: AppColors.emeraldDeep),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class WeeklyReviewView extends StatelessWidget {
  const WeeklyReviewView({super.key, required this.message});
  final CoachMessage message;

  @override
  Widget build(BuildContext context) {
    final adherence = asDouble(message.payload['adherence']);
    final delta = asDouble(message.payload['delta_kg']);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            asString(message.payload['title'], 'مرور هفته'),
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text('پایبندی ${fa((adherence * 100).round())}٪'),
          Text(
            'تغییر وزن ${fa(delta.toStringAsFixed(1))} کیلو',
            style: const TextStyle(height: 1.7),
          ),
          Text(
            asString(message.payload['note']),
            style: const TextStyle(color: AppColors.inkSoft, height: 1.7),
          ),
        ],
      ),
    );
  }
}

class MilestoneView extends StatelessWidget {
  const MilestoneView({super.key, required this.message});
  final CoachMessage message;

  @override
  Widget build(BuildContext context) {
    return SparkleBurst(
      autoPlay: true,
      child: AppCard(
        gradient: AppGradients.lime,
        shadows: AppShadows.cta,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              asString(message.payload['title'], message.fallbackText),
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 18,
                color: AppColors.emeraldDark,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              asString(message.payload['subtitle']),
              style: const TextStyle(color: AppColors.emeraldDark, height: 1.7),
            ),
          ],
        ),
      ),
    );
  }
}

class _Macros extends StatelessWidget {
  const _Macros({
    required this.protein,
    required this.carbs,
    required this.fat,
  });
  final int protein, carbs, fat;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _Macro('پروتئین', protein, AppColors.coral),
        _Macro('کربو', carbs, AppColors.amber),
        _Macro('چربی', fat, AppColors.sky),
      ],
    );
  }
}

class _Macro extends StatelessWidget {
  const _Macro(this.label, this.grams, this.color);
  final String label;
  final int grams;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: AppColors.muted),
          ),
          Text(
            '${fa(grams)} گ',
            style: TextStyle(fontWeight: FontWeight.w800, color: color),
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton.filledTonal(onPressed: onTap, icon: Icon(icon));
  }
}
