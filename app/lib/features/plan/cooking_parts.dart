import '../../core/icons/diet_icon.dart';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/photos/photos.dart';
import '../../core/theme/tokens.dart';
import '../../domain/common/digits.dart';
import '../../domain/plan/meal.dart';
import 'goal_math.dart';

class CookingHero extends StatelessWidget {
  const CookingHero({super.key, required this.meal});
  final Meal meal;
  @override
  Widget build(BuildContext context) => SizedBox(
    height: (MediaQuery.sizeOf(context).height * .235).clamp(165.0, 225.0),
    child: ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(28)),
      child: Stack(
        fit: StackFit.expand,
        children: [
          FoodImage(
            title: meal.title,
            mealType: meal.name,
            ingredients: [for (final i in meal.ingredients) i.name],
            semanticLabel: meal.title,
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Align(
                alignment: Alignment.topCenter,
                child: Row(
                  children: [
                    Expanded(
                      child: Align(
                        heightFactor: 1,
                        alignment: AlignmentDirectional.centerStart,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: AppColors.emeraldDark.withValues(alpha: .94),
                            borderRadius: BorderRadius.circular(28),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: .8),
                            ),
                          ),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: 13,
                              vertical: 8,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                DietIcon(
                                  DietIconKind.meal,
                                  color: Colors.white,
                                  monochrome: true,
                                  size: 22,
                                ),
                                SizedBox(width: 8),
                                Flexible(
                                  child: Text(
                                    'حالت آشپزی',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const SizedBox(width: 48),
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

class CookingStepTrack extends StatelessWidget {
  const CookingStepTrack({super.key, required this.step, required this.total});
  final int step, total;
  @override
  Widget build(BuildContext context) {
    final count = math.min(total, 5);
    final first = (step - 2).clamp(0, math.max(0, total - count));
    return Column(
      children: [
        ExcludeSemantics(
          child: Row(
            children: [
              for (var i = first; i < first + count; i++) ...[
                if (i != first)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: i <= step ? AppColors.emeraldDeep : AppColors.line,
                    ),
                  ),
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i <= step ? AppColors.emeraldDeep : AppColors.bg,
                    border: Border.all(
                      color: i <= step
                          ? AppColors.emeraldDeep
                          : const Color(0xFFD8CFBC),
                    ),
                  ),
                  child: Text(
                    fa(i + 1),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: i <= step ? Colors.white : AppColors.inkSoft,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 17, vertical: 3),
          decoration: BoxDecoration(
            color: AppColors.mint,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Text(
            'مرحلهٔ ${fa(step + 1)} از ${fa(total)}',
            key: const ValueKey('cooking-step-count'),
            style: const TextStyle(
              color: AppColors.emeraldDark,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }
}

class CookingIngredients extends StatelessWidget {
  const CookingIngredients({
    super.key,
    required this.items,
    required this.onShowAll,
  });
  final List<MealIngredient> items;
  final VoidCallback onShowAll;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        children: [
          const Expanded(
            child: Text(
              'مواد این مرحله',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: AppColors.emeraldDark,
              ),
            ),
          ),
          TextButton(
            key: const ValueKey('cooking-all-ingredients'),
            onPressed: onShowAll,
            child: const Text('همه مواد'),
          ),
        ],
      ),
      if (items.isEmpty)
        const Text(
          'مواد این مرحله جداگانه مشخص نشده؛ فهرست کامل مواد را ببین.',
          style: TextStyle(fontSize: 12, color: AppColors.inkSoft, height: 1.8),
        )
      else
        LayoutBuilder(
          builder: (context, constraints) {
            final large = MediaQuery.textScalerOf(context).scale(14) > 18;
            final columns = large ? 2 : 3;
            final width = (constraints.maxWidth - (columns - 1) * 8) / columns;
            return Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final item in items)
                  SizedBox(
                    width: width,
                    child: _CookingIngredient(item: item),
                  ),
              ],
            );
          },
        ),
    ],
  );
}

class _CookingIngredient extends StatelessWidget {
  const _CookingIngredient({required this.item});
  final MealIngredient item;
  @override
  Widget build(BuildContext context) {
    final line = ingredientLine(item);
    final quantity = line.startsWith(item.name)
        ? line.substring(item.name.length).trim()
        : '';
    return Semantics(
      label: line,
      excludeSemantics: true,
      child: Container(
        key: ValueKey('cooking-ingredient-${item.id}'),
        padding: const EdgeInsets.fromLTRB(6, 6, 6, 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                height: 60,
                width: double.infinity,
                child: FutureBuilder<FoodPhotoResolver>(
                  future: FoodPhotoResolver.load(),
                  builder: (context, snapshot) {
                    final photo = snapshot.data?.bestMatch(
                      title: item.name,
                      mealType: 'ingredient',
                    );
                    return photo == null
                        ? const ColoredBox(
                            color: AppColors.surfaceWarm,
                            child: Icon(
                              Icons.eco_outlined,
                              color: AppColors.emeraldDeep,
                              size: 26,
                            ),
                          )
                        : FoodImage(
                            photo: photo,
                            thumb: true,
                            semanticLabel: item.name,
                          );
                  },
                ),
              ),
            ),
            const SizedBox(height: 5),
            Text(
              item.name,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: AppColors.emeraldDark,
              ),
            ),
            if (quantity.isNotEmpty)
              Text(
                quantity,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11, color: AppColors.inkSoft),
              ),
          ],
        ),
      ),
    );
  }
}

class CookingTimerPanel extends StatelessWidget {
  const CookingTimerPanel({
    super.key,
    required this.time,
    required this.step,
    required this.paused,
    required this.finished,
    required this.onPause,
    required this.onDelete,
  });
  final String time;
  final int step;
  final bool paused, finished;
  final VoidCallback onPause, onDelete;
  @override
  Widget build(BuildContext context) {
    final clock = Semantics(
      liveRegion: finished,
      child: Text(
        finished ? 'زمان تمام شد' : time,
        key: const ValueKey('cooking-countdown'),
        textDirection: TextDirection.ltr,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: finished ? 19 : 29,
          color: AppColors.emeraldDark,
          fontWeight: FontWeight.w800,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
    final pause = finished
        ? const SizedBox.shrink()
        : OutlinedButton.icon(
            key: const ValueKey('cooking-pause'),
            onPressed: onPause,
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.emeraldDeep),
              padding: const EdgeInsets.symmetric(horizontal: 10),
              minimumSize: const Size(68, 44),
            ),
            icon: Icon(
              paused ? Icons.play_arrow_rounded : Icons.pause_rounded,
              size: 18,
            ),
            label: Text(
              paused ? 'ادامهٔ تایمر' : 'مکث',
              style: const TextStyle(fontSize: 12),
            ),
          );
    return Container(
      key: const ValueKey('cooking-timer'),
      padding: const EdgeInsets.fromLTRB(12, 12, 6, 10),
      decoration: BoxDecoration(
        color: AppColors.mint,
        borderRadius: BorderRadius.circular(21),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final narrow =
                  constraints.maxWidth < 325 ||
                  MediaQuery.textScalerOf(context).scale(14) > 18;
              final label = Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Tooltip(
                    message:
                        'در پس‌زمینه زمان محاسبه می‌شود؛ اعلان بیرون از برنامه ندارد.',
                    child: Icon(
                      Icons.timer_outlined,
                      size: 24,
                      color: AppColors.emeraldDeep,
                    ),
                  ),
                  const SizedBox(width: 7),
                  Flexible(
                    child: Text(
                      'تایمر مرحلهٔ ${fa(step + 1)}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.emeraldDark,
                      ),
                    ),
                  ),
                ],
              );
              final remove = IconButton(
                tooltip: 'حذف تایمر',
                onPressed: onDelete,
                icon: const Icon(
                  Icons.close_rounded,
                  size: 18,
                  color: AppColors.emeraldDeep,
                ),
              );
              return narrow
                  ? Column(
                      children: [
                        Row(
                          children: [
                            Expanded(child: label),
                            remove,
                          ],
                        ),
                        Row(
                          children: [
                            Expanded(child: clock),
                            pause,
                          ],
                        ),
                      ],
                    )
                  : Column(
                      children: [
                        Row(
                          children: [
                            Expanded(flex: 4, child: label),
                            Expanded(flex: 3, child: clock),
                            const SizedBox(width: 8),
                            pause,
                          ],
                        ),
                        Align(
                          alignment: AlignmentDirectional.centerEnd,
                          child: SizedBox(
                            height: 28,
                            child: TextButton(
                              onPressed: onDelete,
                              child: const Text(
                                'حذف تایمر',
                                style: TextStyle(fontSize: 10),
                              ),
                            ),
                          ),
                        ),
                      ],
                    );
            },
          ),
          if (finished)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'غذا را بررسی کن؛ پایان تایمر به معنی آماده‌بودن غذا نیست.',
                style: TextStyle(
                  fontSize: 12,
                  height: 1.7,
                  color: AppColors.inkSoft,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
