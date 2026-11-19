import 'package:flutter/material.dart';
import '../../../core/format/digits.dart';

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
    final color = urgent ? Colors.orange : Colors.grey;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Icon(Icons.chat_bubble_outline, size: 14, color: color),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              '${faNumber(dailyRemaining)} از ${faNumber(dailyLimit)} پیام امروز باقی مونده',
              style: TextStyle(
                fontSize: 12,
                color: color,
                fontWeight: urgent ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
          const SizedBox(width: 8),
          if (periodRemaining < dailyLimit)
            Text(
              '${faNumber(periodRemaining)} در دوره',
              style: TextStyle(fontSize: 11, color: Colors.grey[600]),
            ),
          if (urgent && onBuyMore != null) ...[
            const SizedBox(width: 8),
            TextButton(
              onPressed: onBuyMore,
              style: TextButton.styleFrom(
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
