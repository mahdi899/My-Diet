import 'package:flutter/material.dart';

import '../../../data/demo_store.dart';
import '../../../presentation/widgets/ui.dart';
import 'personal_details.dart';
import 'profile_goal_card.dart';

class ProfileGoalScreen extends StatelessWidget {
  const ProfileGoalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('هدف من')),
      body: SafeArea(
        child: PageBody(
          padding: 18,
          children: [
            ProfileGoalCard(
              source: store,
              onEdit: () => Navigator.of(context).push<void>(
                MaterialPageRoute(builder: (_) => ChangeGoal(store: store)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
