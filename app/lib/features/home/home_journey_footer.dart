import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';
import '../../presentation/widgets/brand_scene.dart';
import '../../presentation/widgets/kit/app_card.dart';
import 'weight_card.dart';

class HomeJourneyFooter extends StatelessWidget {
  const HomeJourneyFooter({super.key, required this.onCoach});
  final VoidCallback onCoach;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const HomeWeightCard(),
      const SizedBox(height: 14),
      _CoachReviewCard(onPressed: onCoach),
    ],
  );
}

class _CoachReviewCard extends StatelessWidget {
  const _CoachReviewCard({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => AppCard(
    key: const ValueKey('home-coach-review'),
    color: const Color(0xFF07543A),
    padding: const EdgeInsets.all(18),
    radius: 26,
    shadows: const [],
    child: LayoutBuilder(
      builder: (context, constraints) {
        final largeText = MediaQuery.textScalerOf(context).scale(14) > 18;
        final content = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'مرور امروز با مربی',
              style: TextStyle(
                color: Color(0xFFFFFBEF),
                fontSize: 16,
                height: 1.6,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'دربارهٔ وعده‌ها و ثبت‌های امروزت حرف بزن.',
              style: TextStyle(
                color: Color(0xFFDEEDD6),
                fontSize: 12,
                height: 1.8,
              ),
            ),
            const SizedBox(height: 14),
            FilledButton(
              key: const ValueKey('home-open-coach'),
              onPressed: onPressed,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFFFFCF4),
                foregroundColor: const Color(0xFF07543A),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                minimumSize: const Size(0, 48),
                textStyle: AppTypography.button.copyWith(fontSize: 12),
                shape: const StadiumBorder(),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(child: Text('گفتگو با مربی')),
                  SizedBox(width: 8),
                  Icon(
                    Icons.arrow_back_rounded,
                    size: 18,
                    textDirection: TextDirection.ltr,
                  ),
                ],
              ),
            ),
          ],
        );
        if (largeText || constraints.maxWidth < 250) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Align(
                alignment: AlignmentDirectional.centerEnd,
                child: BrandScene(
                  kind: BrandSceneKind.companion,
                  width: 64,
                  height: 68,
                ),
              ),
              content,
            ],
          );
        }
        return Row(
          children: [
            Expanded(child: content),
            const SizedBox(width: 8),
            const BrandScene(
              kind: BrandSceneKind.companion,
              width: 96,
              height: 128,
            ),
          ],
        );
      },
    ),
  );
}
