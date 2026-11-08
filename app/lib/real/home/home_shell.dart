import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/api.dart';
import '../core/motion.dart';
import '../onboarding/repository.dart';
import '../plan/plan.dart';
import '../session.dart';
import 'analysis_screen.dart';
import 'plan_shell.dart';
import 'purchase_screen.dart';
import 'reveal.dart';

/// After onboarding: decides between buying, waiting for the doctor, and living with the plan.
/// The server is the source of truth; this just keeps asking (gently) while something is pending.
class HomeShell extends StatefulWidget {
  const HomeShell({
    super.key,
    required this.session,
    required this.services,
    this.profile,
  });
  final SessionController session;
  final Services services;
  final ProfileSummary? profile;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  PlanRequestInfo? request;
  PublishedPlan? plan;
  bool loaded = false;
  String? error;
  bool revealing = false;
  Timer? _poll;

  Services get s => widget.services;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _load(quiet: true);
  }

  bool get _pending {
    final r = request;
    return r != null &&
        r.phase != RequestPhase.published &&
        r.phase != RequestPhase.cancelled;
  }

  Future<void> _load({bool quiet = false}) async {
    try {
      final results = await Future.wait<Object?>([
        s.plans.latestRequest(),
        s.plans.publishedPlan(),
      ]);
      final nextRequest = results[0] as PlanRequestInfo?;
      final nextPlan = results[1] as PublishedPlan?;
      final becamePublished =
          plan == null && nextPlan != null && request != null && _pending;
      if (!mounted) return;
      setState(() {
        request = nextRequest;
        plan = nextPlan;
        loaded = true;
        error = null;
      });
      if (becamePublished || (nextPlan != null && !await _seen(nextPlan))) {
        if (mounted) setState(() => revealing = true);
      }
      _schedule();
    } on ApiException catch (e) {
      if (e.expired) {
        widget.session.expired();
        return;
      }
      if (mounted && !quiet) setState(() => error = e.message);
      _schedule();
    }
  }

  void _schedule() {
    _poll?.cancel();
    if (!mounted) return;
    // Poll quickly while the AI works, slowly while the doctor reviews.
    final fast =
        request?.phase == RequestPhase.queued ||
        request?.phase == RequestPhase.generating;
    if (_pending) {
      _poll = Timer(Duration(seconds: fast ? 3 : 8), () => _load(quiet: true));
    }
  }

  Future<bool> _seen(PublishedPlan p) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('reveal_${p.requestId}') ?? false;
  }

  Future<void> _markSeen() async {
    final p = plan;
    if (p == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('reveal_${p.requestId}', true);
    if (mounted) setState(() => revealing = false);
  }

  @override
  Widget build(BuildContext context) {
    Widget child;
    if (!loaded) {
      child = error == null
          ? const Scaffold(
              key: ValueKey('loading'),
              body: Center(child: CircularProgressIndicator()),
            )
          : Scaffold(
              key: const ValueKey('error'),
              body: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(error!),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('تلاش دوباره'),
                    ),
                  ],
                ),
              ),
            );
    } else if (revealing && plan != null) {
      child = PlanReveal(key: const ValueKey('reveal'), onDone: _markSeen);
    } else if (plan != null) {
      child = PlanShell(
        key: const ValueKey('plan'),
        session: widget.session,
        services: s,
        plan: plan!,
        pendingRevision: _pending ? request : null,
        profile: widget.profile,
        onRefresh: () => _load(quiet: true),
      );
    } else if (_pending) {
      child = AnalysisScreen(
        key: const ValueKey('analysis'),
        request: request!,
        services: s,
        onRefresh: () => _load(quiet: true),
        onSignOut: widget.session.signOut,
      );
    } else {
      child = PurchaseScreen(
        key: const ValueKey('purchase'),
        services: s,
        profile: widget.profile,
        cancelled: request?.phase == RequestPhase.cancelled,
        onOrdered: _load,
        onSignOut: widget.session.signOut,
      );
    }
    return AnimatedSwitcher(duration: Motion.page, child: child);
  }
}
