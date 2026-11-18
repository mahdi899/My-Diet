import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';

/// Matches the native launch surface while the saved session is restored.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      const Scaffold(backgroundColor: AppColors.bg, body: SizedBox.expand());
}
