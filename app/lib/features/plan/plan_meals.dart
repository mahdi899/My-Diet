import 'package:flutter/material.dart';

import '../../core/motion/motion_kit.dart';
import '../../core/theme/tokens.dart';
import '../../data/demo_store.dart';
import '../../presentation/widgets/kit/kit.dart';
import '../coach/coach_launcher.dart';
import 'goal_math.dart';
import 'meal_detail_page.dart';
import 'consume_sheet.dart';

class PlanMealCard extends StatefulWidget {
  const PlanMealCard({super.key, required this.date, required this.index});

  final DateTime date;
  final int index;

  @override
  State<PlanMealCard> createState() => _PlanMealCardState();
}

class _PlanMealCardState extends State<PlanMealCard> {
  int _burst = 0;

  Future<void> _toggle(DemoStore store) async {
    if (!canLogMeal(store, widget.date)) return;
    if (store.mealEaten(widget.date, widget.index)) return;
    final saved = await showConsumeSheet(context, widget.date, widget.index);
    if (saved && mounted) {
      Haptics.success();
      setState(() => _burst++);
    }
  }

  void _open() {
    Navigator.of(context, rootNavigator: true).push(
      fadeThroughRoute<void>(
        MealDetailPage(date: widget.date, index: widget.index),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final meals = store.mealsOn(widget.date);
    if (widget.index >= meals.length) return const SizedBox.shrink();
    final meal = meals[widget.index];
    final eaten = store.mealEaten(widget.date, widget.index);
    final record = store.mealRecordOn(widget.date, widget.index);
    final protein = macrosFor(meal.calories, meal.name).protein;
    final mode = record?['mode'];
    final caption = mode is String ? consumeLabels[mode] : null;
    final logging = canLogMeal(store, widget.date);
    return SparkleBurst(
      trigger: _burst,
      radius: 90,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FoodHeroCard(
            title: meal.title,
            subtitle: protein > 0 ? '${fa(protein)} گرم پروتئین' : meal.amount,
            kcal: meal.calories > 0 ? meal.calories : null,
            badge: meal.time.isEmpty
                ? meal.name
                : '${meal.name} · ${meal.time}',
            heroTag: mealHeroTag(widget.date, widget.index),
            mealType: meal.name,
            ingredients: [for (final item in meal.ingredients) item.name],
            height: 210,
            done: eaten,
            onTap: _open,
          ),
          if (caption != null) ...[
            const SizedBox(height: 8),
            Text(
              caption,
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: PillButton(
                  label: 'تعویض',
                  icon: Icons.swap_horiz_rounded,
                  variant: PillVariant.soft,
                  height: 46,
                  onPressed: () =>
                      openCoach(context, prefill: swapPrefill(meal)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: PillButton(
                  label: record != null || eaten ? 'ثبت شد' : 'انجام شد',
                  icon: Icons.check_rounded,
                  variant: eaten ? PillVariant.lime : PillVariant.primary,
                  height: 46,
                  loading: store.savingMeal,
                  onPressed: logging && !eaten && record == null
                      ? () => _toggle(store)
                      : null,
                ),
              ),
            ],
          ),
        ],
      ),
    ).rise(index: widget.index);
  }
}
