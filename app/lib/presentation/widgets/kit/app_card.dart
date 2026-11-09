import 'package:flutter/material.dart';
import '../../../core/theme/tokens.dart';
import 'pressable_scale.dart';

/// The standard «رژیم من» surface: white, 28px radius, soft shadow.
/// Pass [onTap] to make it press-scalable.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.margin,
    this.radius = AppRadius.xl,
    this.color = AppColors.surface,
    this.gradient,
    this.shadows = AppShadows.soft,
    this.border,
    this.onTap,
    this.clip = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final double radius;
  final Color color;
  final Gradient? gradient;
  final List<BoxShadow> shadows;
  final BoxBorder? border;
  final VoidCallback? onTap;

  /// Clip children to the rounded rect (needed for edge-to-edge images).
  final bool clip;

  /// Tinted flat card (mint) without a shadow.
  const AppCard.tinted({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.margin,
    this.radius = AppRadius.xl,
    this.color = AppColors.mint,
    this.onTap,
    this.clip = false,
  }) : gradient = null,
       shadows = const [],
       border = null;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius);
    Widget body = Padding(padding: padding, child: child);
    if (clip) body = ClipRRect(borderRadius: r, child: body);
    // Material sits inside the painted card so ListTile ink is not hidden.
    body = Material(color: Colors.transparent, child: body);
    Widget out = DecoratedBox(
      decoration: BoxDecoration(
        color: gradient == null ? color : null,
        gradient: gradient,
        borderRadius: r,
        boxShadow: shadows,
        border: border,
      ),
      child: body,
    );
    if (onTap != null) out = PressableScale(onTap: onTap, child: out);
    if (margin != null) out = Padding(padding: margin!, child: out);
    return out;
  }
}
