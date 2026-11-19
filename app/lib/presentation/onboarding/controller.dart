import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../core/network/api_client.dart';
import '../../domain/onboarding/onboarding.dart';
import '../../domain/onboarding/spec.dart';

sealed class FlowStep {
  const FlowStep();
  String get id;
}

class TrackStep extends FlowStep {
  const TrackStep();
  @override
  String get id => '_track';
}

class QuestionStep extends FlowStep {
  const QuestionStep(this.question);
  final SpecQuestion question;
  @override
  String get id => question.key;
}

/// Drives the whole onboarding: which steps exist, where the person is, what they answered,
/// and keeping the server draft in step with the screen (retrying quietly when offline).
class OnboardingController extends ChangeNotifier {
  OnboardingController({
    required this.repository,
    required this.spec,
    required this.state,
    Duration saveDelay = const Duration(milliseconds: 700),
  }) : _saveDelay = saveDelay {
    _init();
  }

  final OnboardingRepository repository;
  final OnboardingSpec spec;
  final OnboardingState state;
  final Duration _saveDelay;

  String? track;
  final Answers answers = {};
  late List<FlowStep> steps;
  int index = 0;
  int _version = 0;
  bool gapsOnly = false;
  Set<String>? _editKeys;

  /// Limit profile edits to the selected answer and its dependent questions.
  void editQuestions(Set<String> keys) {
    _editKeys = {...keys};
    // Include conditional follow-ups, even when this edit reveals them later.
    bool expanded;
    do {
      expanded = false;
      for (final q in spec.questions) {
        if (_editKeys!.contains(q.showIf?.key) && _editKeys!.add(q.key)) {
          expanded = true;
        }
      }
    } while (expanded);
    steps = _buildSteps();
    index = 0;
    notifyListeners();
  }

  bool submitting = false;
  String? syncError;
  String? submitError;

  final Answers _pending = {};
  Timer? _timer;
  bool _flushing = false;
  bool _disposed = false;

  void _init() {
    track = state.track;
    if (state.draft != null) {
      answers.addAll(state.draft!.answers);
      _version = state.draft!.version;
    }
    gapsOnly = state.nextStep == NextStep.gaps;
    steps = _buildSteps();
    index = _startIndex();
  }

  // ---------------------------------------------------------------- steps

  List<FlowStep> _buildSteps() {
    if (track == null) return const [TrackStep()];
    final questions = spec.active(track!, answers);
    if (_editKeys != null) {
      return [
        for (final q in questions)
          if (_editKeys!.contains(q.key)) QuestionStep(q),
      ];
    }
    final out = <FlowStep>[];
    if (gapsOnly) {
      final gaps = <String>{...spec.missing(track!, answers), ...state.missing};
      for (final q in questions) {
        if (gaps.contains(q.key) ||
            !spec.isAnswered(q, answers) && q.required) {
          out.add(QuestionStep(q));
        }
      }
      return out;
    }
    out.add(const TrackStep());
    for (final q in questions) {
      out.add(QuestionStep(q));
    }
    return out;
  }

  int _startIndex() {
    if (track == null) return 0;
    if (gapsOnly) return 0;
    final saved = state.draft?.stepKey;
    if (saved != null) {
      final at = steps.indexWhere((s) => s.id == saved);
      if (at >= 0) return at;
    }
    // Resume at the first required question that is still open.
    final firstOpen = steps.indexWhere(
      (s) =>
          s is QuestionStep &&
          s.question.required &&
          !spec.isAnswered(s.question, answers),
    );
    return firstOpen >= 0 ? firstOpen : 1.clamp(0, steps.length - 1);
  }

  FlowStep get current => steps[index];
  bool get isFirst => index == 0;
  bool get isLast => index == steps.length - 1;

  int get questionTotal => steps.whereType<QuestionStep>().length;
  int get questionsDone => steps.take(index).whereType<QuestionStep>().length;

  /// 0..1 across the questions only.
  double get progress =>
      questionTotal == 0 ? 0 : (questionsDone / questionTotal).clamp(0.0, 1.0);

  String? get groupTitle {
    final s = current;
    if (s is QuestionStep) return spec.groups[s.question.group];
    return null;
  }

  bool get canAdvance {
    final s = current;
    return switch (s) {
      QuestionStep() =>
        !s.question.required || spec.isAnswered(s.question, answers),
      TrackStep() => track != null,
    };
  }

  // -------------------------------------------------------------- answers

  Object? answer(String key) => answers[key];

  void setTrack(String id) {
    if (track == id) return;
    _editKeys = null;
    submitError = null;
    track = id;
    _rebuild(keep: '_track');
    _schedule(trackChanged: true);
  }

  void setAnswer(String key, Object? value) {
    submitError = null;
    if (value == null || (value is List && value.isEmpty)) {
      answers.remove(key);
      _pending[key] = null;
    } else {
      answers[key] = value;
      _pending[key] = value;
    }
    // A changed answer can reveal or hide later questions.
    final keepId = current.id;
    _rebuild(keep: keepId);
    _schedule();
  }

  void _rebuild({required String keep}) {
    steps = _buildSteps();
    final at = steps.indexWhere((s) => s.id == keep);
    index = at >= 0 ? at : index.clamp(0, steps.length - 1);
    notifyListeners();
  }

  // ------------------------------------------------------------ navigation

  void next() {
    if (!canAdvance || isLast) return;
    submitError = null;
    index += 1;
    _schedule(step: true);
    notifyListeners();
  }

  void back() {
    if (isFirst) return;
    submitError = null;
    index -= 1;
    _schedule(step: true);
    notifyListeners();
  }

  /// A profile summary can revisit an existing answer, but cannot skip an
  /// unanswered required question or revive a question hidden by this path.
  bool revisit(String id) {
    final at = steps.indexWhere((step) => step.id == id);
    if (at < 0 || submitting) return false;
    final step = steps[at];
    if (step is QuestionStep && !spec.isAnswered(step.question, answers)) {
      return false;
    }
    submitError = null;
    index = at;
    _schedule(step: true);
    notifyListeners();
    return true;
  }

  // ----------------------------------------------------------- persistence

  bool _trackDirty = false;
  bool _stepDirty = false;

  void _schedule({bool trackChanged = false, bool step = false}) {
    _trackDirty = _trackDirty || trackChanged;
    _stepDirty = _stepDirty || step;
    _timer?.cancel();
    _timer = Timer(_saveDelay, flush);
  }

  bool get hasUnsynced => _pending.isNotEmpty || _trackDirty;

  /// Pushes everything not yet on the server. Safe to call at any time; failures keep the
  /// patch and surface `syncError` so the screen can show a quiet "not saved yet" hint.
  Future<bool> flush() async {
    _timer?.cancel();
    if (_flushing) return false;
    if (!hasUnsynced && !_stepDirty) return true;
    _flushing = true;
    final patch = Map<String, Object?>.from(_pending);
    final step = steps.isEmpty ? '_track' : current.id;
    try {
      _version = await repository.saveDraft(
        track: track,
        patch: patch,
        stepKey: step,
        progress: (progress * 100).round(),
        baseVersion: _version == 0 ? null : _version,
      );
      for (final key in patch.keys) {
        if (_pending[key] == patch[key]) _pending.remove(key);
      }
      _trackDirty = false;
      _stepDirty = false;
      syncError = null;
      return true;
    } on ApiException catch (e) {
      if (e.code == 'draft_conflict') {
        // Another device edited the draft: adopt its version, keep ours on top.
        try {
          final fresh = await repository.state();
          _version = fresh.draft?.version ?? 0;
          _flushing = false;
          return await flush();
        } on ApiException {
          // fall through to the generic message
        }
      }
      syncError = e.offline
          ? 'ذخیره‌سازی آنلاین بعداً انجام می‌شود'
          : e.message;
      return false;
    } finally {
      _flushing = false;
      if (!_disposed) notifyListeners();
    }
  }

  /// Final step: send everything and let the server derive the profile.
  Future<ProfileSummary?> submit() async {
    submitting = true;
    submitError = null;
    notifyListeners();
    try {
      await flush();
      if (hasUnsynced) {
        submitError = syncError ?? 'ذخیرهٔ پاسخ‌ها انجام نشد؛ دوباره تلاش کن.';
        return null;
      }
      final profile = await repository.submit(patch: const {});
      _pending.clear();
      return profile;
    } on ApiException catch (e) {
      submitError = e.message;
      return null;
    } finally {
      submitting = false;
      if (!_disposed) notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    super.dispose();
  }
}
