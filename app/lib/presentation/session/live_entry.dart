import 'package:flutter/material.dart';
import '../../data/demo_store.dart';
import '../../core/theme/theme.dart';
import '../../core/network/api_client.dart';
import '../onboarding/consent_screen.dart';
import '../onboarding/profile_result.dart';
import '../onboarding/controller.dart';
import '../onboarding/onboarding_flow.dart';
import '../../domain/onboarding/onboarding.dart';
import '../../data/session/services.dart';
import 'live_session.dart';

/// After the phone is verified: the website answers are claimed, or the same
/// questions run inside the app. Either way the original shell opens next.
class LiveEntry extends StatefulWidget {
  const LiveEntry({super.key, required this.store});
  final DemoStore store;

  @override
  State<LiveEntry> createState() => _LiveEntryState();
}

enum _Stage { loading, error, flow, result, consent }

class _LiveEntryState extends State<LiveEntry> {
  late final Services services = ensureLiveServices(widget.store);
  _Stage stage = _Stage.loading;
  String? error;
  OnboardingController? controller;
  ProfileSummary? profile;
  bool claimed = false;

  @override
  void initState() {
    super.initState();
    bindLiveReports(widget.store);
    _open();
  }

  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    setState(() {
      stage = _Stage.loading;
      error = null;
    });
    try {
      final state = await services.onboarding.state();
      profile = state.profile;
      claimed = state.claimedFromDemo;
      switch (state.nextStep) {
        case NextStep.enterApp:
          await _enter();
        case NextStep.consent:
          if (mounted) setState(() => stage = _Stage.consent);
        case NextStep.start || NextStep.resume || NextStep.gaps:
          final spec = await services.onboarding.spec();
          controller?.dispose();
          controller = OnboardingController(
            repository: services.onboarding,
            spec: spec,
            state: state,
          );
          if (mounted) setState(() => stage = _Stage.flow);
      }
    } on ApiException catch (e) {
      if (e.expired) {
        widget.store.signOutCustomer();
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

  Future<void> _enter() async {
    await refreshLive(widget.store, profile: profile);
  }

  @override
  Widget build(BuildContext context) {
    return switch (stage) {
      _Stage.loading => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      _Stage.error => Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(error ?? '', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _open,
                  child: const Text('تلاش دوباره'),
                ),
                TextButton(
                  onPressed: () {
                    widget.store.signOutCustomer();
                  },
                  child: const Text('خروج'),
                ),
              ],
            ),
          ),
        ),
      ),
      _Stage.flow => Column(
        children: [
          if (claimed && controller!.gapsOnly)
            const Material(
              color: sage,
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Text(
                    'جواب‌های سایت را آوردیم؛ فقط چند سؤال باقی مانده.',
                    style: TextStyle(fontSize: 12, color: pine),
                  ),
                ),
              ),
            ),
          Expanded(
            child: OnboardingFlow(
              controller: controller!,
              onDone: (p) {
                profile = p;
                setState(() => stage = _Stage.result);
              },
              onExit: () {
                widget.store.signOutCustomer();
              },
            ),
          ),
        ],
      ),
      _Stage.result => ProfileResultScreen(
        profile: profile!,
        onContinue: _enter,
      ),
      _Stage.consent => ConsentScreen(
        onAccept: () async {
          await services.onboarding.consent();
          await _enter();
        },
        onSignOut: () {
          widget.store.signOutCustomer();
        },
      ),
    };
  }
}
