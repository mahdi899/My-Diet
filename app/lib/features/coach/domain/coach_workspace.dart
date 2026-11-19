abstract interface class CoachWorkspaceRepository {
  String get workspaceOwner;
  Future<Map<String, dynamic>> searchMessages(String query, {String? before});
  Future<Map<String, dynamic>> memory();
  Future<void> editMemory(String id, String? value);
}
