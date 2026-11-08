import '../../core/network/api_client.dart';
import '../../domain/onboarding/onboarding.dart';
import '../../domain/onboarding/spec.dart';

class HttpOnboardingRepository implements OnboardingRepository {
  HttpOnboardingRepository(this._api);
  final ApiClient _api;

  @override
  Future<OnboardingSpec> spec() async => OnboardingSpec.fromJson(
    await _api.get('public/onboarding-spec') as Map<String, dynamic>,
  );

  @override
  Future<OnboardingState> state() async => OnboardingState.fromJson(
    await _api.get('me/onboarding') as Map<String, dynamic>,
  );

  @override
  Future<int> saveDraft({
    String? track,
    required Answers patch,
    String? stepKey,
    int? progress,
    int? baseVersion,
  }) async {
    final data =
        await _api.put(
              'me/onboarding/draft',
              body: {
                'track': ?track,
                'patch': patch,
                'stepKey': ?stepKey,
                'progress': ?progress,
                'baseVersion': ?baseVersion,
              },
            )
            as Map<String, dynamic>;
    return data['version'] as int;
  }

  @override
  Future<ProfileSummary> submit({required Answers patch}) async {
    final data =
        await _api.post(
              'me/onboarding/submit',
              body: {'patch': patch, 'consent': true},
            )
            as Map<String, dynamic>;
    return ProfileSummary.fromJson(data['profile'] as Map<String, dynamic>);
  }

  @override
  Future<void> consent() async {
    await _api.post('me/onboarding/consent');
  }
}
