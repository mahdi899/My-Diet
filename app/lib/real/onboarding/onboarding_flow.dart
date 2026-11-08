import 'package:flutter/material.dart';
import '../../theme.dart';
import '../core/motion.dart';
import 'controller.dart';
import 'repository.dart';
import 'spec.dart';
import 'widgets/bmi_gauge.dart';
import 'widgets/choices.dart';
import 'widgets/frame.dart';
import 'widgets/hold_to_promise.dart';
import 'widgets/number_inputs.dart';
import 'widgets/sleep_dial.dart';
import 'widgets/steps.dart';

/// The spec-driven questionnaire. It renders whatever the server's spec says, so adding or
/// reordering a question never needs an app release.
class OnboardingFlow extends StatefulWidget {
  const OnboardingFlow({
    super.key,
    required this.controller,
    required this.onDone,
    this.onExit,
  });
  final OnboardingController controller;
  final ValueChanged<ProfileSummary> onDone;
  final VoidCallback? onExit;

  @override
  State<OnboardingFlow> createState() => _OnboardingFlowState();
}

class _OnboardingFlowState extends State<OnboardingFlow> {
  bool forward = true;
  bool consent = false;
  bool promised = false;

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
    final step = c.current;
    if (step is ReviewStep) {
      final profile = await c.submit();
      if (profile != null && mounted) widget.onDone(profile);
      return;
    }
    c.next();
  }

  void _back() {
    forward = false;
    if (c.isFirst) {
      widget.onExit?.call();
    } else {
      c.back();
    }
  }

  @override
  Widget build(BuildContext context) {
    final step = c.current;
    final review = step is ReviewStep;
    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: OnboardingFrame(
        stepKey: step.id,
        forward: forward,
        progress: review ? 1 : c.progress,
        groupTitle: c.groupTitle,
        onBack: c.isFirst && widget.onExit == null ? null : _back,
        primaryLabel: review
            ? 'ثبت و ساخت برنامه'
            : step is InsightStep
            ? 'بزن بریم'
            : step is QuestionStep &&
                  !step.question.required &&
                  !_answered(step)
            ? 'فعلاً رد شو'
            : 'ادامه',
        onPrimary: !c.canAdvance || (review && !(consent && promised))
            ? null
            : _next,
        busy: c.submitting,
        syncHint: c.submitError ?? c.syncError,
        child: _content(step),
      ),
    );
  }

  bool _answered(QuestionStep s) => c.spec.isAnswered(s.question, c.answers);

  Widget _content(FlowStep step) => switch (step) {
    TrackStep() => TrackPicker(
      tracks: c.spec.tracks,
      value: c.track,
      onChanged: (id) {
        c.setTrack(id);
        Future<void>.delayed(const Duration(milliseconds: 260), () {
          if (mounted && c.current is TrackStep && c.track == id) {
            forward = true;
            c.next();
          }
        });
      },
    ),
    InsightStep() => InsightInterstitial(insight: step.insight),
    ReviewStep() => _Review(
      controller: c,
      consent: consent,
      promised: promised,
      onConsent: (v) => setState(() => consent = v),
      onPromise: () => setState(() => promised = true),
    ),
    QuestionStep() => _QuestionView(controller: c, question: step.question),
  };
}

class _QuestionView extends StatelessWidget {
  const _QuestionView({required this.controller, required this.question});
  final OnboardingController controller;
  final SpecQuestion question;

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
          onChanged: (v) => controller.setAnswer(q.key, v),
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
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        QuestionHeader(title: q.title, subtitle: q.subtitle),
        Expanded(
          child: scrolls
              ? body
              : Center(child: SingleChildScrollView(child: body)),
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

class _Review extends StatelessWidget {
  const _Review({
    required this.controller,
    required this.consent,
    required this.promised,
    required this.onConsent,
    required this.onPromise,
  });
  final OnboardingController controller;
  final bool consent, promised;
  final ValueChanged<bool> onConsent;
  final VoidCallback onPromise;

  double? get _bmi {
    final h = (controller.answer('height_cm') as num?)?.toDouble();
    final w = (controller.answer('weight_kg') as num?)?.toDouble();
    if (h == null || w == null || h <= 0) return null;
    return w / ((h / 100) * (h / 100));
  }

  @override
  Widget build(BuildContext context) {
    final bmi = _bmi;
    final name = (controller.answer('name') as String?)?.split(' ').first;
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      children: [
        Reveal(
          child: Text(
            name == null ? 'آماده‌ای؟' : '$name، آماده‌ای؟',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
        ),
        const SizedBox(height: 6),
        const Reveal(
          index: 1,
          child: Text(
            'پاسخ‌هات رو برای دکتر می‌فرستیم. اول هوش مصنوعی یه پیش‌نویس می‌سازه، بعد دکتر بررسی و تأییدش می‌کنه؛ رژیمت بعد از تأیید دکتر شروع می‌شه.',
            style: TextStyle(color: muted, height: 1.9),
          ),
        ),
        if (bmi != null) ...[
          const SizedBox(height: 18),
          Reveal(
            index: 2,
            child: Center(child: BmiGauge(bmi: bmi)),
          ),
        ],
        const SizedBox(height: 20),
        Reveal(
          index: 3,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFDDE5D4)),
            ),
            child: Material(
              type: MaterialType.transparency,
              child: CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: consent,
                onChanged: (v) {
                  Haptics.tap();
                  onConsent(v ?? false);
                },
                title: const Text(
                  'با ذخیره و پردازش اطلاعات سلامتم برای ساخت برنامهٔ غذایی موافقم',
                  style: TextStyle(fontSize: 13, height: 1.8),
                ),
                subtitle: const Text(
                  'اطلاعات رمزنگاری می‌شود و فقط دکتر مسئول و مدیر مجاز آن را می‌بیند. هر زمان می‌توانی حذف را درخواست کنی.',
                  style: TextStyle(fontSize: 11, color: muted),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),
        Reveal(
          index: 4,
          child: Center(
            child: HoldToPromise(
              label: 'نگه دار تا به خودت قول بدی',
              onCompleted: onPromise,
            ),
          ),
        ),
        if (!consent || !promised)
          const Padding(
            padding: EdgeInsets.only(top: 14),
            child: Text(
              'برای ادامه، رضایت رو تیک بزن و قول رو کامل کن.',
              textAlign: TextAlign.center,
              style: TextStyle(color: muted, fontSize: 12),
            ),
          ),
      ],
    );
  }
}
