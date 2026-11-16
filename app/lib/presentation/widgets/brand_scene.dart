import 'package:flutter/material.dart';

import '../../core/icons/diet_icon.dart';

/// Decorative scenes only. The surrounding text and actions own the real state.
enum BrandSceneKind {
  companion,
  welcome,
  planBuilding,
  specialistReview,
  planReady,
  needsInformation,
  emptyPlan,
  connectionProblem,
  paymentPending,
  paymentIssue,
  habits,
  shopping;

  String get asset => switch (this) {
    companion => 'assets/images/home/sprout_welcome.png',
    welcome => 'assets/images/brand_scenes/welcome.png',
    planBuilding => 'assets/images/brand_scenes/plan_building.png',
    specialistReview => 'assets/images/brand_scenes/specialist_review_v2.png',
    planReady => 'assets/images/brand_scenes/plan_ready.png',
    needsInformation => 'assets/images/brand_scenes/needs_information.png',
    emptyPlan => 'assets/images/brand_scenes/empty_plan.png',
    connectionProblem => 'assets/images/brand_scenes/connection_problem.png',
    paymentPending => 'assets/images/brand_scenes/payment_pending.png',
    paymentIssue => 'assets/images/brand_scenes/payment_issue_v2.png',
    habits => 'assets/images/brand_scenes/habits.png',
    shopping => 'assets/images/brand_scenes/shopping.png',
  };
}

class BrandScene extends StatelessWidget {
  const BrandScene({
    super.key,
    required this.kind,
    this.height = 180,
    this.width,
  }) : assert(height > 0);

  final BrandSceneKind kind;
  final double height;
  final double? width;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SizedBox(
      height: height,
      width: width ?? double.infinity,
      child: LayoutBuilder(
        builder: (context, constraints) => Image.asset(
          kind.asset,
          key: ValueKey('brand-scene-${kind.name}'),
          fit: BoxFit.contain,
          // Decode for the display slot, rather than the full source image.
          cacheWidth:
              ((constraints.hasBoundedWidth
                              ? constraints.maxWidth
                              : MediaQuery.sizeOf(context).width)
                          .clamp(1, height * 4 / 3) *
                      MediaQuery.devicePixelRatioOf(context))
                  .ceil()
                  .clamp(1, 900),
          errorBuilder: (_, _, _) =>
              const Center(child: DietIcon(DietIconKind.plan, size: 64)),
        ),
      ),
    ),
  );
}
