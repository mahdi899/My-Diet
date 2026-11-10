import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../../presentation/widgets/kit/kit.dart';
import '../../../presentation/widgets/ui.dart';

class CoachHeader extends StatelessWidget {
  const CoachHeader({
    super.key,
    required this.typing,
    required this.onClose,
    required this.onAvatar,
    required this.onRing,
  });

  final bool typing;
  final VoidCallback onClose;
  final VoidCallback onAvatar;
  final VoidCallback onRing;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final name = store.userSignedIn ? store.questionnaire.name : 'مهمان';
    return GlassBar(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      radius: AppRadius.xxl,
      child: Row(
        children: [
          PressableScale(
            semanticLabel: 'پروفایل',
            onTap: onAvatar,
            child: KeyedSubtree(
              key: const ValueKey('coach-avatar'),
              child: PersonAvatar(name, size: 42, color: AppColors.mint),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'مربی رژیم من',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: AppColors.ink,
                    height: 1.4,
                  ),
                ),
                Text(
                  typing ? 'در حال نوشتن…' : 'همراه تغذیهٔ تو',
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.6,
                    color: typing ? AppColors.emeraldDeep : AppColors.muted,
                  ),
                ),
              ],
            ),
          ),
          PressableScale(
            semanticLabel: 'حلقهٔ امروز',
            onTap: onRing,
            child: const _TodayChip(),
          ),
          IconButton(
            key: const ValueKey('coach-close'),
            tooltip: 'بستن',
            onPressed: onClose,
            icon: const Icon(Icons.close_rounded, color: AppColors.inkSoft),
          ),
        ],
      ),
    );
  }
}

class _TodayChip extends StatelessWidget {
  const _TodayChip();

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final goal = store.calorieTarget(store.today);
    final safe = goal <= 0 ? 1 : goal;
    final eaten = store.consumedCalories(store.today);
    return SizedBox(
      key: const ValueKey('coach-today'),
      width: 42,
      height: 42,
      child: Ring(
        value: eaten / safe,
        size: 42,
        strokeWidth: 4,
        duration: Motion.base,
        child: const Icon(
          Icons.bolt_rounded,
          size: 16,
          color: AppColors.emeraldDeep,
        ),
      ),
    );
  }
}
