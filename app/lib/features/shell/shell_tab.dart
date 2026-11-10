import 'package:flutter/material.dart';

/// Which shell tab is showing. خانه is 1, برنامه is 2.
/// مربی is 0 and appears between خانه and برنامه.
class ShellTab extends ChangeNotifier {
  int index = 1;

  void show(int value) {
    if (index == value) return;
    index = value;
    notifyListeners();
  }

  void showHome() => show(1);

  void showPlan() => show(2);
}

class ShellTabScope extends InheritedNotifier<ShellTab> {
  const ShellTabScope({super.key, required ShellTab tab, required super.child})
    : super(notifier: tab);

  static ShellTab? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ShellTabScope>()?.notifier;
}
