/// The canonical onboarding spec, exactly as the server publishes it.
/// The app renders from this, so the demo, the app and the admin panel never drift.
library;

enum QuestionKind { text, number, single, multi, age, sleepWake, dishPicker }

QuestionKind _kindOf(String raw) => switch (raw) {
  'text' => QuestionKind.text,
  'number' => QuestionKind.number,
  'single' => QuestionKind.single,
  'multi' => QuestionKind.multi,
  'age' => QuestionKind.age,
  'sleep_wake' => QuestionKind.sleepWake,
  'dish_picker' => QuestionKind.dishPicker,
  _ => throw FormatException('unknown question kind $raw'),
};

class SpecOption {
  const SpecOption({
    required this.code,
    required this.label,
    this.image,
    this.exclusive = false,
  });
  factory SpecOption.fromJson(Map<String, dynamic> j) => SpecOption(
    code: j['code'] as String,
    label: j['label'] as String,
    image: j['image'] as String?,
    exclusive: j['exclusive'] == true,
  );
  final String code, label;
  final String? image;
  final bool exclusive;
}

class FollowUp {
  const FollowUp({
    required this.whenCodes,
    required this.key,
    required this.placeholder,
    required this.required,
  });
  factory FollowUp.fromJson(Map<String, dynamic> j) => FollowUp(
    whenCodes: (j['whenCodes'] as List).cast<String>(),
    key: j['key'] as String,
    placeholder: j['placeholder'] as String,
    required: j['required'] == true,
  );
  final List<String> whenCodes;
  final String key, placeholder;
  final bool required;
}

class ShowIf {
  const ShowIf({required this.key, this.inCodes, this.notIn});
  factory ShowIf.fromJson(Map<String, dynamic> j) => ShowIf(
    key: j['key'] as String,
    inCodes: (j['in'] as List?)?.cast<String>(),
    notIn: (j['notIn'] as List?)?.cast<String>(),
  );
  final String key;
  final List<String>? inCodes, notIn;
}

class SpecQuestion {
  const SpecQuestion({
    required this.key,
    required this.group,
    required this.kind,
    required this.title,
    required this.required,
    this.subtitle,
    this.placeholder,
    this.options = const [],
    this.min,
    this.max,
    this.step,
    this.defaultValue,
    this.unit,
    this.tracks,
    this.showIf,
    this.followUp,
  });

  factory SpecQuestion.fromJson(Map<String, dynamic> j) => SpecQuestion(
    key: j['key'] as String,
    group: j['group'] as String,
    kind: _kindOf(j['kind'] as String),
    title: j['title'] as String,
    required: j['required'] == true,
    subtitle: j['subtitle'] as String?,
    placeholder: j['placeholder'] as String?,
    options: ((j['options'] as List?) ?? const [])
        .map((o) => SpecOption.fromJson(o as Map<String, dynamic>))
        .toList(),
    min: (j['min'] as num?)?.toDouble(),
    max: (j['max'] as num?)?.toDouble(),
    step: (j['step'] as num?)?.toDouble(),
    defaultValue: (j['default'] as num?)?.toDouble(),
    unit: j['unit'] as String?,
    tracks: (j['tracks'] as List?)?.cast<String>(),
    showIf: j['showIf'] == null
        ? null
        : ShowIf.fromJson(j['showIf'] as Map<String, dynamic>),
    followUp: j['followUp'] == null
        ? null
        : FollowUp.fromJson(j['followUp'] as Map<String, dynamic>),
  );

  final String key, group, title;
  final QuestionKind kind;
  final bool required;
  final String? subtitle, placeholder, unit;
  final List<SpecOption> options;
  final double? min, max, step, defaultValue;
  final List<String>? tracks;
  final ShowIf? showIf;
  final FollowUp? followUp;

  SpecOption? option(String code) {
    for (final o in options) {
      if (o.code == code) return o;
    }
    return null;
  }
}

class SpecTrack {
  const SpecTrack({
    required this.id,
    required this.title,
    required this.badge,
    required this.image,
    required this.description,
    required this.kcalHint,
  });
  factory SpecTrack.fromJson(Map<String, dynamic> j) => SpecTrack(
    id: j['id'] as String,
    title: j['title'] as String,
    badge: j['badge'] as String,
    image: j['image'] as String,
    description: j['description'] as String,
    kcalHint: j['kcalHint'] as String,
  );
  final String id, title, badge, image, description, kcalHint;
}

class SpecInsight {
  const SpecInsight({
    required this.afterKey,
    required this.title,
    required this.body,
    required this.icon,
  });
  factory SpecInsight.fromJson(Map<String, dynamic> j) => SpecInsight(
    afterKey: j['afterKey'] as String,
    title: j['title'] as String,
    body: j['body'] as String,
    icon: j['icon'] as String,
  );
  final String afterKey, title, body, icon;
}

/// An answer is one of: String, num, `List<String>`, {sleep, wake}.
typedef Answers = Map<String, Object?>;

class OnboardingSpec {
  const OnboardingSpec({
    required this.version,
    required this.tracks,
    required this.questions,
    required this.insights,
    required this.groups,
  });
  factory OnboardingSpec.fromJson(Map<String, dynamic> j) => OnboardingSpec(
    version: j['version'] as int,
    tracks: (j['tracks'] as List)
        .map((t) => SpecTrack.fromJson(t as Map<String, dynamic>))
        .toList(),
    questions: (j['questions'] as List)
        .map((q) => SpecQuestion.fromJson(q as Map<String, dynamic>))
        .toList(),
    insights: ((j['insights'] as List?) ?? const [])
        .map((i) => SpecInsight.fromJson(i as Map<String, dynamic>))
        .toList(),
    groups: ((j['groups'] as Map?) ?? const {}).cast<String, String>(),
  );

  final int version;
  final List<SpecTrack> tracks;
  final List<SpecQuestion> questions;
  final List<SpecInsight> insights;
  final Map<String, String> groups;

  SpecQuestion? byKey(String key) {
    for (final q in questions) {
      if (q.key == key) return q;
    }
    return null;
  }

  SpecTrack? track(String? id) {
    for (final t in tracks) {
      if (t.id == id) return t;
    }
    return null;
  }

  /// Questions this person must see, in order, after the track and showIf rules.
  /// Mirrors the server so the app never asks something the server would reject.
  List<SpecQuestion> active(String track, Answers answers) {
    return questions.where((q) {
      if (q.tracks != null && !q.tracks!.contains(track)) return false;
      final rule = q.showIf;
      if (rule == null) return true;
      final chosen = _codes(answers[rule.key]);
      if (rule.inCodes != null && !rule.inCodes!.any(chosen.contains)) {
        return false;
      }
      if (rule.notIn != null &&
          chosen.isNotEmpty &&
          rule.notIn!.any(chosen.contains)) {
        return false;
      }
      return true;
    }).toList();
  }

  SpecInsight? insightAfter(String key) {
    for (final i in insights) {
      if (i.afterKey == key) return i;
    }
    return null;
  }

  bool isAnswered(SpecQuestion q, Answers answers) {
    final value = answers[q.key];
    if (value == null) return false;
    if (value is String && value.trim().isEmpty) return false;
    if (value is List && value.isEmpty) return false;
    final follow = q.followUp;
    if (follow != null && follow.required) {
      final chosen = _codes(value);
      if (chosen.any(follow.whenCodes.contains)) {
        final text = answers[follow.key];
        if (text is! String || text.trim().isEmpty) return false;
      }
    }
    return true;
  }

  List<String> missing(String track, Answers answers) => [
    for (final q in active(track, answers))
      if (q.required && !isAnswered(q, answers)) q.key,
  ];
}

List<String> _codes(Object? value) {
  if (value == null) return const [];
  if (value is List) return value.map((e) => e.toString()).toList();
  return [value.toString()];
}
