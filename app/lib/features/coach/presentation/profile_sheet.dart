import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../../data/wallet_catalog.dart';
import '../../../presentation/screens/doctor.dart';
import '../../../presentation/screens/messaging.dart';
import '../../../presentation/screens/shared.dart';
import '../../../presentation/screens/wallet_flow.dart';
import '../../../presentation/screens/weekly_feedback.dart';
import '../../../presentation/widgets/kit/kit.dart';
import '../../../presentation/widgets/ui.dart';
import '../../plan/goal_math.dart';
import 'personal_details.dart';

void showCoachProfileSheet(BuildContext context) {
  unawaited(
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const CoachProfileSheet(),
    ),
  );
}

class CoachProfileSheet extends StatelessWidget {
  const CoachProfileSheet({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.86,
      minChildSize: 0.45,
      maxChildSize: 0.94,
      builder: (context, scroll) {
        return DecoratedBox(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: AppRadius.sheet,
            boxShadow: AppShadows.lifted,
          ),
          child: ListView(
            controller: scroll,
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (!store.userSignedIn)
                const _GuestBlock()
              else
                _SignedIn(store: store),
            ],
          ),
        );
      },
    );
  }
}

class _GuestBlock extends StatelessWidget {
  const _GuestBlock();

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'برای دیدن برنامه، پیام‌ها و اطلاعات شخصی وارد حساب شو.',
          style: TextStyle(height: 1.8),
        ),
        const SizedBox(height: 16),
        PillButton(
          label: 'ورود به حساب',
          onPressed: () {
            Navigator.pop(context);
            store.openUserLogin();
          },
        ),
      ],
    );
  }
}

class _SignedIn extends StatelessWidget {
  const _SignedIn({required this.store});
  final DemoStore store;

  void _open(BuildContext context, Widget page) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
  }

  @override
  Widget build(BuildContext context) {
    final goal = goalOf(store);
    final name = store.questionnaire.name;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            PersonAvatar(name, size: 64, color: AppColors.mint),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: Theme.of(context).textTheme.titleLarge),
                  Text(
                    store.questionnaireComplete
                        ? 'اطلاعات تکمیل شده'
                        : 'حساب نمایشی',
                    style: const TextStyle(color: AppColors.muted, height: 1.6),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        AppCard(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Column(
            children: [
              MenuRow(
                'اطلاعات فردی',
                Icons.person_outline,
                onTap: () => _open(context, PersonalDetails(store: store)),
              ),
              MenuRow(
                'تغییر هدف',
                Icons.flag_outlined,
                onTap: () => _open(context, ChangeGoal(store: store)),
              ),
              MenuRow(
                'کیف پول و تعرفه‌ها',
                Icons.account_balance_wallet_outlined,
                subtitle: '${formatMoneyNumber(store.walletBalance)} تومان',
                onTap: () => openPlanServices(context),
              ),
              MenuRow(
                'مشخصات دکتر',
                Icons.medical_information_outlined,
                onTap: () => _open(context, const DoctorDetailsScreen()),
              ),
              MenuRow(
                'سفارش‌ها و پرداخت‌ها',
                Icons.credit_card_outlined,
                onTap: () => _open(context, const OrdersScreen()),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'هدف‌ها',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
              ),
              const SizedBox(height: 6),
              Text('هدف: ${goal.goal}', style: const TextStyle(height: 1.7)),
              Text(
                'وزن فعلی: ${kilos(goal.current)} کیلو',
                style: const TextStyle(height: 1.7),
              ),
              if (goal.target != null)
                Text(
                  'وزن هدف: ${kilos(goal.target!)} کیلو',
                  style: const TextStyle(height: 1.7),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppCard(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(8, 12, 8, 0),
                child: Text(
                  'یادآورها',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ),
              SwitchListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                title: const Text('اعلان‌های برنامه'),
                value: store.notificationsEnabled,
                onChanged: (value) {
                  store.notificationsEnabled = value;
                  store.update();
                },
              ),
              SwitchListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                title: const Text('یادآوری وعده‌ها'),
                subtitle: const Text('تنظیم نمایشی؛ اعلان زمان‌بندی نمی‌شود.'),
                value: store.mealReminders,
                onChanged: (value) {
                  store.mealReminders = value;
                  store.update();
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppCard(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(8, 12, 8, 4),
                child: Text(
                  'درباره برنامه',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ),
              MenuRow(
                'ثبت نظر دربارهٔ برنامه',
                Icons.rate_review_outlined,
                onTap: () => _open(context, const WeeklyFeedbackScreen()),
              ),
              MenuRow(
                'گفت‌وگو با متخصص انسانی',
                Icons.support_agent,
                subtitle: 'پشتیبانی و پیام متخصص',
                onTap: () => _open(
                  context,
                  store.serverAuthEnabled
                      ? const LiveConversationsScreen()
                      : const MessagesScreen(),
                ),
              ),
              MenuRow(
                'حریم خصوصی',
                Icons.privacy_tip_outlined,
                onTap: () => showDialog<void>(
                  context: context,
                  builder: (dialog) => AlertDialog(
                    title: const Text('حریم خصوصی'),
                    content: const Text(
                      'پاسخ‌های پرسش‌نامه روی همین دستگاه می‌مانند تا قابل ویرایش باشند. گفت‌وگو با مربی در حالت نمایشی هم روی دستگاه ذخیره می‌شود. ارسال دادهٔ سلامت به مدل زبانی فقط با ورود به حساب واقعی انجام می‌شود.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(dialog),
                        child: const Text('متوجه شدم'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        PillButton(
          label: 'خروج از حساب',
          variant: PillVariant.outline,
          onPressed: () {
            Navigator.pop(context);
            unawaited(store.signOutCustomer());
          },
        ),
      ],
    );
  }
}
