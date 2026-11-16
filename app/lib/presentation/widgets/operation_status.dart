import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import 'kit/app_card.dart';

enum OperationTone { waiting, success, attention, error }

/// Shared visual language for real operation states. It never advances a
/// workflow or marks work complete on an animation timer.
class OperationStatus extends StatelessWidget {
  const OperationStatus({
    super.key,
    required this.title,
    required this.message,
    required this.icon,
    this.tone = OperationTone.waiting,
    this.actionLabel,
    this.onAction,
    this.busy = false,
    this.child,
    this.iconWidget,
  });
  final String title, message;
  final IconData icon;
  final OperationTone tone;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool busy;
  final Widget? child;
  final Widget? iconWidget;

  @override
  Widget build(BuildContext context) {
    final color = switch (tone) {
      OperationTone.error => AppColors.danger,
      OperationTone.attention => AppColors.inkSoft,
      _ => AppColors.emeraldDeep,
    };
    return AppCard(
      shadows: const [],
      border: Border.all(color: AppColors.line),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: tone == OperationTone.error
                      ? AppColors.danger.withValues(alpha: .08)
                      : AppColors.mint,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Center(
                  child: iconWidget ?? Icon(icon, color: color, size: 26),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Semantics(
                      header: true,
                      liveRegion:
                          tone == OperationTone.error ||
                          tone == OperationTone.success,
                      child: Text(
                        title,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: color,
                          height: 1.6,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      message,
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.inkSoft,
                        height: 1.9,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (child != null) ...[const SizedBox(height: 20), child!],
          if (actionLabel != null) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: busy ? null : onAction,
              icon: busy
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.arrow_back_rounded, size: 19),
              label: Text(
                busy ? 'در حال بررسی…' : actionLabel!,
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Completed and current stages come from server state, never elapsed time.
class OperationPath extends StatelessWidget {
  const OperationPath({super.key, required this.labels, required this.current});
  final List<String> labels;

  /// labels.length means every stage has actually completed.
  final int current;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var i = 0; i < labels.length; i++)
        Padding(
          padding: EdgeInsets.only(bottom: i == labels.length - 1 ? 0 : 16),
          child: Semantics(
            label:
                '${labels[i]}، ${i < current
                    ? 'انجام شده'
                    : i == current
                    ? 'مرحلهٔ فعلی'
                    : 'در ادامه'}',
            excludeSemantics: true,
            child: Row(
              children: [
                Icon(
                  i < current
                      ? Icons.check_circle_rounded
                      : i == current
                      ? Icons.radio_button_checked_rounded
                      : Icons.circle_outlined,
                  size: 22,
                  color: i <= current ? AppColors.emeraldDeep : AppColors.faint,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    labels[i],
                    style: TextStyle(
                      color: i <= current ? AppColors.ink : AppColors.inkSoft,
                      fontWeight: i == current
                          ? FontWeight.bold
                          : FontWeight.normal,
                    ),
                  ),
                ),
                if (i == current)
                  const Text(
                    'اکنون',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.emeraldDeep,
                    ),
                  ),
              ],
            ),
          ),
        ),
    ],
  );
}
