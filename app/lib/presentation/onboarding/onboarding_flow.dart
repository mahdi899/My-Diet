import 'package:flutter/material.dart';
import 'controller.dart';
import '../../domain/onboarding/onboarding.dart';
import '../../domain/onboarding/spec.dart';
import 'widgets/choices.dart';
import 'widgets/frame.dart';
import 'widgets/number_inputs.dart';
import 'widgets/plan_theater.dart';
import 'widgets/sleep_dial.dart';
import 'widgets/steps.dart';
import '../../core/theme/tokens.dart';

/// The spec-driven questionnaire. It renders whatever the server's spec says, so adding or
/// reordering a question never needs an app release.
class OnboardingFlow extends StatefulWidget {
  const OnboardingFlow({
    super.key,
    required this.controller,
    required this.onDone,
    this.onExit,
    this.exitBeforeTrack = false,
  });
  final OnboardingController controller;
  final ValueChanged<ProfileSummary> onDone;
  final VoidCallback? onExit;
  final bool exitBeforeTrack;

  @override
  State<OnboardingFlow> createState() => _OnboardingFlowState();
}

class _OnboardingFlowState extends State<OnboardingFlow> {
  bool forward = true;

  OnboardingController get c => widget.controller;

  @override
  void initState() {
    super.initState();
    c.addListener(_changed);
  }

  @override
  void dispose() {
    c.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  Future<void> _next() async {
    forward = true;
    if (c.isLast) {
      final profile = await c.submit();
      if (profile != null && mounted) widget.onDone(profile);
      return;
    }
    c.next();
  }

  void _back() {
    forward = false;
    if (c.isFirst || (widget.exitBeforeTrack && c.index == 1)) {
      widget.onExit?.call();
    } else {
      c.back();
    }
  }

  @override
  Widget build(BuildContext context) {
    final step = c.current;
    if (step is TrackStep && !c.submitting) {
      return PopScope<void>(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _back();
        },
        child: HeroGoalScreen(
          tracks: c.spec.tracks,
          value: c.track,
          progress: c.progress,
          onBack: c.isFirst && widget.onExit == null ? null : _back,
          onChanged: (id) {
            c.setTrack(id);
            Future<void>.delayed(const Duration(milliseconds: 280), () {
              if (mounted && c.current is TrackStep && c.track == id) {
                forward = true;
                c.next();
              }
            });
          },
        ),
      );
    }
    final flow = PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: OnboardingFrame(
        stepKey: step.id,
        forward: forward,
        progress: c.progress,
        groupTitle: c.groupTitle,
        onBack: c.isFirst && widget.onExit == null ? null : _back,
        primaryLabel: c.isLast
            ? 'ثبت پاسخ‌ها'
            : step is QuestionStep &&
                  !step.question.required &&
                  !_answered(step)
            ? 'فعلاً رد شو'
            : 'ادامه',
        onPrimary: !c.canAdvance ? null : _next,
        busy: c.submitting,
        syncHint: c.submitError ?? c.syncError,
        child: _content(step),
      ),
    );
    if (!c.submitting) return flow;
    // Theater is only a cover while submit() runs. It does not delay the
    // call, and it leaves as soon as submitting flips back (including errors).
    return Stack(
      children: [
        flow,
        const Positioned.fill(
          child: ColoredBox(color: AppColors.bg, child: PlanBuildTheater()),
        ),
      ],
    );
  }

  bool _answered(QuestionStep s) => c.spec.isAnswered(s.question, c.answers);

  Widget _content(FlowStep step) => switch (step) {
    TrackStep() => const SizedBox.shrink(),
    QuestionStep() => _QuestionView(
      controller: c,
      question: step.question,
      onSingleChoice: (value) {
        if (c.current.id != step.id || c.submitting) return;
        c.setAnswer(step.id, value);
        if (!c.isLast && c.canAdvance) _next();
      },
    ),
  };
}

class _QuestionView extends StatelessWidget {
  const _QuestionView({
    required this.controller,
    required this.question,
    required this.onSingleChoice,
  });
  final OnboardingController controller;
  final SpecQuestion question;
  final ValueChanged<String> onSingleChoice;

  /// Same wording as the website. The gain path uses its own target-weight question.
  String get _title {
    if (question.key == 'target_weight_kg' &&
        controller.track == 'weight_gain') {
      return 'دوست داری وزنت به چند کیلوگرم برسه؟';
    }
    return question.title;
  }

  @override
  Widget build(BuildContext context) {
    final q = question;
    final raw = controller.answer(q.key);
    Widget body;
    switch (q.kind) {
      case QuestionKind.single:
        body = SingleChoice(
          question: q,
          value: raw as String?,
          onChanged: onSingleChoice,
        );
      case QuestionKind.multi:
        body = MultiChoice(
          question: q,
          value: ((raw as List?) ?? const []).cast<String>(),
          onChanged: (v) => controller.setAnswer(q.key, v),
          followUpValue: q.followUp == null
              ? null
              : controller.answer(q.followUp!.key) as String?,
          onFollowUp: q.followUp == null
              ? null
              : (t) => controller.setAnswer(
                  q.followUp!.key,
                  t.trim().isEmpty ? null : t,
                ),
        );
      case QuestionKind.dishPicker:
        body = DishPicker(
          question: q,
          value: ((raw as List?) ?? const []).cast<String>(),
          onChanged: (v) => controller.setAnswer(q.key, v),
        );
      case QuestionKind.text:
        body = TextStepField(
          question: q,
          value: (raw as String?) ?? '',
          onChanged: (t) =>
              controller.setAnswer(q.key, t.trim().isEmpty ? null : t),
        );
      case QuestionKind.age:
        body = _Defaulted(
          questionKey: q.key,
          value: raw,
          fallback: (q.defaultValue ?? 30).round(),
          controller: controller,
          builder: (v) => AgeWheel(
            value: (v as num).toInt(),
            min: (q.min ?? 18).round(),
            max: (q.max ?? 100).round(),
            onChanged: (n) => controller.setAnswer(q.key, n),
          ),
        );
      case QuestionKind.number:
        body = _Defaulted(
          questionKey: q.key,
          value: raw,
          fallback: q.defaultValue ?? ((q.min ?? 0) + (q.max ?? 100)) / 2,
          controller: controller,
          builder: (v) => q.key == 'height_cm'
              ? RulerPicker(
                  value: (v as num).toDouble(),
                  min: q.min ?? 120,
                  max: q.max ?? 230,
                  unit: q.unit ?? '',
                  onChanged: (n) => controller.setAnswer(q.key, n),
                )
              : q.key.endsWith('_kg')
              ? WeightDial(
                  value: (v as num).toDouble(),
                  min: q.min ?? 0,
                  max: q.max ?? 100,
                  step: q.step ?? 1,
                  unit: q.unit ?? '',
                  onChanged: (n) => controller.setAnswer(q.key, n),
                )
              : BigNumberPicker(
                  value: (v as num).toDouble(),
                  min: q.min ?? 0,
                  max: q.max ?? 100,
                  step: q.step ?? 1,
                  unit: q.unit ?? '',
                  onChanged: (n) => controller.setAnswer(q.key, n),
                ),
        );
      case QuestionKind.sleepWake:
        final map = raw is Map ? raw : const {'sleep': 23, 'wake': 7};
        body = _Defaulted(
          questionKey: q.key,
          value: raw,
          fallback: const {'sleep': 23, 'wake': 7},
          controller: controller,
          builder: (_) => SleepWakeDial(
            sleep: (map['sleep'] as num).toInt(),
            wake: (map['wake'] as num).toInt(),
            onChanged: (s, w) =>
                controller.setAnswer(q.key, {'sleep': s, 'wake': w}),
          ),
        );
    }
    final scrolls =
        q.kind == QuestionKind.single ||
        q.kind == QuestionKind.multi ||
        q.kind == QuestionKind.dishPicker;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        QuestionHeader(title: _title, subtitle: q.subtitle),
        Expanded(
          child: KeyedSubtree(
            key: ValueKey(q.key),
            child: scrolls
                ? body
                : Center(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.only(
                        bottom: MediaQuery.viewInsetsOf(context).bottom + 12,
                      ),
                      child: body,
                    ),
                  ),
          ),
        ),
      ],
    );
  }
}

/// Number-like questions show a sensible default straight away; this also records it,
/// so pressing "continue" without touching the control still answers the question.
class _Defaulted extends StatefulWidget {
  const _Defaulted({
    required this.questionKey,
    required this.value,
    required this.fallback,
    required this.controller,
    required this.builder,
  });
  final String questionKey;
  final Object? value;
  final Object fallback;
  final OnboardingController controller;
  final Widget Function(Object value) builder;

  @override
  State<_Defaulted> createState() => _DefaultedState();
}

class _DefaultedState extends State<_Defaulted> {
  @override
  void initState() {
    super.initState();
    if (widget.value == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && widget.controller.answer(widget.questionKey) == null) {
          widget.controller.setAnswer(widget.questionKey, widget.fallback);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) =>
      widget.builder(widget.value ?? widget.fallback);
}
