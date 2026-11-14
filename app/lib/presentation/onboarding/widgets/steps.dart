import 'package:flutter/material.dart';
import '../../../core/photos/food_image.dart';
import '../../../core/theme/theme.dart';
import '../../../core/format/digits.dart';
import '../../../core/motion/motion.dart';
import '../../../domain/onboarding/spec.dart';
import 'blur_ink.dart';
import 'blur_name_field.dart';
import 'camera_progress.dart';
import 'decor_photo.dart';

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

/// Opening screen: a full-bleed photograph, then the same goal choices.
class HeroGoalScreen extends StatelessWidget {
  const HeroGoalScreen({
    super.key,
    required this.tracks,
    required this.value,
    required this.progress,
    required this.onChanged,
    this.onBack,
  });

  final List<SpecTrack> tracks;
  final String? value;
  final double progress;
  final ValueChanged<String> onChanged;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(color: AppColors.emeraldDark),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Stack(
          fit: StackFit.expand,
          children: [
            const FoodImage(
              photoId: 'emerald_sprout_rising_through_ring',
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: [0.18, 0.48, 0.72, 1],
                  colors: [
                    Color(0x14000000),
                    Color(0x660A5C42),
                    Color(0xF20A5C42),
                    AppColors.bg,
                  ],
                ),
              ),
            ),
            CameraProgressRing(progress: progress),
            SafeArea(
              child: Column(
                children: [
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                      child: onBack == null
                          ? const SizedBox(height: 44)
                          : Material(
                              color: Colors.white.withValues(alpha: 0.92),
                              shape: const CircleBorder(),
                              child: InkWell(
                                customBorder: const CircleBorder(),
                                onTap: onBack,
                                child: const SizedBox(
                                  width: 44,
                                  height: 44,
                                  child: Icon(
                                    Icons.arrow_back_rounded,
                                    color: AppColors.ink,
                                  ),
                                ),
                              ),
                            ),
                    ),
                  ),
                  const Spacer(),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 28),
                    child: BlurSwap(
                      text: 'برای چه هدفی اینجایی؟',
                      style: TextStyle(
                        fontFamily: 'Vazirmatn',
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.45,
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.fromLTRB(32, 8, 32, 16),
                    child: Text(
                      'برنامهٔ غذایی‌ات حول همین هدف ساخته می‌شود',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Color(0xFFE7F6EE), height: 1.7),
                    ),
                  ),
                  Flexible(
                    flex: 5,
                    child: TrackPicker(
                      tracks: tracks,
                      value: value,
                      onChanged: onChanged,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
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
              child: _TrackCard(
                track: t,
                selected: selected,
                onTap: () {
                  Haptics.confirm();
                  onChanged(t.id);
                },
              ),
            );
          },
        ),
      ),
    ],
  );
}

class _TrackCard extends StatelessWidget {
  const _TrackCard({
    required this.track,
    required this.selected,
    required this.onTap,
  });
  final SpecTrack track;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      button: true,
      selected: selected,
      label: track.title,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: reduce ? Duration.zero : Motion.quick,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: selected ? AppColors.mint : AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(
              color: selected ? AppColors.emerald : AppColors.line,
              width: selected ? 1.8 : 1,
            ),
            boxShadow: selected ? AppShadows.soft : const <BoxShadow>[],
          ),
          child: Row(
            children: [
              DecorPhoto(
                label: track.title,
                id: track.image.isNotEmpty ? track.image : track.id,
                icon: trackIcon(track.id),
                width: 64,
                height: 64,
                radius: 18,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            track.title,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppColors.ink,
                            ),
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
                            track.badge,
                            style: const TextStyle(fontSize: 10, color: amber),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      track.description,
                      style: const TextStyle(color: muted, fontSize: 12),
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
  Widget build(BuildContext context) {
    if (widget.question.key == 'name') {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: BlurNameField(
          value: widget.value,
          hint: widget.question.placeholder ?? 'اسمت',
          autofocus: widget.question.required,
          onChanged: widget.onChanged,
        ),
      );
    }
    const bare = InputBorder.none;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: TextField(
        controller: _c,
        autofocus: widget.question.required,
        maxLength: 120,
        maxLines: widget.question.key == 'dislikes' ? 3 : 1,
        textAlign: TextAlign.center,
        textInputAction: TextInputAction.done,
        scrollPadding: const EdgeInsets.only(bottom: 120),
        style: const TextStyle(
          fontFamily: 'Vazirmatn',
          fontSize: 22,
          fontWeight: FontWeight.w700,
          color: AppColors.ink,
        ),
        onChanged: widget.onChanged,
        decoration: InputDecoration(
          filled: false,
          hintText: widget.question.placeholder,
          hintStyle: const TextStyle(
            fontFamily: 'Vazirmatn',
            fontSize: 18,
            fontWeight: FontWeight.w500,
            color: AppColors.muted,
          ),
          border: bare,
          enabledBorder: bare,
          focusedBorder: bare,
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
        ),
      ),
    );
  }
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
            DecorPhoto(
              label: label,
              width: 28,
              height: 28,
              radius: 14,
              icon: Icons.restaurant_rounded,
            ),
            const SizedBox(width: 8),
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
