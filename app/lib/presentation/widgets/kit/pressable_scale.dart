import 'package:flutter/material.dart';
import '../../../core/motion/motion.dart';

/// Springy press feedback (scale-down + haptic) for anything tappable.
class PressableScale extends StatefulWidget {
  const PressableScale({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scale = 0.96,
    this.haptic = true,
    this.enabled = true,
    this.semanticLabel,
    this.behavior = HitTestBehavior.opaque,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// Scale while pressed (0.9 – 1).
  final double scale;

  /// Fire a selection haptic on tap.
  final bool haptic;
  final bool enabled;
  final String? semanticLabel;
  final HitTestBehavior behavior;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _down = false;

  bool get _active =>
      widget.enabled && (widget.onTap != null || widget.onLongPress != null);

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final reduce = Motion.reduced(context);
    Widget out = AnimatedScale(
      scale: _down && !reduce ? widget.scale : 1,
      duration: reduce ? Duration.zero : const Duration(milliseconds: 130),
      curve: Curves.easeOutCubic,
      child: widget.child,
    );
    if (!_active) return out;
    out = GestureDetector(
      behavior: widget.behavior,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: widget.onTap == null
          ? null
          : () {
              if (widget.haptic) Haptics.tap();
              widget.onTap!();
            },
      onLongPress: widget.onLongPress == null
          ? null
          : () {
              if (widget.haptic) Haptics.confirm();
              widget.onLongPress!();
            },
      child: out,
    );
    return Semantics(
      button: true,
      enabled: widget.enabled,
      label: widget.semanticLabel,
      child: out,
    );
  }
}
