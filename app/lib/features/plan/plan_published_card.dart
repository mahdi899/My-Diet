import 'package:flutter/material.dart';

import '../../core/icons/diet_icon.dart';
import '../../core/motion/motion_kit.dart';
import '../../core/theme/theme.dart';
import '../../presentation/widgets/kit/app_card.dart';

/// Shown only after the approved plan has actually been published.
class PlanPublishedCard extends StatelessWidget {
  const PlanPublishedCard({super.key, required this.onViewMeals});

  static const illustrationAsset =
      'assets/images/brand_scenes/plan_ready_meal.png';
  final VoidCallback onViewMeals;

  @override
  Widget build(BuildContext context) => AppCard(
    radius: 24,
    padding: const EdgeInsets.all(16),
    shadows: const [],
    border: Border.all(color: const Color(0xFFD8DFCA)),
    gradient: const RadialGradient(
      center: Alignment(-.8, -.2),
      radius: 1.1,
      colors: [Color(0xFFE4F1CE), Color(0xFFF5F9EF), Color(0xFFFAFBF5)],
      stops: [0, .6, 1],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final largeText = MediaQuery.textScalerOf(context).scale(12) > 15;
            final size = (constraints.maxWidth * .34).clamp(96.0, 148.0);
            final illustration = ExcludeSemantics(
              child: Image.asset(
                illustrationAsset,
                key: const ValueKey('plan-published-illustration'),
                width: size,
                height: size,
                fit: BoxFit.contain,
                cacheWidth: (size * MediaQuery.devicePixelRatioOf(context))
                    .ceil()
                    .clamp(1, 600),
                errorBuilder: (_, _, _) => SizedBox.square(
                  dimension: size,
                  child: const Center(
                    child: DietIcon(DietIconKind.balancedMeal, size: 64),
                  ),
                ),
              ),
            );
            const copy = _PublicationCopy();
            if (constraints.maxWidth < 240 ||
                (largeText && constraints.maxWidth < 360)) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  copy,
                  const SizedBox(height: 8),
                  Align(alignment: Alignment.centerLeft, child: illustration),
                ],
              );
            }
            return Row(
              children: [
                const Expanded(child: copy),
                const SizedBox(width: 10),
                illustration,
              ],
            );
          },
        ),
        const SizedBox(height: 14),
        DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: const LinearGradient(
              begin: Alignment.topRight,
              end: Alignment.bottomLeft,
              colors: [Color(0xFF009B60), Color(0xFF007449)],
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x2612A072),
                blurRadius: 12,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: FilledButton(
            key: const ValueKey('plan-published-view-meals'),
            onPressed: () {
              Haptics.tap();
              onViewMeals();
            },
            style: FilledButton.styleFrom(
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              shadowColor: Colors.transparent,
              minimumSize: const Size(0, 48),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              textStyle: AppTypography.button,
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Flexible(
                  child: Text('وعده‌ها رو ببین', textAlign: TextAlign.center),
                ),
                SizedBox(width: 8),
                ExcludeSemantics(
                  child: Icon(
                    Icons.arrow_back_rounded,
                    size: 22,
                    textDirection: TextDirection.ltr,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class _PublicationCopy extends StatelessWidget {
  const _PublicationCopy();

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFE1F2DE),
          borderRadius: BorderRadius.circular(99),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ExcludeSemantics(
              child: Icon(
                Icons.check_circle_rounded,
                size: 16,
                color: AppColors.emeraldDeep,
              ),
            ),
            SizedBox(width: 5),
            Flexible(
              child: Text(
                'تأیید و منتشر شده',
                style: TextStyle(
                  fontSize: 11,
                  height: 1.4,
                  fontWeight: FontWeight.bold,
                  color: AppColors.emeraldDark,
                ),
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 8),
      Semantics(
        header: true,
        liveRegion: true,
        child: const Text(
          'برنامه‌ات آماده‌ست!',
          style: TextStyle(
            fontSize: 20,
            height: 1.35,
            fontWeight: FontWeight.bold,
            color: Color(0xFF064B32),
          ),
        ),
      ),
      const SizedBox(height: 6),
      const Text(
        'مقدار مواد و روش پخت هر وعده\nرو یک‌جا ببین.',
        style: TextStyle(fontSize: 12, height: 1.7, color: AppColors.inkSoft),
      ),
    ],
  );
}
