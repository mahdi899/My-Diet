import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'data/demo_store.dart';
import 'data/connection.dart';
import 'screens/entry.dart';
import 'screens/first_login.dart';
import 'screens/splash.dart';
import 'screens/onboarding.dart';
import 'screens/user.dart';
import 'theme.dart';
import 'widgets/weekly_progress.dart';
import 'widgets/connection_gate.dart';
import 'screens/wallet_flow.dart';

class SabzineApp extends StatefulWidget {
  const SabzineApp({
    super.key,
    this.store,
    this.link,
    this.splashDuration = const Duration(milliseconds: 1300),
    this.restoreOnStart = false,
  });
  final Duration splashDuration;
  final bool restoreOnStart;
  final DemoStore? store;
  final LinkMonitor? link;
  @override
  State<SabzineApp> createState() => _SabzineAppState();
}

class _SabzineAppState extends State<SabzineApp> with WidgetsBindingObserver {
  late final DemoStore store = widget.store ?? DemoStore();
  late final LinkMonitor links = widget.link ?? LinkMonitor();
  late bool starting;
  final navigatorKey = GlobalKey<NavigatorState>();
  Timer? sessionTimer;
  bool wasSignedIn = false;

  void sessionChanged() {
    final signedIn = store.userSignedIn;
    if (wasSignedIn && !signedIn) {
      wasSignedIn = false;
      // Clear customer-specific projections as soon as a session is lost.
      final entering = store.entryStage == EntryStage.login;
      final pending = store.pendingPlanAcquisition;
      store.logout();
      if (entering) {
        store.openUserLogin();
        store.pendingPlanAcquisition = pending;
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        navigatorKey.currentState?.popUntil((route) => route.isFirst);
      });
    }
    wasSignedIn = signedIn;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      links.check();
      if (store.serverAuthEnabled) {
        store.refreshServerSession();
      }
      store.update();
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    wasSignedIn = store.userSignedIn;
    store.addListener(sessionChanged);
    links.check();
    sessionTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => store.update(),
    );
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
    if (widget.restoreOnStart) await store.restoreWeeklyFeedback();
    if (mounted) setState(() => starting = false);
  }

  @override
  void dispose() {
    sessionTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    store.removeListener(sessionChanged);
    if (widget.link == null) links.dispose();
    if (widget.store == null) {
      store.customerAuth?.dispose();
      store.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => DemoScope(
    store: store,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'رژیم من',
      navigatorKey: navigatorKey,
      theme: appTheme(),
      locale: const Locale('fa'),
      supportedLocales: const [Locale('fa'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: ConnectionGate(link: links, child: child!),
      ),
      home: starting
          ? (widget.splashDuration > Duration.zero
                ? const SplashScreen()
                : const Scaffold(
                    backgroundColor: cream,
                    body: SizedBox.shrink(),
                  ))
          : const AppRoot(),
    ),
  );
}

class AppRoot extends StatelessWidget {
  const AppRoot({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    // Legacy fixtures may still set staff roles; the shipped client is user-only.
    if (!store.userSignedIn) return const FirstLoginScreen();
    store.selectedRole = AppRole.user;
    if (store.entryStage != EntryStage.login) store.role = AppRole.user;
    return switch (store.entryStage) {
      EntryStage.onboarding => const OnboardingScreen(role: AppRole.user),
      EntryStage.login => const LoginScreen(role: AppRole.user),
      _ => const PanelShell(role: AppRole.user),
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

  void select(int i) {
    final store = DemoScope.of(context);
    if ((i == 1 || i == 2) && !store.userSignedIn) {
      store.openUserLogin();
      return;
    }
    setState(() => selected = i);
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final page = switch (selected) {
      0 => UserHome(onPlan: () => select(1)),
      1 => const PlanScreen(embedded: true),
      2 => const TrackingScreen(),
      _ => const ProfileScreen(),
    };
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            if (store.sessionError != null)
              MaterialBanner(
                content: Text(store.sessionError!),
                actions: [
                  TextButton(
                    onPressed: store.refreshServerSession,
                    child: const Text('تلاش دوباره'),
                  ),
                ],
              ),
            Expanded(
              child: !store.userSignedIn && selected != 0 && selected != 3
                  ? const CustomerSignInPrompt()
                  : WeeklyRewardGate(child: page),
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        onDestinationSelected: select,
        height: 76,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'خانه'),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            label: 'برنامه',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_rounded),
            label: 'پیگیری',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            label: 'پروفایل',
          ),
        ],
      ),
    );
  }
}
