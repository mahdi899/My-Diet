import 'package:flutter/material.dart';
import '../../../core/theme/theme.dart';
import '../../../core/format/digits.dart';
import '../../../core/motion/motion.dart';
import '../../../domain/onboarding/spec.dart';
import 'frame.dart';

IconData insightIcon(String name) => switch (name) {
  'scale' => Icons.monitor_weight_outlined,
  'bowl' => Icons.rice_bowl_outlined,
  'shield' => Icons.verified_user_outlined,
  _ => Icons.auto_awesome,
};

IconData trackIcon(String id) => switch (id) {
  'weight_loss' => Icons.trending_down_rounded,
  'weight_gain' => Icons.trending_up_rounded,
  'pregnancy' => Icons.pregnant_woman_rounded,
  _ => Icons.spa_outlined,
};

/// A short pause between questions that tells the person why their answers matter.
class InsightInterstitial extends StatelessWidget {
  const InsightInterstitial({super.key, required this.insight});
  final SpecInsight insight;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 28),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.6, end: 1),
          duration: Motion.slow,
          curve: Motion.spring,
          builder: (context, s, child) =>
              Transform.scale(scale: s, child: child),
          child: Container(
            width: 112,
            height: 112,
            decoration: const BoxDecoration(
              color: sage,
              shape: BoxShape.circle,
            ),
            child: Icon(insightIcon(insight.icon), size: 54, color: pine),
          ),
        ),
        const SizedBox(height: 28),
        Reveal(
          index: 1,
          child: Text(
            insight.title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
        ),
        const SizedBox(height: 12),
        Reveal(
          index: 2,
          child: Text(
            insight.body,
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted, height: 1.9),
          ),
        ),
      ],
    ),
  );
}

/// First step: what is the person here for?
class TrackPicker extends StatelessWidget {
  const TrackPicker({
    super.key,
    required this.tracks,
    required this.value,
    required this.onChanged,
  });
  final List<SpecTrack> tracks;
  final String? value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const QuestionHeader(
        title: 'برای چه هدفی اینجایی؟',
        subtitle: 'برنامهٔ غذایی‌ات حول همین هدف ساخته می‌شود',
      ),
      Expanded(
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          itemCount: tracks.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, i) {
            final t = tracks[i];
            final selected = value == t.id;
            return Reveal(
              index: i,
              child: AnimatedContainer(
                duration: Motion.quick,
                decoration: BoxDecoration(
                  color: selected ? sage : Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: selected ? pine : const Color(0xFFDDE5D4),
                    width: selected ? 2 : 1,
                  ),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () {
                    Haptics.confirm();
                    onChanged(t.id);
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 26,
                          backgroundColor: selected ? pine : sage,
                          child: Icon(
                            trackIcon(t.id),
                            color: selected ? Colors.white : pine,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    t.title,
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFF1D6),
                                      borderRadius: BorderRadius.circular(99),
                                    ),
                                    child: Text(
                                      t.badge,
                                      style: const TextStyle(
                                        fontSize: 10,
                                        color: amber,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                t.description,
                                style: const TextStyle(
                                  color: muted,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    ],
  );
}

/// Free text (name, dislikes).
class TextStepField extends StatefulWidget {
  const TextStepField({
    super.key,
    required this.question,
    required this.value,
    required this.onChanged,
  });
  final SpecQuestion question;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  State<TextStepField> createState() => _TextStepFieldState();
}

class _TextStepFieldState extends State<TextStepField> {
  late final TextEditingController _c = TextEditingController(
    text: widget.value,
  );

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 20),
    child: TextField(
      controller: _c,
      autofocus: widget.question.required,
      maxLength: 120,
      maxLines: widget.question.key == 'dislikes' ? 3 : 1,
      textInputAction: TextInputAction.done,
      onChanged: widget.onChanged,
      decoration: InputDecoration(hintText: widget.question.placeholder),
    ),
  );
}

/// "Pick up to N favourite Iranian dishes" as a wrap of chips with a counter.
class DishPicker extends StatelessWidget {
  const DishPicker({
    super.key,
    required this.question,
    required this.value,
    required this.onChanged,
  });
  final SpecQuestion question;
  final List<String> value;
  final ValueChanged<List<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    final max = (question.max ?? 6).round();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      children: [
        Text(
          '${fa(value.length)} از ${fa(max)} انتخاب شد',
          style: const TextStyle(color: muted, fontSize: 12),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (var i = 0; i < question.options.length; i++)
              Reveal(
                index: i ~/ 3,
                dy: 10,
                child: _DishChip(
                  label: question.options[i].label,
                  selected: value.contains(question.options[i].code),
                  onTap: () {
                    final code = question.options[i].code;
                    final next = [...value];
                    if (next.contains(code)) {
                      next.remove(code);
                    } else if (next.length < max) {
                      next.add(code);
                    } else {
                      Haptics.confirm();
                      return;
                    }
                    Haptics.tap();
                    onChanged(next);
                  },
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _DishChip extends StatelessWidget {
  const _DishChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
    duration: Motion.quick,
    decoration: BoxDecoration(
      color: selected ? pine : Colors.white,
      borderRadius: BorderRadius.circular(99),
      border: Border.all(color: selected ? pine : const Color(0xFFDDE5D4)),
    ),
    child: InkWell(
      borderRadius: BorderRadius.circular(99),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedSize(
              duration: Motion.quick,
              child: selected
                  ? const Padding(
                      padding: EdgeInsetsDirectional.only(end: 6),
                      child: Icon(Icons.check, size: 16, color: Colors.white),
                    )
                  : const SizedBox.shrink(),
            ),
            Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : ink,
                fontWeight: selected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
