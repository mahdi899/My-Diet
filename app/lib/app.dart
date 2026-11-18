import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'data/demo_store.dart';
import 'data/connection.dart';
import 'presentation/screens/entry.dart';
import 'presentation/screens/first_login.dart';
import 'presentation/screens/splash.dart';
import 'presentation/screens/onboarding.dart';
import 'core/theme/theme.dart';
import 'features/coach/composition.dart';
import 'features/coach/presentation/coach_page.dart';
import 'features/home/home_tab.dart';
import 'features/plan/plan_tab.dart';
import 'features/shell/shell_bar.dart';
import 'features/shell/shell_tab.dart';
import 'core/motion/motion_kit.dart';
import 'presentation/widgets/weekly_progress.dart';
import 'presentation/widgets/connection_gate.dart';
import 'presentation/screens/wallet_flow.dart';
import 'presentation/session/live_entry.dart';
import 'presentation/session/live_entry_bootstrap.dart';
import 'presentation/session/live_session.dart';

class SabzineApp extends StatefulWidget {
  const SabzineApp({
    super.key,
    this.store,
    this.link,
    this.splashDuration = Duration.zero,
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
  final shellTab = ShellTab();
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
    Future<void> restoreAndBootstrap() async {
      if (widget.restoreOnStart) {
        await Future.wait<void>([
          store.restoreQuestionnaire(),
          store.restoreNutritionLog(),
          store.restoreWorkspaceSettings(),
          store.restoreWalletState(),
          store.restoreUserSession(),
        ]);
        await store.restoreWeeklyFeedback();
      }
      await bootstrapLiveEntry(store);
    }

    await Future.wait<void>([
      Future<void>.delayed(widget.splashDuration),
      restoreAndBootstrap(),
    ]);
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
    shellTab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => DemoScope(
    store: store,
    child: ShellTabScope(
      tab: shellTab,
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
        home: starting ? const SplashScreen() : const AppRoot(),
      ),
    ),
  );
}

class AppRoot extends StatelessWidget {
  const AppRoot({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    // Legacy fixtures may still set staff roles; the shipped client is user-only.
    if (!store.userSignedIn || store.suppressLiveEntry) {
      return const FirstLoginScreen();
    }
    // One app. The server only decides the onboarding path; the home is always this shell.
    if (store.serverAuthEnabled && !store.liveReady) {
      return LiveEntry(store: store);
    }
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

class _PanelShellState extends State<PanelShell> with WidgetsBindingObserver {
  int _local = 1;
  ShellTab? _tabs;
  bool resumingPlan = false;
  Timer? _livePoll;
  bool _refreshing = false;
  bool _foreground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    _foreground = lifecycle == null || lifecycle == AppLifecycleState.resumed;
    if (_foreground) _startLivePolling();
  }

  void _startLivePolling() {
    _livePoll?.cancel();
    _livePoll = Timer.periodic(
      const Duration(seconds: 8),
      (_) => _refreshLive(),
    );
  }

  Future<void> _refreshLive() async {
    if (!mounted || !_foreground || _refreshing) return;
    final store = DemoScope.of(context);
    if (!store.serverAuthEnabled ||
        !store.userSignedIn ||
        store.walletPurchaseBusy) {
      return;
    }
    _refreshing = true;
    try {
      await refreshLive(store);
    } finally {
      _refreshing = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) {
      _startLivePolling();
      unawaited(_refreshLive());
    } else {
      _livePoll?.cancel();
    }
  }

  int get _index => _tabs?.index ?? _local;

  void _bind(ShellTab? tabs) {
    if (identical(_tabs, tabs)) return;
    _tabs?.removeListener(_onTab);
    _tabs = tabs;
    _tabs?.addListener(_onTab);
  }

  void _onTab() {
    if (mounted) setState(() {});
    if (_index == 2) unawaited(_refreshLive());
  }

  void _show(int index) {
    if (index == 2 && !DemoScope.of(context).userSignedIn) {
      DemoScope.of(context).openUserLogin();
      return;
    }
    final tabs = _tabs;
    if (tabs != null) {
      tabs.show(index);
    } else {
      setState(() => _local = index);
      if (index == 2) unawaited(_refreshLive());
    }
  }

  static const _tabOrder = [1, 0, 2];

  void _swipe(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    if (velocity == 0) return;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final next = _tabOrder.indexOf(_index) + ((velocity > 0) == rtl ? 1 : -1);
    if (next >= 0 && next < _tabOrder.length) _show(_tabOrder[next]);
  }

  @override
  void dispose() {
    _tabs?.removeListener(_onTab);
    _livePoll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _bind(ShellTabScope.maybeOf(context));
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

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final selected = _index;
    final coach = selected == 0;
    final page = switch (selected) {
      0 => CoachPage(
        repository: createCoachRepository(store),
        onClose: () => _show(1),
      ),
      2 => const PlanTab(),
      _ => HomeTab(onOpenPlan: () => _show(2)),
    };
    final gated = !store.userSignedIn && selected == 2
        ? const CustomerSignInPrompt()
        : WeeklyRewardGate(child: page);
    return Scaffold(
      backgroundColor: selected == 1 ? AppColors.surface : null,
      body: SafeArea(
        bottom: false,
        child: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onHorizontalDragEnd: _swipe,
          child: Stack(
            children: [
              Column(
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
                    child: SharedAxisSwitcher(
                      index: _tabOrder.indexOf(selected),
                      child: KeyedSubtree(
                        key: ValueKey('shell-page-$selected'),
                        child: gated,
                      ),
                    ),
                  ),
                ],
              ),
              if (!coach)
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 10 + MediaQuery.paddingOf(context).bottom,
                  child: ShellTabBar(
                    selected: selected,
                    onCoach: () => _show(0),
                    onHome: () => _show(1),
                    onPlan: () => _show(2),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
