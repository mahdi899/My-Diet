import 'package:flutter/material.dart';
import '../../../core/format/digits.dart';
import '../../../core/theme/tokens.dart';

/// Remaining coach messages, shown above the thread when the server reports a quota.
class QuotaIndicator extends StatelessWidget {
  const QuotaIndicator({
    super.key,
    required this.dailyRemaining,
    required this.dailyLimit,
    required this.periodRemaining,
    this.onBuyMore,
  });

  final int dailyRemaining;
  final int dailyLimit;
  final int periodRemaining;
  final VoidCallback? onBuyMore;

  @override
  Widget build(BuildContext context) {
    final urgent = dailyRemaining <= 2 || periodRemaining <= 5;
    final foreground = urgent ? AppColors.warningInk : Colors.white;

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: urgent ? AppColors.warningSurface : AppColors.emeraldDark,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: urgent ? Border.all(color: AppColors.amber) : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(Icons.chat_bubble_outline_rounded, size: 20, color: foreground),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${faNumber(dailyRemaining)} از ${faNumber(dailyLimit)} پیام امروز باقی مونده',
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.7,
                    color: foreground,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (periodRemaining < dailyLimit)
                  Text(
                    '${faNumber(periodRemaining)} پیام باقی‌مانده در این دوره',
                    style: TextStyle(
                      fontSize: 11,
                      height: 1.7,
                      color: foreground.withValues(alpha: .85),
                    ),
                  ),
              ],
            ),
          ),
          if (urgent && onBuyMore != null) ...[
            const SizedBox(width: 8),
            TextButton(
              onPressed: onBuyMore,
              style: TextButton.styleFrom(
                foregroundColor: foreground,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('خرید بسته', style: TextStyle(fontSize: 12)),
            ),
          ],
        ],
      ),
    );
  }
}
