import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/data/journey_analytics.dart';

void main() {
  test('Foreground time ignores the background gap', () {
    final clock = DateTime(2026, 10, 24, 9);
    final journey = JourneyAnalytics()..foreground = true;
    journey.viewScreen('home', clock);
    journey.setForeground(false, clock.add(const Duration(seconds: 5)));
    journey.setForeground(true, clock.add(const Duration(seconds: 65)));
    journey.viewScreen('plan_day', clock.add(const Duration(seconds: 70)));
    expect(journey.activeMilliseconds(clock.add(const Duration(seconds: 70)))['home'], 10000);
    expect(
      journey.events.where((event) => event['type'] == 'navigation').single['properties'],
      {'fromScreenId': 'home', 'toScreenId': 'plan_day'},
    );
  });

  test('First visit and first authenticated visit stay distinct', () {
    final now = DateTime(2026, 10, 24);
    final journey = JourneyAnalytics();
    journey.startSession(authenticated: false, now: now);
    journey.startSession(authenticated: true, now: now.add(const Duration(days: 1)));
    final sessions = journey.events.where((event) => event['type'] == 'session_started').toList();
    expect(sessions.first['properties'], {
      'sessionType': 'first_visit',
      'firstAuthenticated': false,
      'platform': 'android',
      'appVersion': '1.0.0',
    });
    expect(sessions.last['properties'], {
      'sessionType': 'returning',
      'firstAuthenticated': true,
      'platform': 'android',
      'appVersion': '1.0.0',
    });
  });

  test('Free text, phone numbers, and unknown properties are rejected', () {
    final journey = JourneyAnalytics();
    expect(
      () => journey.record('meal_recorded', {'mealId': '2026-10-24|0', 'phone': '09120000000'}),
      throwsArgumentError,
    );
    expect(
      () => journey.record('feedback_submitted', {'text': 'حالم خوب نیست'}),
      throwsArgumentError,
    );
    expect(journey.events, isEmpty);
  });
}
