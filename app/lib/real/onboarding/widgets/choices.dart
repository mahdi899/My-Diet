import 'package:flutter/material.dart';
import '../../../theme.dart';
import '../../core/motion.dart';
import '../spec.dart';

/// A big tappable answer. Selection scales it slightly, fills the border and shows a check.
class OptionCard extends StatelessWidget {
  const OptionCard({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
    this.multi = false,
    this.caption,
  });
  final String label;
  final String? caption;
  final bool selected, multi;
  final IconData? icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => AnimatedScale(
    scale: selected ? 1.015 : 1,
    duration: Motion.quick,
    curve: Motion.spring,
    child: Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? sage : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(
            color: selected ? pine : const Color(0xFFDDE5D4),
            width: selected ? 2 : 1,
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () {
            Haptics.tap();
            onTap();
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
            child: Row(
              children: [
                if (icon != null) ...[
                  Icon(icon, color: selected ? pine : muted),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: selected
                              ? FontWeight.bold
                              : FontWeight.w500,
                          color: ink,
                        ),
                      ),
                      if (caption != null)
                        Text(
                          caption!,
                          style: const TextStyle(color: muted, fontSize: 12),
                        ),
                    ],
                  ),
                ),
                AnimatedContainer(
                  duration: Motion.quick,
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    shape: multi ? BoxShape.rectangle : BoxShape.circle,
                    borderRadius: multi ? BorderRadius.circular(7) : null,
                    color: selected ? pine : Colors.transparent,
                    border: Border.all(
                      color: selected ? pine : const Color(0xFFB7C9A1),
                      width: 1.6,
                    ),
                  ),
                  child: AnimatedOpacity(
                    opacity: selected ? 1 : 0,
                    duration: Motion.quick,
                    child: const Icon(
                      Icons.check,
                      size: 16,
                      color: Colors.white,
                    ),
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
                    decoration: InputDecoration(hintText: follow.placeholder),
                  ),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}
