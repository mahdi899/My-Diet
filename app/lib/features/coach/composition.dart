import 'package:flutter/scheduler.dart';

import '../../data/demo_store.dart';
import 'data/http_coach_repository.dart';
import 'data/mock_coach_repository.dart';
import 'domain/coach_repository.dart';

CoachRepository createCoachRepository(DemoStore store) {
  final auth = store.customerAuth;
  if (auth != null) return HttpCoachRepository(auth: auth);
  final testing = SchedulerBinding.instance.runtimeType.toString().contains(
    'Test',
  );
  return MockCoachRepository(
    store: store,
    charDelay: testing ? Duration.zero : const Duration(milliseconds: 16),
  );
}
