import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';
import '../../domain/common/digits.dart';
import '../../presentation/widgets/kit/pressable_scale.dart';
import '../../presentation/widgets/brand_scene.dart';
import 'home_day_focus.dart';
import 'home_focus_sparkles.dart';

/// Personal greeting and profile, separate from the day's changing records.
class HomeWelcome extends StatelessWidget {
  const HomeWelcome({
    super.key,
    required this.name,
    required this.now,
    required this.onProfile,
    this.profilePhoto,
  });
  final String name;
  final DateTime now;
  final String? profilePhoto;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context) {
    final hour = now.hour;
    final night = hour < 5 || hour >= 21;
    final hello = night
        ? 'شب بخیر'
        : hour < 12
        ? 'صبح بخیر'
        : hour < 17
        ? 'ظهر بخیر'
        : 'عصر بخیر';
    // A malformed cached photo must not prevent the greeting from rendering.
    Uint8List? photo;
    try {
      if (profilePhoto != null) photo = base64Decode(profilePhoto!);
    } on FormatException {
      photo = null;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(
              night ? Icons.nights_stay_outlined : Icons.wb_sunny_outlined,
              size: 28,
              color: AppColors.emeraldDeep,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    hello,
                    style: AppTypography.supporting.copyWith(fontSize: 13),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    name == 'دوست' ? 'سلام دوست من' : 'سلام $name جان',
                    style: AppTypography.pageTitle.copyWith(
                      fontSize: 24,
                      color: AppColors.emeraldDark,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            PressableScale(
              semanticLabel: 'پروفایل',
              onTap: onProfile,
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.emeraldDeep, width: 1),
                ),
                child: CircleAvatar(
                  radius: 23,
                  backgroundColor: AppColors.mint,
                  foregroundImage: photo == null ? null : MemoryImage(photo),
                  child: Text(
                    name.isEmpty ? 'س' : name.characters.first,
                    style: AppTypography.sectionTitle.copyWith(
                      color: AppColors.emeraldDark,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class HomeFocusCard extends StatelessWidget {
  const HomeFocusCard({
    super.key,
    required this.focus,
    this.onReview,
    this.reviewLabel = 'مرور امروز با مربی',
  });
  final HomeDayFocus focus;
  final VoidCallback? onReview;
  final String reviewLabel;

  @override
  Widget build(BuildContext context) {
    final next = focus.next;
    final title = focus.review || next == null
        ? focus.title
        : focus.completed == 0
        ? 'از ${next.meal.name} شروع کنیم؟'
        : 'بریم سراغ ${next.meal.name}؟';
    final message = focus.total > 0 && !focus.review && focus.completed == 0
        ? 'آرام و پیوسته، به سبک خودت.'
        : focus.message;
    return Container(
      key: const ValueKey('home-focus-card'),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [Color(0xFFF7FCF8), AppColors.mint],
        ),
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: const Color(0xFFFFFFFF)),
        boxShadow: AppShadows.soft,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.xl),
        child: Stack(
          children: [
            const Positioned.fill(child: HomeFocusSparkles()),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final narrow =
                  constraints.maxWidth < 280 ||
                  MediaQuery.textScalerOf(context).scale(14) > 18;
              final size = narrow ? 72.0 : 94.0;
              return Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          focus.review
                              ? 'مرور امروزت'
                              : focus.total == 0
                              ? 'مسیر تازهٔ تو'
                              : 'قدم بعدی امروزت',
                          style: AppTypography.supporting.copyWith(
                            color: AppColors.emeraldDark,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          title,
                          key: const ValueKey('home-day-title'),
                          style: AppTypography.sectionTitle.copyWith(
                            fontSize: 21,
                            color: AppColors.emeraldDark,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          message,
                          style: AppTypography.body.copyWith(
                            fontSize: 13,
                            color: AppColors.inkSoft,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  BrandScene(
                    kind: BrandSceneKind.companion,
                    width: size,
                    height: size,
                  ),
                ],
              );
            },
          ),
          if (focus.total > 0) ...[
            const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: Divider(height: 1, color: AppColors.selectedLine),
            ),
            _MealProgress(completed: focus.completed, total: focus.total),
          ],
          if (focus.review || next == null) ...[
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              key: const ValueKey('home-day-review'),
              onPressed: onReview,
              child: Text(reviewLabel),
            ),
          ],
        ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MealProgress extends StatelessWidget {
  const _MealProgress({required this.completed, required this.total});
  final int completed, total;
  @override
  Widget build(BuildContext context) {
    final done = completed.clamp(0, total);
    final count = '${fa(done)} از ${fa(total)}';
    final segments = total <= 8
        ? Row(
            children: [
              for (var i = 0; i < total; i++) ...[
                if (i > 0) const SizedBox(width: 4),
                Expanded(
                  child: Container(
                    key: ValueKey('home-progress-segment-$i'),
                    height: 8,
                    decoration: BoxDecoration(
                      color: i < done
                          ? AppColors.emeraldDeep
                          : Colors.transparent,
                      border: Border.all(
                        color: i < done
                            ? AppColors.emeraldDeep
                            : AppColors.selectedLine,
                      ),
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                  ),
                ),
              ],
            ],
          )
        : ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: done / total,
              minHeight: 8,
              color: AppColors.emeraldDeep,
              backgroundColor: AppColors.selectedLine,
            ),
          );
    final label = Text(
      'وعده‌های ثبت‌شده',
      style: AppTypography.supporting.copyWith(color: AppColors.emeraldDark),
    );
    final amount = Text(
      count,
      key: const ValueKey('home-focus-progress'),
      style: AppTypography.quantity,
    );
    return Semantics(
      label: 'وعده‌های ثبت‌شده',
      value: count,
      child: ExcludeSemantics(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final stacked =
                constraints.maxWidth < 285 ||
                MediaQuery.textScalerOf(context).scale(14) > 18;
            if (stacked) {
              return Column(
                children: [
                  Row(
                    children: [
                      Expanded(child: label),
                      amount,
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  segments,
                ],
              );
            }
            return Row(
              children: [
                label,
                const SizedBox(width: AppSpacing.md),
                Expanded(child: segments),
                const SizedBox(width: AppSpacing.md),
                amount,
              ],
            );
          },
        ),
      ),
    );
  }
}
