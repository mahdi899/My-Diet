import '../../domain/common/failure.dart';

/// A transport failure, phrased for the user.
class ApiException extends AppFailure {
  const ApiException(super.message, {super.code, super.offline, super.expired});
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
