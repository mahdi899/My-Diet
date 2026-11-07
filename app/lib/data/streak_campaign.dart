import 'day.dart';

/// Published reward campaign. The screen displays a snapshot; it does not decide eligibility.
class StreakCampaign {
  const StreakCampaign({
    required this.version,
    required this.consecutiveDays,
    required this.milestones,
    required this.effectiveOn,
    this.endsOn,
    this.qualifyingRule = 'recorded_meals',
    this.repeat = 'cycle',
    this.participantPolicy = 'finish_current_version',
  });

  final int version;
  final int consecutiveDays;
  final List<StreakMilestone> milestones;

  /// A day qualifies only when its meals are recorded. Login is never a rule.
  final String qualifyingRule;
  final DateTime effectiveOn;
  final DateTime? endsOn;
  final String repeat;
  final String participantPolicy;

  StreakCampaign copyWith({
    int? version,
    int? consecutiveDays,
    List<StreakMilestone>? milestones,
    DateTime? effectiveOn,
    DateTime? endsOn,
    String? repeat,
  }) {
    return StreakCampaign(
      version: version ?? this.version,
      consecutiveDays: consecutiveDays ?? this.consecutiveDays,
      milestones: milestones ?? this.milestones,
      effectiveOn: effectiveOn ?? this.effectiveOn,
      endsOn: endsOn ?? this.endsOn,
      repeat: repeat ?? this.repeat,
      participantPolicy: participantPolicy,
    );
  }
}

class StreakMilestone {
  const StreakMilestone({required this.day, required this.amountToman});
  final int day;
  final int amountToman;
}

enum StreakDayState {
  pending('در انتظار'),
  pendingVerification('در انتظار تأیید'),
  qualified('انجام شد'),
  missed('از دست رفت'),
  rewarded('پاداش گرفت');

  const StreakDayState(this.label);
  final String label;
}

class StreakDayStatus {
  const StreakDayStatus({required this.date, required this.state});
  final DateTime date;
  final StreakDayState state;
}

class StreakRewardGrant {
  const StreakRewardGrant({
    required this.id,
    required this.day,
    required this.amountToman,
    required this.weekKey,
  });

  final String id;
  final int day;
  final int amountToman;
  final String weekKey;
}

class StreakProgress {
  const StreakProgress({
    required this.version,
    required this.days,
    required this.consecutiveQualified,
    required this.requiredDays,
    required this.todayRequirements,
    required this.resetRule,
    required this.milestones,
    required this.claimState,
    required this.grants,
  });

  final int version;
  final List<StreakDayStatus> days;
  final int consecutiveQualified;
  final int requiredDays;
  final String todayRequirements;
  final String resetRule;
  final List<StreakMilestone> milestones;

  /// `idle`, `confirmed`, or `duplicate`.
  final String claimState;
  final List<StreakRewardGrant> grants;

  static const resetExplanation =
      'اگر یک روز وعده‌ها ثبت نشود، شمارش روزهای پیاپی از نو شروع می‌شود. ورود به برنامه یک روز را کامل نمی‌کند.';
  static const todayRule =
      'امروز همهٔ وعده‌های برنامه باید به‌عنوان مصرف‌شده ثبت شوند.';
}

DateTime _dateOnly(DateTime date) => DateTime(date.year, date.month, date.day);

/// Demo stand-in for the reward server. Widgets only read [progress].
class StreakRewardServer {
  StreakRewardServer({required this.campaign});

  StreakCampaign campaign;
  StreakCampaign? _locked;
  String? _lockedCycle;
  final Set<String> _issued = {};
  StreakProgress progress = const StreakProgress(
    version: 1,
    days: [],
    consecutiveQualified: 0,
    requiredDays: 7,
    todayRequirements: StreakProgress.todayRule,
    resetRule: StreakProgress.resetExplanation,
    milestones: [],
    claimState: 'idle',
    grants: [],
  );

  /// Login never qualifies a day and never changes the stored snapshot.
  void login() {}

  /// Updates the published campaign. A cycle that already has activity keeps its copy.
  void noteAmount(int amountToman) {
    campaign = campaign.copyWith(
      milestones: [
        for (final milestone in campaign.milestones)
          if (milestone.day == campaign.consecutiveDays)
            StreakMilestone(day: milestone.day, amountToman: amountToman)
          else
            milestone,
      ],
    );
  }

  void publish(StreakCampaign next) {
    if (next.consecutiveDays < 1 || next.consecutiveDays > 30) {
      throw StateError('تعداد روزهای پیاپی باید بین ۱ و ۳۰ باشد.');
    }
    if (next.milestones.isEmpty ||
        next.milestones.any(
          (milestone) =>
              milestone.day < 1 ||
              milestone.day > next.consecutiveDays ||
              milestone.amountToman < 0,
        )) {
      throw StateError('مایل‌ستون‌های کمپین را بررسی کن.');
    }
    campaign = StreakCampaign(
      version: campaign.version + 1,
      consecutiveDays: next.consecutiveDays,
      milestones: next.milestones,
      qualifyingRule: 'recorded_meals',
      effectiveOn: _dateOnly(next.effectiveOn),
      endsOn: next.endsOn == null ? null : _dateOnly(next.endsOn!),
      repeat: next.repeat == 'none' ? 'none' : 'cycle',
      participantPolicy: 'finish_current_version',
    );
  }

  StreakProgress settle({
    required DateTime today,
    required DateTime cycleAnchor,
    required DateTime participationStart,
    required Set<String> qualifiedDates,
    required Set<String> partialDates,
    required bool claim,
  }) {
    final day = _dateOnly(today);
    final anchor = _dateOnly(cycleAnchor);
    final joined = _dateOnly(participationStart);
    final rules = _rulesFor(day, anchor, qualifiedDates, partialDates);
    final length = rules.consecutiveDays;
    final elapsed = day.difference(anchor).inDays;
    final cycle = elapsed < 0 ? 0 : elapsed ~/ length;
    final cycleStart = anchor.add(Duration(days: cycle * length));
    if (rules.repeat == 'none' && cycle > 0) {
      progress = _empty(rules, claimState: 'idle');
      return progress;
    }
    final dates = List.generate(
      length,
      (index) => cycleStart.add(Duration(days: index)),
    );
    var consecutive = 0;
    final states = <StreakDayStatus>[];
    for (final date in dates) {
      final key = dateKey(date);
      if (date.isBefore(joined) || date.isBefore(_dateOnly(rules.effectiveOn))) {
        states.add(StreakDayStatus(date: date, state: StreakDayState.pending));
        continue;
      }
      if (rules.endsOn != null && date.isAfter(_dateOnly(rules.endsOn!))) {
        states.add(StreakDayStatus(date: date, state: StreakDayState.pending));
        continue;
      }
      if (date.isAfter(day)) {
        states.add(StreakDayStatus(date: date, state: StreakDayState.pending));
      } else if (qualifiedDates.contains(key)) {
        consecutive++;
        states.add(StreakDayStatus(date: date, state: StreakDayState.qualified));
      } else if (!date.isBefore(day) && partialDates.contains(key)) {
        states.add(
          StreakDayStatus(
            date: date,
            state: StreakDayState.pendingVerification,
          ),
        );
      } else if (date.isBefore(day)) {
        consecutive = 0;
        states.add(StreakDayStatus(date: date, state: StreakDayState.missed));
      } else {
        states.add(StreakDayStatus(date: date, state: StreakDayState.pending));
      }
    }

    final milestones = [...rules.milestones]
      ..sort((a, b) => a.day.compareTo(b.day));
    final grants = <StreakRewardGrant>[];
    var claimState = 'idle';
    var reachedIssued = false;
    for (final milestone in milestones) {
      if (consecutive < milestone.day || milestone.amountToman <= 0) continue;
      final id =
          'streak-reward-v${rules.version}-${dateKey(cycleStart)}-d${milestone.day}';
      final index = milestone.day - 1;
      if (_issued.contains(id)) {
        reachedIssued = true;
        if (index >= 0 &&
            index < states.length &&
            states[index].state == StreakDayState.qualified) {
          states[index] = StreakDayStatus(
            date: states[index].date,
            state: StreakDayState.rewarded,
          );
        }
        continue;
      }
      if (!claim) continue;
      _issued.add(id);
      grants.add(
        StreakRewardGrant(
          id: id,
          day: milestone.day,
          amountToman: milestone.amountToman,
          weekKey: dateKey(cycleStart),
        ),
      );
      if (index >= 0 &&
          index < states.length &&
          states[index].state == StreakDayState.qualified) {
        states[index] = StreakDayStatus(
          date: states[index].date,
          state: StreakDayState.rewarded,
        );
      }
    }
    if (grants.isNotEmpty) {
      claimState = 'confirmed';
    } else if (claim && reachedIssued) {
      claimState = 'duplicate';
    }
    progress = StreakProgress(
      version: rules.version,
      days: states,
      consecutiveQualified: consecutive,
      requiredDays: length,
      todayRequirements: StreakProgress.todayRule,
      resetRule: StreakProgress.resetExplanation,
      milestones: milestones,
      claimState: claimState,
      grants: grants,
    );
    return progress;
  }

  StreakCampaign _rulesFor(
    DateTime day,
    DateTime anchor,
    Set<String> qualifiedDates,
    Set<String> partialDates,
  ) {
    final length = _locked?.consecutiveDays ?? campaign.consecutiveDays;
    final elapsed = day.difference(anchor).inDays;
    final cycle = elapsed < 0 ? 0 : elapsed ~/ length;
    final cycleStart = anchor.add(Duration(days: cycle * length));
    final key = dateKey(cycleStart);
    if (_lockedCycle != null && _lockedCycle != key) {
      _locked = null;
      _lockedCycle = null;
    }
    if (_locked != null && _lockedCycle == key) return _locked!;
    final window = List.generate(
      length,
      (index) => dateKey(cycleStart.add(Duration(days: index))),
    );
    final active = window.any(
      (date) => qualifiedDates.contains(date) || partialDates.contains(date),
    );
    if (!active) return campaign;
    _locked = campaign;
    _lockedCycle = key;
    return _locked!;
  }

  StreakProgress _empty(StreakCampaign rules, {required String claimState}) {
    return StreakProgress(
      version: rules.version,
      days: const [],
      consecutiveQualified: 0,
      requiredDays: rules.consecutiveDays,
      todayRequirements: StreakProgress.todayRule,
      resetRule: StreakProgress.resetExplanation,
      milestones: rules.milestones,
      claimState: claimState,
      grants: const [],
    );
  }
}
