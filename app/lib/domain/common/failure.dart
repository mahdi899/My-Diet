/// A user-facing failure independent of HTTP, Flutter and storage.
class AppFailure implements Exception {
  const AppFailure(
    this.message, {
    this.code,
    this.offline = false,
    this.expired = false,
  });
  final String message;
  final String? code;
  final bool offline;
  final bool expired;
  @override
  String toString() => message;
}

class CommerceException extends AppFailure {
  const CommerceException(super.message);
}
