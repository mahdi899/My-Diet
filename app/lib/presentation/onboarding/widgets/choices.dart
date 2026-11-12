import 'package:flutter/material.dart';
import '../../../core/motion/motion.dart';
import '../../../domain/onboarding/spec.dart';
import 'decor_photo.dart';

/// A big tappable answer. The photo is decoration; [label] is the answer.
class OptionCard extends StatelessWidget {
  const OptionCard({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
    this.multi = false,
    this.caption,
    this.photoKey,
  });
  final String label;
  final String? caption;
  final String? photoKey;
  final bool selected, multi;
  final IconData? icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => PhotoOptionCard(
    label: label,
    subtitle: caption,
    photoKey: photoKey ?? label,
    selected: selected,
    onTap: onTap,
    icon: icon,
    multi: multi,
  );
}

/// One-of-many question.
class SingleChoice extends StatelessWidget {
  const SingleChoice({
    super.key,
    required this.question,
    required this.value,
    required this.onChanged,
  });
  final SpecQuestion question;
  final String? value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
    itemCount: question.options.length,
    separatorBuilder: (_, _) => const SizedBox(height: 10),
    itemBuilder: (context, i) {
      final o = question.options[i];
      return Reveal(
        index: i,
        child: OptionCard(
          label: o.label,
          photoKey: o.image ?? o.code,
          selected: value == o.code,
          onTap: () => onChanged(o.code),
        ),
      );
    },
  );
}

/// Many-of-many question. An exclusive option (like "none") clears the rest and vice versa.
class MultiChoice extends StatelessWidget {
  const MultiChoice({
    super.key,
    required this.question,
    required this.value,
    required this.onChanged,
    this.followUpValue,
    this.onFollowUp,
  });
  final SpecQuestion question;
  final List<String> value;
  final ValueChanged<List<String>> onChanged;
  final String? followUpValue;
  final ValueChanged<String>? onFollowUp;

  void _toggle(SpecOption o) {
    final next = [...value];
    if (next.contains(o.code)) {
      next.remove(o.code);
    } else if (o.exclusive) {
      next
        ..clear()
        ..add(o.code);
    } else {
      next.removeWhere((c) => question.option(c)?.exclusive == true);
      next.add(o.code);
    }
    onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final follow = question.followUp;
    final showFollow = follow != null && value.any(follow.whenCodes.contains);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      children: [
        for (var i = 0; i < question.options.length; i++) ...[
          Reveal(
            index: i,
            child: OptionCard(
              label: question.options[i].label,
              photoKey: question.options[i].image ?? question.options[i].code,
              multi: true,
              selected: value.contains(question.options[i].code),
              onTap: () => _toggle(question.options[i]),
            ),
          ),
          const SizedBox(height: 10),
        ],
        AnimatedSize(
          duration: Motion.base,
          curve: Motion.curve,
          child: showFollow
              ? Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: TextFormField(
                    key: ValueKey(follow.key),
                    initialValue: followUpValue,
                    onChanged: onFollowUp,
                    maxLength: 200,
                    scrollPadding: const EdgeInsets.only(bottom: 140),
                    decoration: InputDecoration(hintText: follow.placeholder),
                  ),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}
