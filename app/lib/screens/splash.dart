import 'package:flutter/material.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';

/// Intentionally only a logo: no title, caption, spinner or progress text.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(
    backgroundColor: sage,
    body: Center(child: SabzineMark()),
  );
}
