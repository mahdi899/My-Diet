import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../data/customer_auth.dart';

class RealtimeTrackingRepository {
  RealtimeTrackingRepository({required this.auth, http.Client? client})
      : _client = client ?? http.Client();

  final CustomerAuth auth;
  final http.Client _client;

  Uri _uri(String path) {
    final root = auth.baseUrl.replaceAll(RegExp(r'/+$'), '');
    return Uri.parse('$root$path');
  }

  Map<String, String> _headers({bool sse = false}) {
    final session = auth.session;
    return {
      'Accept': sse ? 'text/event-stream' : 'application/json',
      if (session != null) 'Authorization': 'Bearer ${session.accessToken}',
    };
  }

  String _dateStr(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  Future<int> getActualConsumedKcal(DateTime date) async {
    try {
      final response = await _client.get(
        _uri('/v1/me/tracking/summary?date=${_dateStr(date)}'),
        headers: _headers(),
      );
      if (response.statusCode != 200) return -1;
      final data = json.decode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      return (data['actualKcal'] as num?)?.toInt() ?? -1;
    } catch (_) {
      return -1;
    }
  }

  Future<int> getWaterMl(DateTime date) async {
    try {
      final response = await _client.get(
        _uri('/v1/me/tracking/summary?date=${_dateStr(date)}'),
        headers: _headers(),
      );
      if (response.statusCode != 200) return -1;
      final data = json.decode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      return (data['waterMl'] as num?)?.toInt() ?? -1;
    } catch (_) {
      return -1;
    }
  }

  /// Polls actual consumption every 30 seconds while app is in foreground.
  Stream<int> watchConsumption(DateTime date) {
    return Stream.periodic(const Duration(seconds: 30), (_) => date)
        .asyncMap((d) => getActualConsumedKcal(d));
  }
}
