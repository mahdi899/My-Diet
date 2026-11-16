import 'package:flutter/material.dart';
import '../../core/theme/tokens.dart';
import '../widgets/brand_mark.dart';
import 'kit/app_card.dart';

/// Light login canvas: leaf mark, short title, card, keyboard-safe scroll.
class AuthCanvas extends StatelessWidget {
  const AuthCanvas({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
    this.onBack,
    this.backTooltip,
    this.footer,
  });

  final String title;
  final String subtitle;
  final Widget child;
  final VoidCallback? onBack;
  final String? backTooltip;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewInsetsOf(context).bottom;
    return Scaffold(
      backgroundColor: AppColors.bg,
      resizeToAvoidBottomInset: true,
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppGradients.warmBackground),
        child: SafeArea(
          child: Column(
            children: [
              SizedBox(
                height: 48,
                child: Row(
                  children: [
                    if (backTooltip != null)
                      IconButton(
                        tooltip: backTooltip,
                        onPressed: onBack,
                        icon: const Icon(Icons.arrow_back_rounded),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(24, 0, 24, 28 + inset),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 440),
                      child: Column(
                        children: [
                          const SabzineMark(size: 76),
                          const SizedBox(height: 10),
                          const BrandWordmark(width: 120),
                          const SizedBox(height: 28),
                          Text(
                            title,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            subtitle,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: AppColors.muted,
                              height: 1.7,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 22),
                          AppCard(child: child),
                          if (footer != null) ...[
                            const SizedBox(height: 8),
                            footer!,
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
