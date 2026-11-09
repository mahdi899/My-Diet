import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

/// Full-screen coach entrance: a circle grows from the tab button, with a
/// slight scale. Reduced motion fades instead.
Route<void> coachRevealRoute(Widget page) {
  return PageRouteBuilder<void>(
    opaque: false,
    barrierColor: const Color(0x00000000),
    transitionDuration: Motion.page,
    reverseTransitionDuration: Motion.base,
    pageBuilder: (_, _, _) => page,
    transitionsBuilder: (context, animation, _, child) {
      if (Motion.reduced(context)) {
        return FadeTransition(opacity: animation, child: child);
      }
      final curved = CurvedAnimation(
        parent: animation,
        curve: Motion.emphasized,
      );
      return AnimatedBuilder(
        animation: curved,
        builder: (context, child) {
          final t = curved.value.clamp(0.001, 1.0);
          return ClipPath(
            clipper: _CircleRevealClipper(t),
            child: Transform.scale(
              scale: 0.94 + (0.06 * t),
              alignment: Alignment.bottomRight,
              child: child,
            ),
          );
        },
        child: child,
      );
    },
  );
}

class _CircleRevealClipper extends CustomClipper<Path> {
  _CircleRevealClipper(this.t);
  final double t;

  @override
  Path getClip(Size size) {
    final origin = Offset(size.width - 46, size.height - 52);
    final radius =
        math.sqrt(size.width * size.width + size.height * size.height) * t;
    return Path()..addOval(Rect.fromCircle(center: origin, radius: radius));
  }

  @override
  bool shouldReclip(_CircleRevealClipper oldClipper) => oldClipper.t != t;
}
