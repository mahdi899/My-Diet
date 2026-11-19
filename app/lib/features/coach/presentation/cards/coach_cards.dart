import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../../core/format/digits.dart';
import '../../../../core/photos/photos.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../presentation/widgets/kit/kit.dart';
import '../../presentation/coach_controller.dart';
import '../coach_companion.dart';
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
      primaryLabel: 'بررسی و ثبت',
      onOpen: onReview,
      onSwap: onSwap,
      nutrients: {
        for (final (label, field) in [
          ('پروتئین', 'protein_g'),
          ('کربوهیدرات', 'carbs_g'),
          ('چربی', 'fat_g'),
        ])
          if (payload[field] is num) label: asInt(payload[field]),
      },
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
                  persianNumber(_value),
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

String _mealLead(String title, List<Map<String, dynamic>> items) {
  String? day;
  if (title.contains('فردا')) {
    day = 'فردا';
  } else if (title.contains('دیروز')) {
    day = 'دیروز';
  } else if (title.contains('امروز')) {
    day = 'امروز';
  }
  final meal = items.length == 1 ? asString(items.first['meal']) : '';
  if (day == null || meal.isEmpty) return title;
  return '$meal $dayت اینه';
}

String _stamp(DateTime time) {
  final local = time.toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return fa('$hour:$minute');
}

class FactCardView extends StatelessWidget {
  const FactCardView({super.key, required this.message, this.onOpenMeal});
  final CoachMessage message;
  final void Function(Map<String, dynamic> item)? onOpenMeal;

  @override
  Widget build(BuildContext context) {
    final payload = message.payload;
    final items = asMapList(payload['items']);
    final kind = asString(payload['kind']);
    final meals = kind == 'meals';
    if (meals) {
      return _ChatMealCard(
        message: message,
        items: items,
        onOpenMeal: onOpenMeal,
      );
    }
    return Align(
      widthFactor: 1,
      alignment: Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.86,
        ),
        child: AppCard(
          padding: EdgeInsets.fromLTRB(10, meals ? 8 : 12, 10, meals ? 8 : 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!meals)
                Text(
                  asString(payload['title'], message.fallbackText),
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: AppColors.emeraldDark,
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 2, 4, 6),
                  child: Text(
                    asString(payload['title']),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.muted,
                    ),
                  ),
                ),
              if (asString(payload['body']).isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  asString(payload['body']),
                  style: const TextStyle(height: 1.7, fontSize: 13),
                ),
              ],
              for (final item in items)
                _FactRow(item: item, kind: kind, onOpen: onOpenMeal),
              Align(
                alignment: Alignment.centerLeft,
                widthFactor: 1,
                child: Padding(
                  padding: const EdgeInsets.only(left: 4, top: 2, bottom: 2),
                  child: Text(
                    _stamp(message.createdAt),
                    style: const TextStyle(
                      color: AppColors.faint,
                      fontSize: 10,
                      height: 1,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChatMealCard extends StatelessWidget {
  const _ChatMealCard({
    required this.message,
    required this.items,
    this.onOpenMeal,
  });

  final CoachMessage message;
  final List<Map<String, dynamic>> items;
  final void Function(Map<String, dynamic> item)? onOpenMeal;

  @override
  Widget build(BuildContext context) {
    final lead = _mealLead(
      asString(message.payload['title'], message.fallbackText),
      items,
    );
    final bubbleWidth = (MediaQuery.sizeOf(context).width * 0.62).clamp(
      210.0,
      280.0,
    );
    return Align(
      alignment: Alignment.centerLeft,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const ExcludeSemantics(
              child: CoachCompanion(size: 32, mood: CompanionMood.calm),
            ),
            const SizedBox(width: 7),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: bubbleWidth),
              child: AppCard(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        lead,
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          color: AppColors.emeraldDark,
                          fontSize: 13,
                          height: 1.9,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      for (final item in items)
                        _FactRow(item: item, kind: 'meals', onOpen: onOpenMeal),
                      Align(
                        alignment: Alignment.bottomLeft,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            _stamp(message.createdAt),
                            style: const TextStyle(
                              color: AppColors.faint,
                              fontSize: 10,
                              height: 1,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FactRow extends StatelessWidget {
  const _FactRow({required this.item, required this.kind, this.onOpen});
  final Map<String, dynamic> item;
  final String kind;
  final void Function(Map<String, dynamic> item)? onOpen;

  @override
  Widget build(BuildContext context) {
    final kcal = asInt(item['kcal']);
    final meal = kind == 'meals';
    final meta = [
      if (asString(item['meal']).isNotEmpty) asString(item['meal']),
      if (asString(item['subtitle']).isNotEmpty) asString(item['subtitle']),
      if (kcal > 0) '${fa(kcal)} کالری',
    ].join(' · ');
    final row = Row(
      children: [
        if (meal) ...[
          FoodImage(
            title: asString(item['title']),
            mealType: asString(item['meal']),
            thumb: true,
            width: 56,
            height: 56,
            borderRadius: BorderRadius.circular(14),
          ),
          const SizedBox(width: 10),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                asString(item['title']),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  height: 1.45,
                  color: AppColors.ink,
                ),
              ),
              if (meta.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  meta,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: meal ? AppColors.emeraldDeep : AppColors.muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    height: 1.4,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (meal)
          const Icon(
            Icons.chevron_left_rounded,
            color: AppColors.faint,
            size: 22,
          ),
      ],
    );
    if (!meal || onOpen == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: row,
      );
    }
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => onOpen!(item),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
          child: row,
        ),
      ),
    );
  }
}

class DayBriefView extends StatelessWidget {
  const DayBriefView({super.key, required this.message, this.onPick});
  final CoachMessage message;
  final ValueChanged<String>? onPick;

  @override
  Widget build(BuildContext context) {
    final meals = asMapList(message.payload['meals']);
    final options = asMapList(message.payload['options']);
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
          if (options.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final option in options)
                  ActionChip(
                    label: Text(
                      asString(option['label'], asString(option['value'])),
                    ),
                    onPressed: onPick == null
                        ? null
                        : () => onPick!(
                            asString(
                              option['label'],
                              asString(option['value']),
                            ),
                          ),
                  ),
              ],
            ),
          ],
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
            'تغییر وزن ${persianNumber(delta)} کیلو',
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

class SwapOptionsView extends StatelessWidget {
  const SwapOptionsView({
    super.key,
    required this.message,
    required this.controller,
  });

  final CoachMessage message;
  final CoachController controller;

  @override
  Widget build(BuildContext context) {
    final payload = message.payload;
    final options = asMapList(payload['options']);
    final used = controller.answered.contains(message.id);
    final mealId = asString(payload['mealId']);
    final reason = asString(payload['reason'], 'variety');
    final bubbleWidth = (MediaQuery.sizeOf(context).width * 0.62).clamp(
      210.0,
      280.0,
    );
    return Align(
      alignment: Alignment.centerLeft,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const ExcludeSemantics(
              child: CoachCompanion(size: 32, mood: CompanionMood.calm),
            ),
            const SizedBox(width: 7),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: bubbleWidth),
              child: AppCard(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        asString(payload['text'], message.fallbackText),
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          color: AppColors.emeraldDark,
                          fontSize: 13,
                          height: 1.9,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      for (final option in options)
                        _SwapOption(
                          option: option,
                          enabled: !used && mealId.isNotEmpty,
                          onPick: () => controller.sendAction(
                            'confirm_swap',
                            {
                              'mealId': mealId,
                              'foodSlug': asString(option['slug']),
                              'reason': reason,
                            },
                            label: asString(option['name']),
                            sourceId: message.id,
                          ),
                        ),
                      Align(
                        alignment: Alignment.bottomLeft,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            _stamp(message.createdAt),
                            style: const TextStyle(
                              color: AppColors.faint,
                              fontSize: 10,
                              height: 1,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SwapOption extends StatelessWidget {
  const _SwapOption({
    required this.option,
    required this.enabled,
    required this.onPick,
  });

  final Map<String, dynamic> option;
  final bool enabled;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final name = asString(option['name']);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled && asString(option['slug']).isNotEmpty ? onPick : null,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              FoodImage(
                title: name,
                mealType: 'ناهار',
                thumb: true,
                width: 52,
                height: 52,
                borderRadius: BorderRadius.circular(12),
                semanticLabel: name,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.45,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                  ),
                ),
              ),
            ],
          ),
        ),
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
