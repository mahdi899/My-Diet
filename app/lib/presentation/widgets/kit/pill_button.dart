import 'package:flutter/material.dart';
import '../../../core/theme/tokens.dart';
import 'pressable_scale.dart';

enum PillVariant { primary, lime, amber, soft, outline, dark }

/// Fully rounded button with gradient CTA styles, press scale and a loading
/// state. Disabled when [onPressed] is null.
class PillButton extends StatelessWidget {
  const PillButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.trailingIcon,
    this.variant = PillVariant.primary,
    this.loading = false,
    this.expanded = true,
    this.height = 54,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final IconData? trailingIcon;
  final PillVariant variant;
  final bool loading;

  /// Fill the available width.
  final bool expanded;
  final double height;

  bool get _enabled => onPressed != null && !loading;

  @override
  Widget build(BuildContext context) {
    final (Gradient? g, Color bg, Color fg, List<BoxShadow> sh, Border? bd) =
        switch (variant) {
          PillVariant.primary => (
            AppGradients.cta,
            AppColors.emerald,
            Colors.white,
            AppShadows.cta,
            null,
          ),
          PillVariant.lime => (
            AppGradients.lime,
            AppColors.lime,
            AppColors.emeraldDark,
            AppShadows.cta,
            null,
          ),
          PillVariant.amber => (
            AppGradients.amber,
            AppColors.amber,
            AppColors.ink,
            const <BoxShadow>[],
            null,
          ),
          PillVariant.soft => (
            null,
            AppColors.mint,
            AppColors.emeraldDeep,
            const <BoxShadow>[],
            null,
          ),
          PillVariant.outline => (
            null,
            Colors.transparent,
            AppColors.emeraldDeep,
            const <BoxShadow>[],
            Border.all(color: const Color(0xFFCFE3D6), width: 1.4),
          ),
          PillVariant.dark => (
            null,
            AppColors.ink,
            Colors.white,
            AppShadows.soft,
            null,
          ),
        };
    final content = AnimatedSwitcher(
      duration: const Duration(milliseconds: 180),
      child: loading
          ? SizedBox(
              key: const ValueKey('l'),
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: fg),
            )
          : Row(
              key: const ValueKey('t'),
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 20, color: fg),
                  const SizedBox(width: 8),
                ],
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: fg,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      height: 1.4,
                    ),
                  ),
                ),
                if (trailingIcon != null) ...[
                  const SizedBox(width: 8),
                  Icon(trailingIcon, size: 20, color: fg),
                ],
              ],
            ),
    );
    final body = AnimatedOpacity(
      opacity: onPressed == null && !loading ? 0.45 : 1,
      duration: const Duration(milliseconds: 180),
      child: Container(
        height: height,
        padding: const EdgeInsets.symmetric(horizontal: 26),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: g,
          color: g == null ? bg : null,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          boxShadow: _enabled ? sh : const [],
          border: bd,
        ),
        child: content,
      ),
    );
    final button = PressableScale(
      onTap: _enabled ? onPressed : null,
      scale: 0.97,
      semanticLabel: label,
      child: body,
    );
    return expanded
        ? SizedBox(width: double.infinity, child: button)
        : IntrinsicWidth(child: button);
  }
}
