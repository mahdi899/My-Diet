import 'dart:ui';
import 'package:flutter/material.dart';
import '../../../core/theme/tokens.dart';

/// Frosted-glass bar/panel: blurred backdrop, translucent white, hairline
/// border. Sits over photos/lists for headers, bottom bars and chips.
class GlassBar extends StatelessWidget {
  const GlassBar({
    super.key,
    required this.child,
    this.height,
    this.padding = const EdgeInsets.symmetric(horizontal: 16),
    this.margin,
    this.radius = AppRadius.xl,
    this.blur = 20,
    this.tint = const Color(0xB8FFFFFF),
    this.shadows = AppShadows.soft,
  });

  final Widget child;
  final double? height;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final double radius;
  final double blur;
  final Color tint;
  final List<BoxShadow> shadows;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius);
    Widget out = DecoratedBox(
      decoration: BoxDecoration(borderRadius: r, boxShadow: shadows),
      child: ClipRRect(
        borderRadius: r,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: Container(
            height: height,
            padding: padding,
            decoration: BoxDecoration(
              color: tint,
              borderRadius: r,
              border: Border.all(color: const Color(0x80FFFFFF), width: 1),
            ),
            child: child,
          ),
        ),
      ),
    );
    if (margin != null) out = Padding(padding: margin!, child: out);
    return out;
  }
}
