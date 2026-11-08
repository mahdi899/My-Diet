/// A failed call, already phrased for the user. `code` is the server's stable error code.
class ApiException implements Exception {
  const ApiException(
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

/// The only door from features to the network. Features depend on this, never on `http`.
abstract interface class ApiClient {
  Future<dynamic> get(String path);
  Future<dynamic> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String> headers,
  });
  Future<dynamic> put(String path, {Map<String, dynamic>? body});
  Future<dynamic> patch(String path, {Map<String, dynamic>? body});
}
