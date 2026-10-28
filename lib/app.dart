import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'data/demo_store.dart';
import 'screens/entry.dart';
import 'screens/splash.dart';
import 'screens/onboarding.dart';
import 'screens/user.dart';
import 'screens/expert.dart';
import 'screens/admin.dart';
import 'screens/shared.dart';
import 'theme.dart';
import 'widgets/weekly_progress.dart';
import 'screens/wallet_flow.dart';

class SabzineApp extends StatefulWidget {
  const SabzineApp({
    super.key,
    this.store,
    this.splashDuration = const Duration(milliseconds: 1300),
    this.restoreOnStart = false,
  });
  final Duration splashDuration;
  final bool restoreOnStart;
  final DemoStore? store;
  @override
  State<SabzineApp> createState() => _SabzineAppState();
}

class _SabzineAppState extends State<SabzineApp> {
  late final DemoStore store = widget.store ?? DemoStore();
  late bool starting;

  @override
  void initState() {
    super.initState();
    starting = widget.restoreOnStart || widget.splashDuration > Duration.zero;
    if (starting) initialize();
  }

  Future<void> initialize() async {
    await Future.wait<void>([
      Future<void>.delayed(widget.splashDuration),
      if (widget.restoreOnStart) store.restoreQuestionnaire(),
      if (widget.restoreOnStart) store.restoreNutritionLog(),
      if (widget.restoreOnStart) store.restoreWorkspaceSettings(),
      if (widget.restoreOnStart) store.restoreWalletState(),
      if (widget.restoreOnStart) store.restoreUserSession(),
    ]);
    if (mounted) setState(() => starting = false);
  }

  @override
  void dispose() {
    if (widget.store == null) store.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => DemoScope(
    store: store,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'سبزینه',
      theme: appTheme(),
      locale: const Locale('fa'),
      supportedLocales: const [Locale('fa'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      builder: (context, child) =>
          Directionality(textDirection: TextDirection.rtl, child: child!),
      home: starting ? const SplashScreen() : const AppRoot(),
    ),
  );
}

class AppRoot extends StatelessWidget {
  const AppRoot({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return switch (store.entryStage) {
      EntryStage.roles => const EntryScreen(),
      EntryStage.onboarding => OnboardingScreen(role: store.selectedRole!),
      EntryStage.login => LoginScreen(role: store.selectedRole!),
      EntryStage.home => PanelShell(
        key: ValueKey(store.role),
        role: store.role!,
      ),
    };
  }
}

class PanelShell extends StatefulWidget {
  const PanelShell({super.key, required this.role});
  final AppRole role;
  @override
  State<PanelShell> createState() => _PanelShellState();
}

class _PanelShellState extends State<PanelShell> {
  int selected = 0;
  bool resumingPlan = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final store = DemoScope.of(context);
    if (!resumingPlan &&
        widget.role == AppRole.user &&
        store.pendingPlanAcquisition &&
        store.userSignedIn &&
        store.questionnaireComplete) {
      resumingPlan = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        await openPlanServices(context);
        resumingPlan = false;
      });
    }
  }

  void select(int i) => setState(() => selected = i);
  @override
  Widget build(BuildContext context) {
    final user = widget.role == AppRole.user,
        expert = widget.role == AppRole.expert;
    final labels = user
        ? ['خانه', 'برنامه', 'پیگیری', 'پروفایل']
        : expert
        ? ['خانه', 'درخواست‌ها', 'پیام‌ها', 'پروفایل']
        : ['خانه', 'درخواست‌ها', 'کاربران', 'بیشتر'];
    final icons = user
        ? [
            Icons.home_outlined,
            Icons.calendar_month_outlined,
            Icons.bar_chart_rounded,
            Icons.person_outline,
          ]
        : expert
        ? [
            Icons.home_outlined,
            Icons.assignment_outlined,
            Icons.chat_bubble_outline,
            Icons.person_outline,
          ]
        : [
            Icons.home_outlined,
            Icons.assignment_outlined,
            Icons.people_outline,
            Icons.more_horiz,
          ];
    final page = user
        ? switch (selected) {
            0 => UserHome(onPlan: () => select(1)),
            1 => const PlanScreen(embedded: true),
            2 => const TrackingScreen(),
            _ => const ProfileScreen(),
          }
        : expert
        ? switch (selected) {
            0 => const ExpertHome(),
            1 => const RequestListScreen(embedded: true),
            2 => const MessagesScreen(embedded: true),
            _ => const ProfileScreen(),
          }
        : switch (selected) {
            0 => const AdminHome(),
            1 => const AdminRequestsScreen(),
            2 => const PeopleScreen(),
            _ => const AdminMoreScreen(),
          };
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: user ? WeeklyRewardGate(child: page) : page,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        onDestinationSelected: select,
        height: 76,
        destinations: List.generate(
          4,
          (i) => NavigationDestination(icon: Icon(icons[i]), label: labels[i]),
        ),
      ),
    );
  }
}
