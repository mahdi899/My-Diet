import 'dart:typed_data';
import 'package:flutter/material.dart';

import '../../../../core/format/digits.dart';
import '../../../../core/photos/photos.dart';
import '../../../../core/theme/theme.dart';
import '../../../../presentation/widgets/kit/kit.dart';

/// A meal preview that grows with its content and uses only the chat's scroll.
class CoachFoodCard extends StatelessWidget {
  const CoachFoodCard({
    super.key,
    required this.title,
    required this.mealType,
    required this.onOpen,
    required this.onSwap,
    this.time = '',
    this.calories = 0,
    this.preparationMinutes,
    this.photoTitle,
    this.photo,
    this.primaryLabel = 'مشاهدهٔ وعده',
    this.nutrients = const {},
  });
  final String title, mealType, time, primaryLabel;
  final String? photoTitle;
  final int calories;
  final int? preparationMinutes;
  final Uint8List? photo;
  final VoidCallback onOpen, onSwap;
  final Map<String, int> nutrients;

  @override
  Widget build(BuildContext context) => AppCard(
    key: const ValueKey('coach-food-card'),
    padding: const EdgeInsets.all(14),
    radius: 24,
    shadows: const [],
    border: Border.all(color: AppColors.selectedLine),
    child: LayoutBuilder(
      builder: (context, constraints) {
        final stacked =
            constraints.maxWidth < 240 ||
            MediaQuery.textScalerOf(context).scale(14) > 19;
        final imageSize = constraints.maxWidth < 290 ? 90.0 : 108.0;
        final image = ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: photo == null
              ? FoodImage(
                  title: photoTitle ?? title,
                  mealType: mealType,
                  width: stacked ? constraints.maxWidth : imageSize,
                  height: stacked ? 136 : imageSize + 8,
                  semanticLabel: title,
                )
              : Image.memory(
                  photo!,
                  width: stacked ? constraints.maxWidth : imageSize,
                  height: stacked ? 136 : imageSize + 8,
                  fit: BoxFit.cover,
                  semanticLabel: title,
                  cacheWidth: 600,
                  gaplessPlayback: true,
                  errorBuilder: (_, _, _) => SizedBox(
                    width: stacked ? constraints.maxWidth : imageSize,
                    height: stacked ? 136 : imageSize + 8,
                    child: const ColoredBox(
                      color: AppColors.mint,
                      child: Icon(
                        Icons.restaurant_rounded,
                        color: AppColors.emeraldDark,
                      ),
                    ),
                  ),
                ),
        );
        final identity = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (mealType.isNotEmpty || time.isNotEmpty)
              Text(
                [
                  mealType,
                  if (time.isNotEmpty) fa(time),
                ].where((value) => value.isNotEmpty).join(' · '),
                style: AppTypography.supporting,
              ),
            const SizedBox(height: 3),
            Text(
              title,
              style: AppTypography.sectionTitle.copyWith(
                color: AppColors.emeraldDark,
                height: 1.5,
              ),
            ),
            if (calories > 0 || (preparationMinutes ?? 0) > 0) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 12,
                runSpacing: 6,
                children: [
                  if (calories > 0)
                    _FoodMeta(
                      Icons.local_fire_department_outlined,
                      '${fa(calories)} کالری',
                    ),
                  if ((preparationMinutes ?? 0) > 0)
                    _FoodMeta(
                      Icons.schedule_rounded,
                      '${fa(preparationMinutes)} دقیقه',
                    ),
                ],
              ),
            ],
          ],
        );
        final primary = FilledButton(
          onPressed: onOpen,
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
            textStyle: AppTypography.button.copyWith(fontSize: 13),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          child: Text(primaryLabel, textAlign: TextAlign.center),
        );
        final alternative = OutlinedButton(
          onPressed: onSwap,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
            textStyle: AppTypography.button.copyWith(fontSize: 13),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          child: const Text('پیشنهاد دیگر', textAlign: TextAlign.center),
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (stacked) ...[
              image,
              const SizedBox(height: 12),
              identity,
            ] else
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(child: identity),
                  const SizedBox(width: 12),
                  image,
                ],
              ),
            if (nutrients.isNotEmpty) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.mint,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Wrap(
                  spacing: 14,
                  runSpacing: 8,
                  children: [
                    for (final entry in nutrients.entries)
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: '${entry.key} ',
                              style: const TextStyle(color: AppColors.inkSoft),
                            ),
                            TextSpan(
                              text: '${fa(entry.value)} گرم',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        style: AppTypography.supporting.copyWith(
                          color: AppColors.emeraldDark,
                          fontSize: 11,
                          height: 1.6,
                        ),
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 14),
            if (stacked) ...[
              primary,
              const SizedBox(height: 8),
              alternative,
            ] else
              Row(
                children: [
                  Expanded(child: primary),
                  const SizedBox(width: 8),
                  Expanded(child: alternative),
                ],
              ),
          ],
        );
      },
    ),
  );
}

class _FoodMeta extends StatelessWidget {
  const _FoodMeta(this.icon, this.text);
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      ExcludeSemantics(
        child: Icon(icon, size: 16, color: AppColors.emeraldDeep),
      ),
      const SizedBox(width: 4),
      Flexible(
        child: Text(
          text,
          style: AppTypography.supporting.copyWith(color: AppColors.inkSoft),
        ),
      ),
    ],
  );
}
