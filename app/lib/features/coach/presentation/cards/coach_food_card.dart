import 'dart:typed_data';
import 'package:flutter/material.dart';

import '../../../../core/format/digits.dart';
import '../../../../core/photos/photos.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../presentation/widgets/kit/kit.dart';

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
    this.subtitle = '',
    this.photoTitle,
    this.photo,
    this.primaryLabel = 'مشاهدهٔ وعده',
    this.extra,
  });
  final String title, mealType, time, subtitle, primaryLabel;
  final String? photoTitle;
  final int calories;
  final int? preparationMinutes;
  final Uint8List? photo;
  final VoidCallback onOpen, onSwap;
  final Widget? extra;

  @override
  Widget build(BuildContext context) => AppCard(
    padding: EdgeInsets.zero,
    clip: true,
    radius: 24,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Stack(
          children: [
            photo == null
                ? FoodImage(
                    title: photoTitle ?? title,
                    mealType: mealType,
                    height: 148,
                    width: double.infinity,
                    cacheWidth:
                        (MediaQuery.sizeOf(context).width *
                                MediaQuery.devicePixelRatioOf(context))
                            .ceil()
                            .clamp(64, 900),
                    semanticLabel: title,
                  )
                : Image.memory(
                    photo!,
                    height: 148,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    semanticLabel: title,
                    cacheWidth:
                        (MediaQuery.sizeOf(context).width *
                                MediaQuery.devicePixelRatioOf(context))
                            .ceil()
                            .clamp(64, 900),
                    gaplessPlayback: true,
                  ),
            if (mealType.isNotEmpty || time.isNotEmpty)
              PositionedDirectional(
                top: 11,
                start: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 11,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceWarm.withValues(alpha: .96),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Text(
                    [
                      mealType,
                      if (time.isNotEmpty) fa(time),
                    ].where((s) => s.isNotEmpty).join(' · '),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.emeraldDark,
                    ),
                  ),
                ),
              ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 19,
                  height: 1.6,
                  fontWeight: FontWeight.w800,
                  color: AppColors.emeraldDark,
                ),
              ),
              if (subtitle.isNotEmpty)
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    height: 1.8,
                    color: AppColors.inkSoft,
                  ),
                ),
              if (calories > 0 || preparationMinutes != null) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 16,
                  runSpacing: 6,
                  children: [
                    if (calories > 0)
                      _Meta(
                        Icons.local_fire_department_outlined,
                        '${fa(calories)} کالری',
                      ),
                    if (preparationMinutes != null)
                      _Meta(
                        Icons.schedule_rounded,
                        '${fa(preparationMinutes)} دقیقه',
                      ),
                  ],
                ),
              ],
              ?extra,
              const SizedBox(height: 13),
              FilledButton(
                onPressed: onOpen,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.emeraldDeep,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(44),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  primaryLabel,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              TextButton(
                onPressed: onSwap,
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.emeraldDark,
                  minimumSize: const Size(48, 44),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                ),
                child: const Text(
                  'جایگزین می‌خوام',
                  style: TextStyle(fontSize: 13),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _Meta extends StatelessWidget {
  const _Meta(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 17, color: AppColors.emeraldDeep),
      const SizedBox(width: 5),
      Text(
        text,
        style: const TextStyle(color: AppColors.inkSoft, fontSize: 12),
      ),
    ],
  );
}
