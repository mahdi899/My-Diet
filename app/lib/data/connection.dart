import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

enum LinkFault { offline, unavailable, timeout, expired }

/// A real request result. This does not read a browser online flag.
LinkFault? classifyLink({int? status, bool timedOut = false}) {
  if (timedOut) return LinkFault.timeout;
  if (status == 401) return LinkFault.expired;
  if (status == 503 || (status != null && status >= 500)) {
    return LinkFault.unavailable;
  }
  if (status == null) return LinkFault.offline;
  return null;
}

typedef LinkProbe = Future<LinkFault?> Function();

class LinkMonitor extends ChangeNotifier {
  LinkMonitor({LinkProbe? probe}) : _probe = probe;
  final LinkProbe? _probe;
  LinkFault? fault;
  bool checking = false;
  bool ready = false;

  Future<void> check() async {
    if (checking) return;
    checking = true;
    notifyListeners();
    try {
      fault = _probe == null ? null : await _probe();
    } on TimeoutException {
      fault = LinkFault.timeout;
    } catch (_) {
      fault = LinkFault.offline;
    }
    checking = false;
    ready = true;
    notifyListeners();
  }

  void report(LinkFault? next) {
    fault = next;
    ready = true;
    checking = false;
    notifyListeners();
  }
}

Future<LinkFault?> probeHealth(String baseUrl, {http.Client? client}) async {
  final root = baseUrl.replaceAll(RegExp(r'/+$'), '');
  final ownsClient = client == null;
  final httpClient = client ?? http.Client();
  try {
    final response = await httpClient
        .get(Uri.parse('$root/health/live'))
        .timeout(const Duration(seconds: 5));
    return classifyLink(status: response.statusCode);
  } on TimeoutException {
    if (kDebugMode) debugPrint('probeHealth $root timed out');
    return LinkFault.timeout;
  } catch (error) {
    if (kDebugMode) debugPrint('probeHealth $root failed: $error');
    return LinkFault.offline;
  } finally {
    if (ownsClient) httpClient.close();
  }
}
