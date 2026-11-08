import '../customer_auth.dart';
import '../connection.dart';
import '../../core/network/api_client.dart';

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
