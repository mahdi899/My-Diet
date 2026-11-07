// Tests for retained legacy components only. This widget is never in the app.
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/screens/admin.dart';
import 'package:sabzine_flutter/screens/clinic_workspace.dart';
import 'package:sabzine_flutter/screens/expert.dart';
import 'package:sabzine_flutter/screens/shared.dart';
import 'package:sabzine_flutter/theme.dart';

class LegacyStaffHarness extends StatelessWidget {
  const LegacyStaffHarness({super.key, required this.store});
  final DemoStore store;
  @override
  Widget build(BuildContext context) => DemoScope(
    store: store,
    child: MaterialApp(
      theme: appTheme(),
      locale: const Locale('fa'),
      supportedLocales: const [Locale('fa')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      builder: (_, child) =>
          Directionality(textDirection: TextDirection.rtl, child: child!),
      home: const _LegacyRoot(),
    ),
  );
}

class _LegacyRoot extends StatefulWidget {
  const _LegacyRoot();
  @override
  State<_LegacyRoot> createState() => _LegacyRootState();
}

class _LegacyRootState extends State<_LegacyRoot> {
  int selected = 0;
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (store.role == AppRole.user) return const PanelShell(role: AppRole.user);
    if (store.role == AppRole.admin) return const AdminHome();
    return Scaffold(
      body: switch (selected) {
        0 => const ExpertHome(),
        1 => const RequestListScreen(embedded: true),
        2 => const MessagesScreen(embedded: true),
        _ => const ClinicProfile(),
      },
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        onDestinationSelected: (value) => setState(() => selected = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home), label: 'میز کار'),
          NavigationDestination(icon: Icon(Icons.folder), label: 'درخواست‌ها'),
          NavigationDestination(icon: Icon(Icons.chat), label: 'پیام‌ها'),
          NavigationDestination(icon: Icon(Icons.person), label: 'پروفایل'),
        ],
      ),
    );
  }
}
