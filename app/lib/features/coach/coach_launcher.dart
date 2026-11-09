import 'package:flutter/material.dart';

import '../../data/demo_store.dart';
import 'application/coach_controller.dart';
import 'presentation/coach_page.dart';
import 'presentation/coach_route.dart';
import 'presentation/profile_sheet.dart';

Future<void> openCoach(
  BuildContext context, {
  String? prefill,
  String? autoSend,
}) async {
  final store = DemoScope.of(context);
  await Navigator.of(context).push<void>(
    coachRevealRoute(
      CoachPage(
        repository: createCoachRepository(store),
        prefill: prefill,
        autoSend: autoSend,
      ),
    ),
  );
}

void openProfileSheet(BuildContext context) {
  showCoachProfileSheet(context);
}
