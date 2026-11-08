import 'package:flutter/material.dart';
import '../../theme.dart';
import '../core/api.dart';
import '../core/motion.dart';
import '../onboarding/controller.dart';
import '../onboarding/onboarding_flow.dart';
import '../onboarding/repository.dart';
import '../onboarding/spec.dart';
import '../session.dart';
import 'consent_screen.dart';
import 'home_shell.dart';
import 'profile_result.dart';

/// The one decision after sign-in, made by the server:
/// finished -> app; demo answers imported -> only the gaps; draft -> resume; nothing -> fresh start.
class PostLoginGate extends StatefulWidget {
  const PostLoginGate({
    super.key,
    required this.session,
    required this.services,
  });
  final SessionController session;
  final Services services;

  @override
  State<PostLoginGate> createState() => _PostLoginGateState();
}

enum _Stage { loading, error, flow, result, consent, app }

class _PostLoginGateState extends State<PostLoginGate> {
  _Stage stage = _Stage.loading;
  String? error;
  OnboardingController? controller;
  ProfileSummary? profile;
  bool claimedFromDemo = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      stage = _Stage.loading;
      error = null;
    });
    try {
      final state = await widget.services.onboarding.state();
      claimedFromDemo = state.claimedFromDemo;
      switch (state.nextStep) {
        case NextStep.enterApp:
          profile = state.profile;
          return _go(_Stage.app);
        case NextStep.consent:
          profile = state.profile;
          return _go(_Stage.consent);
        case NextStep.start || NextStep.resume || NextStep.gaps:
          final OnboardingSpec spec = await widget.services.onboarding.spec();
          controller?.dispose();
          controller = OnboardingController(
            repository: widget.services.onboarding,
            spec: spec,
            state: state,
          );
          return _go(_Stage.flow);
      }
    } on ApiException catch (e) {
      if (e.expired) {
        widget.session.expired();
        return;
      }
      if (mounted) {
        setState(() {
          stage = _Stage.error;
          error = e.message;
        });
      }
    }
  }

  void _go(_Stage next) {
    if (mounted) setState(() => stage = next);
  }

  @override
  Widget build(BuildContext context) {
    final child = switch (stage) {
      _Stage.loading => const _Loading(key: ValueKey('loading')),
      _Stage.error => _ErrorView(
        key: const ValueKey('error'),
        message: error ?? '',
        onRetry: _load,
        onSignOut: widget.session.signOut,
      ),
      _Stage.flow => Column(
        key: const ValueKey('flow'),
        children: [
          if (claimedFromDemo && controller!.gapsOnly) const _DemoBanner(),
          Expanded(
            child: OnboardingFlow(
              controller: controller!,
              onDone: (p) {
                profile = p;
                _go(_Stage.result);
              },
              onExit: widget.session.signOut,
            ),
          ),
        ],
      ),
      _Stage.result => ProfileResultScreen(
        key: const ValueKey('result'),
        profile: profile!,
        onContinue: () => _go(_Stage.app),
      ),
      _Stage.consent => ConsentScreen(
        key: const ValueKey('consent'),
        onAccept: () async {
          await widget.services.onboarding.consent();
          _go(_Stage.app);
        },
        onSignOut: widget.session.signOut,
      ),
      _Stage.app => HomeShell(
        key: const ValueKey('app'),
        session: widget.session,
        services: widget.services,
        profile: profile,
      ),
    };
    return AnimatedSwitcher(duration: Motion.page, child: child);
  }
}

class _DemoBanner extends StatelessWidget {
  const _DemoBanner();
  @override
  Widget build(BuildContext context) => Material(
    color: sage,
    child: SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Row(
          children: const [
            Icon(Icons.check_circle, color: pine, size: 18),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'جواب‌های نسخهٔ آزمایشی‌ات رو آوردیم؛ فقط چند سؤال باقی مونده.',
                style: TextStyle(fontSize: 12, color: pine),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _Loading extends StatelessWidget {
  const _Loading({super.key});
  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({
    super.key,
    required this.message,
    required this.onRetry,
    required this.onSignOut,
  });
  final String message;
  final VoidCallback onRetry, onSignOut;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 52, color: muted),
            const SizedBox(height: 14),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 18),
            FilledButton(onPressed: onRetry, child: const Text('تلاش دوباره')),
            TextButton(onPressed: onSignOut, child: const Text('خروج از حساب')),
          ],
        ),
      ),
    ),
  );
}
