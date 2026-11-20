import 'package:flutter/material.dart';

import '../../core/icons/diet_icon.dart';
import '../../core/theme/theme.dart';
import '../../data/wallet_catalog.dart' show formatToman;
import '../../domain/commerce/commerce.dart';
import '../../domain/common/digits.dart';

/// A plan's displayed amount and benefits come from the same offer used by checkout.
class SubscriptionPlanCard extends StatelessWidget {
  const SubscriptionPlanCard({
    super.key,
    required this.plan,
    required this.selected,
    required this.onSelect,
    this.membershipLabel,
  });
  final SubscriptionPlanOffer plan;
  final bool selected;
  final VoidCallback? onSelect;
  final String? membershipLabel;

  DietIconKind get _icon => switch (plan.id) {
    'monthly' => DietIconKind.leaf,
    'quarterly' => DietIconKind.balancedMeal,
    _ => DietIconKind.firstPlan,
  };

  void _details(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: Colors.white,
    builder: (context) => SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 4, 24, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('امکانات پلن ${plan.title}', style: AppTypography.sectionTitle),
          const SizedBox(height: 6),
          Text(
            '${fa(plan.days)} روزه · ${formatToman(plan.priceToman)}',
            style: AppTypography.supporting,
          ),
          const SizedBox(height: 16),
          if (plan.description.trim().isNotEmpty) ...[
            Text(plan.description, style: AppTypography.supporting),
            const SizedBox(height: 12),
          ],
          for (final feature in plan.features)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const ExcludeSemantics(
                    child: Icon(
                      Icons.check_circle_outline_rounded,
                      size: 20,
                      color: AppColors.emeraldDeep,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Text(feature, style: AppTypography.body)),
                ],
              ),
            ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('بستن'),
          ),
        ],
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(22),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0945391E),
          blurRadius: 16,
          offset: Offset(0, 5),
        ),
      ],
    ),
    child: Material(
      color: selected ? const Color(0xFFF0F7EB) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: BorderSide(
          color: selected ? const Color(0xFF07543A) : const Color(0xFFF0ECE2),
          width: selected ? 1.8 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Semantics(
        selected: selected,
        checked: selected,
        inMutuallyExclusiveGroup: true,
        child: InkWell(
          onTap: onSelect,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (membershipLabel != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      membershipLabel!,
                      style: AppTypography.supporting,
                    ),
                  ),
                Row(
                  children: [
                    ExcludeSemantics(
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: plan.id == 'quarterly'
                              ? const Color(0xFFF6EEDB)
                              : const Color(0xFFE5F0D8),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Center(child: DietIcon(_icon, size: 25)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            'پلن ${plan.title}',
                            style: const TextStyle(
                              color: Color(0xFF07543A),
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              height: 1.6,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 9,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEDF3E3),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              '${fa(plan.days)} روزه',
                              style: const TextStyle(
                                color: Color(0xFF48653F),
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    ExcludeSemantics(
                      child: Icon(
                        selected
                            ? Icons.check_circle_rounded
                            : Icons.radio_button_unchecked,
                        color: selected
                            ? const Color(0xFF07543A)
                            : AppColors.muted,
                        size: 24,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 2,
                  children: [
                    Text(
                      formatToman(plan.priceToman),
                      style: const TextStyle(
                        color: Color(0xFF07543A),
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        height: 1.5,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    TextButton(
                      onPressed: onSelect == null
                          ? null
                          : () => _details(context),
                      style: TextButton.styleFrom(
                        minimumSize: const Size(48, 48),
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        foregroundColor: AppColors.inkSoft,
                        textStyle: AppTypography.button.copyWith(fontSize: 11),
                      ),
                      child: const Text('امکانات پلن'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
