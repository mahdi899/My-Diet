import '../../data/customer_auth.dart';
import '../../data/connection.dart';

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

class CustomerApiClient implements ApiClient {
  CustomerApiClient(this.auth);
  final CustomerAuth auth;

  Future<dynamic> _call(
    String path,
    String method,
    Map<String, dynamic>? body,
    Map<String, String> headers,
  ) async {
    try {
      return await auth.api(path, method: method, body: body, headers: headers);
    } on AuthFailure catch (e) {
      throw ApiException(
        e.message,
        code: e.code,
        expired: e.expired,
        offline: e.fault == LinkFault.offline || e.fault == LinkFault.timeout,
      );
    }
  }

  @override
  Future<dynamic> get(String path) => _call(path, 'GET', null, const {});

  @override
  Future<dynamic> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String> headers = const {},
  }) => _call(path, 'POST', body ?? const {}, headers);

  @override
  Future<dynamic> put(String path, {Map<String, dynamic>? body}) =>
      _call(path, 'PUT', body ?? const {}, const {});

  @override
  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) =>
      _call(path, 'PATCH', body ?? const {}, const {});
}
