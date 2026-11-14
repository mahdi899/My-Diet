import 'package:flutter/foundation.dart';

import '../application/coach_session.dart';

/// Flutter notification adapter for the framework-independent conversation session.
class CoachController extends CoachSession with ChangeNotifier {
  CoachController({required super.repository}) {
    onChanged = notifyListeners;
  }

  @override
  void dispose() {
    close();
    super.dispose();
  }
}
