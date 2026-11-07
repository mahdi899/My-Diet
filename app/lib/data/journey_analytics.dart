/// Customer analytics that keeps only stable ids and measured foreground time.
class JourneyAnalytics {
  static const allowedProperties = {
    'session_started': {
      'sessionType',
      'firstAuthenticated',
      'platform',
      'appVersion',
    },
    'screen_viewed': {'screenId'},
    'navigation': {'fromScreenId', 'toScreenId'},
    'plan_purchase_started': {'serviceId'},
    'questionnaire_completed': {'schemaVersion'},
    'meal_recorded': {'mealId'},
    'alternative_selected': {'optionId'},
    'feedback_submitted': {'rating'},
  };

  final List<Map<String, Object>> events = [];
  final Map<String, int> _activeMs = {};
  bool foreground = true;
  String? currentScreen;
  DateTime? _shownAt;
  int _sessions = 0;
  bool _authenticatedOnce = false;

  void setForeground(bool value, DateTime now) {
    if (value == foreground) return;
    if (!value) _accrue(now);
    foreground = value;
    _shownAt = value ? now : null;
  }

  void startSession({
    required bool authenticated,
    required DateTime now,
    String platform = 'android',
    String appVersion = '1.0.0',
  }) {
    final firstVisit = _sessions == 0;
    final firstAuthenticated = authenticated && !_authenticatedOnce;
    if (authenticated) _authenticatedOnce = true;
    _sessions += 1;
    record('session_started', {
      'sessionType': firstVisit ? 'first_visit' : 'returning',
      'firstAuthenticated': firstAuthenticated,
      'platform': platform,
      'appVersion': appVersion,
    });
    _shownAt = foreground ? now : null;
  }

  void viewScreen(String screenId, DateTime now) {
    _accrue(now);
    final from = currentScreen;
    if (from != null && from != screenId) {
      record('navigation', {'fromScreenId': from, 'toScreenId': screenId});
    }
    currentScreen = screenId;
    _shownAt = foreground ? now : null;
    record('screen_viewed', {'screenId': screenId});
  }

  void record(String type, Map<String, Object> properties) {
    final allowed = allowedProperties[type];
    if (allowed == null ||
        properties.length != allowed.length ||
        properties.keys.any((key) => !allowed.contains(key))) {
      throw ArgumentError('ویژگی رویداد مجاز نیست.');
    }
    for (final value in properties.values) {
      if (value is bool || value is int) continue;
      if (value is String &&
          value.isNotEmpty &&
          value.length <= 80 &&
          !value.contains(' ') &&
          !value.contains('\n')) {
        continue;
      }
      throw ArgumentError('مقدار رویداد مجاز نیست.');
    }
    events.add({
      'type': type,
      'properties': Map<String, Object>.from(properties),
    });
  }

  Map<String, int> activeMilliseconds(DateTime now) {
    _accrue(now);
    return Map<String, int>.from(_activeMs);
  }

  void _accrue(DateTime now) {
    if (!foreground || _shownAt == null || currentScreen == null) return;
    final elapsed = now.difference(_shownAt!).inMilliseconds;
    if (elapsed > 0) {
      _activeMs[currentScreen!] = (_activeMs[currentScreen!] ?? 0) + elapsed;
    }
    _shownAt = now;
  }
}
