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
import 'widgets/onboarding_icons.dart';
import '../../core/format/digits.dart';
import '../../core/theme/tokens.dart';
import '../widgets/operation_status.dart';

/// The spec-driven questionnaire. It renders whatever the server's spec says, so adding or
/// reordering a question never needs an app release.
class OnboardingFlow extends StatefulWidget {
  const OnboardingFlow({
    super.key,
    required this.controller,
    required this.onDone,
    this.onExit,
    this.exitBeforeTrack = false,
    this.releaseWithoutSubmit = false,
    this.onQuestionnaireDone,
  });
  final OnboardingController controller;
  final ValueChanged<ProfileSummary> onDone;
  final VoidCallback? onExit;
  final bool exitBeforeTrack;

  /// Signup keeps the answers and continues to analysis, specialists and plans
  /// before any account or submit call.
  final bool releaseWithoutSubmit;
  final VoidCallback? onQuestionnaireDone;

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
      if (widget.releaseWithoutSubmit) {
        final saved = await c.flush();
        if (!mounted || !saved) return;
        widget.onQuestionnaireDone?.call();
        return;
      }
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

  Future<void> _reviewAnswers() async {
    final answered = c.steps
        .whereType<QuestionStep>()
        .where(_answered)
        .toList();
    final selected = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheet) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(sheet).height * .6,
          child: ListView(
            children: [
              const ListTile(title: Text('مرور پاسخ‌ها')),
              for (final step in answered)
                ListTile(
                  title: Text(step.question.title),
                  subtitle: Text(_answerSummary(step)),
                  trailing: const Icon(Icons.edit_outlined),
                  onTap: () => Navigator.pop(sheet, step.id),
                ),
              TextButton(
                onPressed: () => Navigator.pop(sheet),
                child: const Text('بستن'),
              ),
            ],
          ),
        ),
      ),
    );
    if (mounted && selected != null) {
      forward = false;
      c.revisit(selected);
    }
  }

  String _answerSummary(QuestionStep step) {
    final value = c.answer(step.question.key);
    String label(Object? item) =>
        step.question.option('$item')?.label ?? fa(item ?? '');
    if (value is List) return value.map(label).join('، ');
    if (value is Map) return value.values.map(label).join(' · ');
    if (value is num) {
      return '${faNumber(value)} ${step.question.unit ?? ''}'.trim();
    }
    return label(value);
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
        onReview:
            c.submitting || !c.steps.whereType<QuestionStep>().any(_answered)
            ? null
            : _reviewAnswers,
        primaryLabel: c.submitError != null
            ? 'تلاش دوباره برای ثبت'
            : c.isLast
            ? 'ثبت پاسخ‌ها'
            : step is QuestionStep &&
                  !step.question.required &&
                  !_answered(step)
            ? 'فعلاً رد شو'
            : 'ادامه',
        onPrimary: !c.canAdvance ? null : _next,
        busy: c.submitting,
        syncHint: c.submitError == null ? c.syncError : null,
        secondary: c.submitError == null
            ? null
            : Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  'پاسخ‌هایت حفظ شده؛ می‌توانی دوباره ثبت کنی یا برای ویرایش برگردی.',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.inkSoft,
                    height: 1.6,
                  ),
                ),
              ),
        child: c.submitError == null
            ? _content(step)
            : SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: OperationStatus(
                  title: 'ثبت پاسخ‌ها کامل نشد',
                  message: c.submitError!,
                  tone: OperationTone.error,
                  icon: Icons.cloud_off_rounded,
                  iconWidget: const DietIcon(DietIconKind.offline, size: 26),
                ),
              ),
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

  /// Loss cannot reach or pass the current weight. Gain cannot stay at or below it.
  (double, double) _kgBounds(SpecQuestion q) {
    var min = q.min ?? 0;
    var max = q.max ?? 300;
    if (q.key != 'target_weight_kg') return (min, max);
    final current = controller.answer('weight_kg');
    if (current is! num) return (min, max);
    final step = q.step ?? 0.5;
    final weight = current.toDouble();
    if (controller.track == 'weight_loss') {
      max = weight - step;
    } else if (controller.track == 'weight_gain') {
      min = weight + step;
    }
    if (min > max) min = max;
    return (min, max);
  }

  String? _targetHint() {
    final current = controller.answer('weight_kg');
    if (question.key != 'target_weight_kg' || current is! num) return null;
    final kilos = fa(
      current == current.roundToDouble() ? current.round() : current,
    );
    if (controller.track == 'weight_loss') {
      return 'باید کمتر از $kilos کیلوگرم باشد';
    }
    if (controller.track == 'weight_gain') {
      return 'باید بیشتر از $kilos کیلوگرم باشد';
    }
    return null;
  }

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
        final bounds = _kgBounds(q);
        final fallback = (q.defaultValue ?? (bounds.$1 + bounds.$2) / 2)
            .clamp(bounds.$1, bounds.$2)
            .toDouble();
        body = _Defaulted(
          questionKey: q.key,
          value: raw,
          fallback: q.key == 'height_cm' ? (q.defaultValue ?? 165) : fallback,
          controller: controller,
          builder: (v) {
            final chosen = (v as num).toDouble();
            final shown = chosen.clamp(bounds.$1, bounds.$2).toDouble();
            if (q.key == 'target_weight_kg' && shown != chosen) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (controller.answer(q.key) != shown) {
                  controller.setAnswer(q.key, shown);
                }
              });
            }
            if (q.key == 'height_cm') {
              return RulerPicker(
                value: chosen,
                min: q.min ?? 120,
                max: q.max ?? 230,
                unit: q.unit ?? '',
                onChanged: (n) => controller.setAnswer(q.key, n),
              );
            }
            if (q.key.endsWith('_kg')) {
              return WeightDial(
                value: shown,
                min: bounds.$1,
                max: bounds.$2,
                step: q.step ?? 1,
                unit: q.unit ?? '',
                hint: _targetHint(),
                onChanged: (n) => controller.setAnswer(q.key, n),
              );
            }
            return BigNumberPicker(
              value: chosen,
              min: q.min ?? 0,
              max: q.max ?? 100,
              step: q.step ?? 1,
              unit: q.unit ?? '',
              onChanged: (n) => controller.setAnswer(q.key, n),
            );
          },
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
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        key: ValueKey(q.key),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                QuestionHeader(title: _title),
                body,
              ],
            ),
          ),
        ),
      ),
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
