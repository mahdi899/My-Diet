import '../../domain/plan/nutrition_source.dart';
import '../../domain/plan/water_repository.dart';
export '../../domain/plan/water_repository.dart';

class PlanOverview {
  const PlanOverview({
    required this.programWeek,
    required this.isPublished,
    required this.publishedNote,
  });
  final DateTime? programWeek;
  final bool isPublished;
  final String publishedNote;
}

/// The home and plan presenters consume this contract, never the backing store.
abstract interface class CustomerWorkspace implements NutritionSource {
  bool get userSignedIn;
  String? get profilePhoto;
  bool get canLoadProfilePhoto;
  Future<void> loadHomePhoto();
  int? get coachWaterGlasses;
  String? get userRequestId;
  int? waterGlassesOn(DateTime date);
  void rememberWater(DateTime date, int glasses);
  int mealCheckInsOn(DateTime date);
  WaterRepository get waterLog;
  bool get serverAuthEnabled;
  bool get liveReady;
  String? get liveNotice;
  bool get hasUserRequest;
  PlanOverview get planOverview;
  bool get hasActiveShoppingPlan;
  bool get canReviewCurrentProgram;
}
