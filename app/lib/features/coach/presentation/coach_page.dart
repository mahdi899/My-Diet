import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../../presentation/session/live_session.dart';
import '../presentation/coach_controller.dart';
import '../domain/coach_repository.dart';
import 'coach_header.dart';
import 'composer.dart';
import 'message_list.dart';
import 'profile_sheet.dart';
import 'today_ring_sheet.dart';

class CoachPage extends StatefulWidget {
  const CoachPage({
    super.key,
    required this.repository,
    this.prefill,
    this.autoSend,
    this.onClose,
  });

  final CoachRepository repository;
  final String? prefill;
  final String? autoSend;
  final VoidCallback? onClose;

  @override
  State<CoachPage> createState() => _CoachPageState();
}

class _CoachPageState extends State<CoachPage> {
  late final CoachController _controller = CoachController(
    repository: widget.repository,
  );
  bool _endingSession = false;

  @override
  void initState() {
    super.initState();
    _controller.onToday = (today, {required bool reloadPlan}) {
      if (!mounted) return;
      final store = DemoScope.of(context);
      if (!store.applyCoachToday(today)) return;
      final glasses = store.coachWaterGlasses;
      if (glasses != null) {
        unawaited(store.waterLog.write(store.today, glasses));
      }
      if (reloadPlan && store.serverAuthEnabled) unawaited(refreshLive(store));
    };
    _controller.addListener(_rebuild);
    Future<void>.microtask(() => _controller.start(autoSend: widget.autoSend));
  }

  void _rebuild() {
    if (!mounted) return;
    if (_controller.sessionExpired && !_endingSession) {
      _endingSession = true;
      final store = DemoScope.of(context);
      if (store.serverAuthEnabled) {
        unawaited(() async {
          try {
            await store.signOutCustomer();
          } catch (_) {
            store.logout();
          }
        }());
      }
    }
    setState(() {});
  }

  @override
  void dispose() {
    _controller.removeListener(_rebuild);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final failed = _controller.historyFailed && _controller.messages.isEmpty;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppGradients.warmBackground),
        child: SafeArea(
          child: Column(
            children: [
              CoachHeader(
                typing: _controller.typing,
                onClose: widget.onClose ?? () => closeCoachToHome(context),
                onAvatar: () => showCoachProfileSheet(context),
                onRing: () async {
                  await _controller.refreshToday();
                  if (!context.mounted) return;
                  showTodayRingSheet(context);
                },
              ),
              if (_controller.budgetNote != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Text(
                    _controller.budgetNote!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.emeraldDeep,
                      height: 1.6,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                )
              else if (_controller.error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Text(
                    _controller.error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.danger,
                      height: 1.6,
                    ),
                  ),
                ),
              Expanded(
                child: _controller.loading
                    ? const Center(child: Text('دارم گفتگو رو می‌آرم…'))
                    : failed
                    ? Center(
                        child: TextButton(
                          onPressed: _controller.retry,
                          child: const Text('تلاش دوباره'),
                        ),
                      )
                    : CoachMessageList(controller: _controller),
              ),
              CoachComposer(
                controller: _controller,
                prefill: widget.autoSend == null ? widget.prefill : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
