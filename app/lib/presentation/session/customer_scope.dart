import 'package:flutter/widgets.dart';
import '../../application/session/customer_workspace.dart';
export '../../application/session/customer_workspace.dart';
export '../../domain/common/digits.dart';

class CustomerScope extends InheritedNotifier<Listenable> {
  const CustomerScope({
    super.key,
    required this.session,
    required Listenable notifier,
    required super.child,
  }) : super(notifier: notifier);
  final CustomerWorkspace session;
  static CustomerWorkspace of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<CustomerScope>()!.session;
}
