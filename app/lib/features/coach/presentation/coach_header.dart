import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import 'coach_companion.dart';

class CoachHeader extends StatelessWidget {
  const CoachHeader({
    super.key,
    required this.typing,
    required this.onClose,
    required this.onAvatar,
    this.mood = CompanionMood.calm,
    this.cue = 0,
    this.onGreet,
  });
  final bool typing;
  final CompanionMood mood;
  final int cue;
  final VoidCallback? onGreet;
  final VoidCallback onClose, onAvatar;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(12, 7, 16, 11),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: AppColors.line)),
    ),
    child: Row(
      children: [
        IconButton(
          key: const ValueKey('coach-companion-greet'),
          tooltip: 'سلام به جوانه',
          padding: EdgeInsets.zero,
          onPressed: onGreet,
          icon: ExcludeSemantics(
            child: CoachCompanion(size: 56, cue: cue, mood: mood),
          ),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'مربی رژیم من',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 17,
                  color: AppColors.emeraldDark,
                  height: 1.5,
                ),
              ),
              Text(
                switch (mood) {
                  CompanionMood.thinking => 'در حال نوشتن…',
                  CompanionMood.celebrate => 'ثبتت انجام شد؛ آفرین به پیگیریت',
                  CompanionMood.greeting => 'جوانه؛ همراه کوچک تو',
                  CompanionMood.reply => 'جوابت اینجاست؛ با هم ادامه بدیم',
                  CompanionMood.support => 'کنارت هستم؛ قدم‌به‌قدم',
                  CompanionMood.calm => 'جوانه · دستیار هوشمند تغذیه',
                },
                style: const TextStyle(
                  fontSize: 11,
                  height: 1.7,
                  color: AppColors.inkSoft,
                ),
              ),
            ],
          ),
        ),
        IconButton(
          key: const ValueKey('coach-avatar'),
          tooltip: 'پروفایل',
          onPressed: onAvatar,
          icon: const Icon(
            Icons.person_outline_rounded,
            color: AppColors.emeraldDark,
            size: 23,
          ),
        ),
        IconButton(
          key: const ValueKey('coach-close'),
          tooltip: 'بستن',
          onPressed: onClose,
          icon: const Icon(
            Icons.close_rounded,
            color: AppColors.emeraldDark,
            size: 23,
          ),
        ),
      ],
    ),
  );
}
