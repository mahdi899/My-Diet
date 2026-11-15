abstract interface class WaterRepository {
  Future<Map<String, int>> history();
  Future<int> read(DateTime date);
  Future<void> write(DateTime date, int glasses);
}
