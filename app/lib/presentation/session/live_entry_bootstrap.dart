import '../../core/network/api_client.dart';
import '../../data/demo_store.dart';
import '../../data/session/live_entry_cache.dart';
import '../../data/session/services.dart';
import '../../domain/onboarding/onboarding.dart';
import 'live_session.dart';

bool shouldBootstrapLiveEntry(DemoStore store) =>
    store.userSignedIn &&
    store.serverAuthEnabled &&
    !store.liveReady &&
    !store.suppressLiveEntry;

/// Resolves the saved session before showing the first application screen.
Future<void> bootstrapLiveEntry(DemoStore store) async {
  if (!shouldBootstrapLiveEntry(store)) {
    store.liveEntryCache = null;
    return;
  }
  bindLiveReports(store);
  final services = ensureLiveServices(store);
  try {
    store.liveEntryCache = await _resolveLiveEntry(store, services);
  } on ApiException catch (e) {
    if (e.expired) {
      await store.signOutCustomer();
      store.liveEntryCache = null;
      return;
    }
    store.liveEntryCache = LiveEntryCacheError(e.message);
  }
}

Future<LiveEntryCache?> _resolveLiveEntry(
  DemoStore store,
  Services services,
) async {
  final state = await services.onboarding.state();
  var profile = state.profile;
  final claimed = state.claimedFromDemo;
  switch (state.nextStep) {
    case NextStep.enterApp:
      await refreshLive(store, profile: profile);
      return const LiveEntryCacheEntered();
    case NextStep.consent:
      return const LiveEntryCacheConsent();
    case NextStep.resume || NextStep.gaps when state.missing.isEmpty:
      profile = await services.onboarding.submit(patch: _legalTarget(state));
      await refreshLive(store, profile: profile);
      return const LiveEntryCacheEntered();
    case NextStep.start || NextStep.resume || NextStep.gaps:
      final spec = await services.onboarding.spec();
      return LiveEntryCacheFlow(
        state: state,
        spec: spec,
        profile: profile,
        claimed: claimed,
      );
  }
}

Map<String, Object?> _legalTarget(OnboardingState state) {
  final answers = state.draft?.answers;
  final weight = answers?['weight_kg'];
  final target = answers?['target_weight_kg'];
  if (weight is! num || target is! num) return const {};
  if (state.track == 'weight_loss' && target >= weight) {
    return {
      'target_weight_kg': double.parse((weight - 0.5).toStringAsFixed(1)),
    };
  }
  if (state.track == 'weight_gain' && target <= weight) {
    return {
      'target_weight_kg': double.parse((weight + 0.5).toStringAsFixed(1)),
    };
  }
  return const {};
}
