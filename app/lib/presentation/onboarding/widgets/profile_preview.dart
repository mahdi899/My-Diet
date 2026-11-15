import 'package:flutter/material.dart';

import '../../../core/format/digits.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';
import '../../../domain/onboarding/spec.dart';
import '../controller.dart';

/// This is a view of the canonical answers, never a second profile model.
class OnboardingProfilePreview extends StatelessWidget {
  const OnboardingProfilePreview({
    super.key,
    required this.controller,
    required this.onRevisit,
  });
  final OnboardingController controller;
  final ValueChanged<String> onRevisit;

  List<SpecQuestion> get _answered => controller.track == null
      ? []
      : [
          for (final question in controller.spec.active(
            controller.track!,
            controller.answers,
          ))
            if (controller.spec.isAnswered(question, controller.answers))
              question,
        ];

  String _value(SpecQuestion q) {
    final value = controller.answer(q.key);
    String option(Object? code) => q.option(code.toString())?.label ?? fa(code);
    if (value is List) return value.map(option).join('، ');
    if (value is num) {
      final prefix = switch (q.key) {
        'target_weight_kg' => 'هدف ',
        'weight_kg' => 'وزن ',
        'height_cm' => 'قد ',
        'age' => 'سن ',
        _ => '',
      };
      return '$prefix${faNumber(value)}${q.unit == null ? '' : ' ${q.unit}'}';
    }
    if (q.kind == QuestionKind.sleepWake && value is Map) {
      return 'خواب ${fa(value['sleep'])} · بیداری ${fa(value['wake'])}';
    }
    return option(value);
  }

  void _open(BuildContext context) {
    final answered = _answered;
    final track = controller.spec.track(controller.track);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.surfaceWarm,
      builder: (sheet) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(sheet).height * .75,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'پروفایل در حال ساخت تو',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'بستن خلاصهٔ پروفایل',
                      onPressed: () => Navigator.pop(sheet),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    if (track != null)
                      ListTile(
                        leading: const Icon(
                          Icons.flag_outlined,
                          color: AppColors.emeraldDeep,
                        ),
                        title: const Text('مسیر انتخابی'),
                        subtitle: Text(track.title),
                        trailing: controller.steps.any((s) => s is TrackStep)
                            ? const Icon(Icons.edit_outlined, size: 18)
                            : null,
                        onTap: controller.steps.any((s) => s is TrackStep)
                            ? () {
                                Navigator.pop(sheet);
                                onRevisit('_track');
                              }
                            : null,
                      ),
                    for (final q in answered)
                      ListTile(
                        title: Text(
                          q.title,
                          style: const TextStyle(fontSize: 13),
                        ),
                        subtitle: Text(
                          _value(q),
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: AppColors.emeraldDark,
                          ),
                        ),
                        trailing: const Icon(Icons.edit_outlined, size: 18),
                        onTap: () {
                          Navigator.pop(sheet);
                          onRevisit(q.key);
                        },
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final track = controller.spec.track(controller.track);
    if (track == null) return const SizedBox.shrink();
    final answers = _answered;
    final snippets = answers
        .where((q) => q.kind != QuestionKind.text)
        .toList()
        .reversed
        .take(2)
        .map(_value)
        .toList();
    final compact =
        MediaQuery.viewInsetsOf(context).bottom > 0 ||
        MediaQuery.sizeOf(context).height < 650;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
      child: Material(
        color: AppColors.mint,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          key: const ValueKey('onboarding-profile-preview'),
          borderRadius: BorderRadius.circular(20),
          onTap: () => _open(context),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 3),
                  child: Icon(
                    Icons.spa_outlined,
                    color: AppColors.emeraldDeep,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'پروفایل تو، قدم‌به‌قدم',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.emeraldDark,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const Icon(
                            Icons.edit_outlined,
                            size: 15,
                            color: AppColors.emeraldDeep,
                          ),
                        ],
                      ),
                      if (!compact) ...[
                        const SizedBox(height: 4),
                        AnimatedSwitcher(
                          duration: Motion.of(context, Motion.quick),
                          child: Align(
                            key: ValueKey('${track.id}-${snippets.join()}'),
                            alignment: AlignmentDirectional.centerStart,
                            child: Text(
                              [track.title, ...snippets].join(' · '),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                height: 1.8,
                                color: AppColors.inkSoft,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${fa(answers.length)} پاسخ در مسیرت ثبت شده · برای مرور لمس کن',
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppColors.emeraldDeep,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
