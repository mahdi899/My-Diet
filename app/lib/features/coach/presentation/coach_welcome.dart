import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import 'coach_companion.dart';

class CoachWelcome extends StatelessWidget {
  const CoachWelcome({super.key, required this.mood, required this.cue});

  final CompanionMood mood;
  final int cue;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) => SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: constraints.maxHeight > 48
              ? constraints.maxHeight - 48
              : 0,
        ),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 340),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ExcludeSemantics(
                  child: DecoratedBox(
                    decoration: const BoxDecoration(
                      color: AppColors.mint,
                      shape: BoxShape.circle,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: CoachCompanion(size: 108, mood: mood, cue: cue),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Semantics(
                  header: true,
                  child: const Text(
                    'من مربی تغذیهٔ توام',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.emeraldDark,
                      height: 1.5,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'از غذای امروزت بگو یا سؤالت رو بپرس؛ با هم قدم بعدی رو پیدا می‌کنیم.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.9,
                    color: AppColors.inkSoft,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
