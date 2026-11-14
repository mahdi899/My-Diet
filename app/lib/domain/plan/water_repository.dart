abstract interface class WaterRepository {
  Future<int> read(DateTime date);
  Future<void> write(DateTime date, int glasses);
}
