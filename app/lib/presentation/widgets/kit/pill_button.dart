import 'package:flutter/material.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

enum PillVariant { primary, lime, amber, soft, outline, dark }

/// Shared CTA with native focus states and a height that grows with text.
class PillButton extends StatelessWidget {
  const PillButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.iconWidget,
    this.trailingIcon,
    this.variant = PillVariant.primary,
    this.loading = false,
    this.expanded = true,
    this.height = AppSpacing.controlHeight,
  }) : assert(icon == null || iconWidget == null);
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon, trailingIcon;
  final Widget? iconWidget;
  final PillVariant variant;
  final bool loading, expanded;
  final double height;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (variant) {
      PillVariant.primary => (AppColors.emeraldDeep, Colors.white),
      PillVariant.lime => (AppColors.lime, AppColors.emeraldDark),
      PillVariant.amber => (AppColors.amber, AppColors.ink),
      PillVariant.soft => (AppColors.mint, AppColors.emeraldDark),
      PillVariant.outline => (Colors.transparent, AppColors.emeraldDeep),
      PillVariant.dark => (AppColors.ink, Colors.white),
    };
    final enabled = onPressed != null && !loading;
    final content = loading
        ? Semantics(
            label: '$label؛ در حال انجام',
            liveRegion: true,
            child: SizedBox.square(
              dimension: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: fg),
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (iconWidget != null || icon != null) ...[
                if (iconWidget != null) iconWidget! else Icon(icon, size: 20),
                const SizedBox(width: 8),
              ],
              Flexible(child: Text(label, textAlign: TextAlign.center)),
              if (trailingIcon != null) ...[
                const SizedBox(width: 8),
                Icon(trailingIcon, size: 20),
              ],
            ],
          );
    void activate() {
      Haptics.tap();
      onPressed!();
    }

    final style = FilledButton.styleFrom(
      backgroundColor: bg,
      foregroundColor: fg,
      disabledBackgroundColor: loading ? bg : AppColors.disabled,
      disabledForegroundColor: AppColors.onDisabled,
      minimumSize: Size(
        0,
        height < AppSpacing.touchTarget ? AppSpacing.touchTarget : height,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      textStyle: AppTypography.button,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.control),
      ),
    );
    final Widget button = variant == PillVariant.outline
        ? OutlinedButton(
            onPressed: enabled ? activate : null,
            style: style.copyWith(
              side: WidgetStateProperty.resolveWith(
                (states) => BorderSide(
                  color: states.contains(WidgetState.disabled)
                      ? AppColors.disabled
                      : AppColors.selectedLine,
                ),
              ),
            ),
            child: content,
          )
        : FilledButton(
            onPressed: enabled ? activate : null,
            style: style,
            child: content,
          );
    return expanded ? SizedBox(width: double.infinity, child: button) : button;
  }
}
