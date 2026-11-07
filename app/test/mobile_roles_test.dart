import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/data/demo_store.dart';

void main() {
  test('admin cannot select or log into the mobile app', () {
    final store = DemoStore();
    final stage = store.entryStage;
    store.selectRole(AppRole.admin);
    expect(store.selectedRole, isNot(AppRole.admin));
    store.login(AppRole.admin);
    expect(store.role, isNot(AppRole.admin));
    expect(store.entryStage, stage);
    store.dispose();
  });
}
