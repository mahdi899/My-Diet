import 'dart:typed_data';

import 'coach_events.dart';
import 'coach_message.dart';

/// Coach thread, SSE send, and the small non-chat endpoints.
abstract class CoachRepository {
  Future<CoachThreadPage> loadThread({String? cursor});

  Stream<CoachEvent> send(CoachSendRequest request, {List<int>? photoBytes});

  Future<void> persist(List<CoachMessage> messages);

  Future<Map<String, dynamic>> uploadFoodPhoto(
    List<int> bytes, {
    String filename = 'meal.jpg',
  });

  Future<CoachMessage?> patchMeal(String id, Map<String, dynamic> body);

  Future<Map<String, dynamic>> today();

  Future<CoachMessage?> postAction(String action, Map<String, dynamic> data);

  /// Private photo bytes. Null when the repository keeps photos only in memory.
  Future<Uint8List?> fetchMedia(String id);

  /// Morning brief, created once per Tehran date. Null in the local coach.
  Future<CoachDayBrief?> ensureDayBrief();

  void close() {}
}
