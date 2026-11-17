import '../../domain/onboarding/onboarding.dart';
import '../../domain/onboarding/spec.dart';

/// Result of resolving onboarding during startup splash (before [LiveEntry] mounts).
sealed class LiveEntryCache {
  const LiveEntryCache();
}

/// Onboarding is complete; live data was loaded and the shell can open.
final class LiveEntryCacheEntered extends LiveEntryCache {
  const LiveEntryCacheEntered();
}

final class LiveEntryCacheConsent extends LiveEntryCache {
  const LiveEntryCacheConsent();
}

final class LiveEntryCacheFlow extends LiveEntryCache {
  const LiveEntryCacheFlow({
    required this.state,
    required this.spec,
    required this.profile,
    required this.claimed,
  });
  final OnboardingState state;
  final OnboardingSpec spec;
  final ProfileSummary? profile;
  final bool claimed;
}

final class LiveEntryCacheError extends LiveEntryCache {
  const LiveEntryCacheError(this.message);
  final String message;
}