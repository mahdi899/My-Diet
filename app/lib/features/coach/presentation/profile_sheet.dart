import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../../presentation/screens/doctor.dart';
import '../../../presentation/screens/privacy.dart';
import '../../../presentation/screens/wallet_flow.dart';
import '../../../presentation/screens/weekly_feedback.dart';
import '../../../presentation/widgets/kit/kit.dart';
import '../../../presentation/widgets/ui.dart';
import 'personal_details.dart';
import 'profile_goal_screen.dart';
import 'profile_photo_picker.dart';

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
        TextButton(
          onPressed: () => Navigator.of(context).push<void>(
            MaterialPageRoute(builder: (_) => const PrivacyScreen()),
          ),
          child: const Text('حریم خصوصی'),
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
    final name = store.questionnaire.name;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Semantics(
              button: true,
              label: 'تغییر عکس پروفایل',
              child: InkWell(
                key: const ValueKey('profile-photo-edit'),
                customBorder: const CircleBorder(),
                onTap: () => showProfilePhotoPicker(context, store),
                child: SizedBox.square(
                  dimension: 72,
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: PersonAvatar(
                            name,
                            size: 64,
                            color: AppColors.mint,
                            photo: store.profilePhoto,
                          ),
                        ),
                      ),
                      const Positioned(
                        bottom: 0,
                        right: 0,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: AppColors.emeraldDeep,
                            shape: BoxShape.circle,
                          ),
                          child: Padding(
                            padding: EdgeInsets.all(5),
                            child: Icon(
                              Icons.edit_outlined,
                              size: 16,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: Theme.of(context).textTheme.titleLarge),
                  Text(
                    store.sessionPhone.isNotEmpty
                        ? fa(store.sessionPhone)
                        : store.questionnaireComplete
                        ? 'اطلاعات تکمیل شده'
                        : 'حساب نمایشی',
                    textDirection: store.sessionPhone.isNotEmpty
                        ? TextDirection.ltr
                        : TextDirection.rtl,
                    style: const TextStyle(color: AppColors.muted, height: 1.6),
                  ),
                  TextButton(
                    onPressed: () => showProfilePhotoPicker(context, store),
                    child: const Text('تغییر عکس پروفایل'),
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
                'هدف من',
                Icons.flag_outlined,
                key: const ValueKey('profile-goal-menu'),
                onTap: () => _open(context, const ProfileGoalScreen()),
              ),
              MenuRow(
                'پلن‌ها و اشتراک من',
                Icons.workspace_premium_outlined,
                subtitle: store.subscriptionSummary,
                onTap: () => openPlanServices(context, browseOnly: true),
              ),
              MenuRow(
                'مشخصات دکتر',
                Icons.medical_information_outlined,
                onTap: () => _open(context, const DoctorDetailsScreen()),
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
                'حریم خصوصی',
                Icons.privacy_tip_outlined,
                onTap: () => _open(context, const PrivacyScreen()),
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
