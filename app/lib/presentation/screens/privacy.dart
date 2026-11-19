import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import '../widgets/kit/app_card.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('حریم خصوصی')),
    body: SafeArea(
      child: ListView(
        key: const ValueKey('privacy-page'),
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
        children: const [
          AppCard.tinted(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.privacy_tip_outlined, color: AppColors.emeraldDeep),
                SizedBox(height: 12),
                Text(
                  'اطلاعاتت چگونه استفاده می‌شود؟',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                ),
                SizedBox(height: 8),
                Text(
                  'اینجا می‌توانی دربارهٔ ذخیره و استفاده از اطلاعاتت در برنامه بخوانی.',
                  style: TextStyle(height: 1.8),
                ),
              ],
            ),
          ),
          SizedBox(height: 16),
          _PrivacySection(
            title: 'اطلاعاتی که وارد می‌کنی',
            body:
                'شمارهٔ همراه برای ورود به حساب استفاده می‌شود. اطلاعات فردی، پاسخ‌های پرسش‌نامه، وزن و گزارش وعده‌ها برای تنظیم برنامه و پیگیری پیشرفتت کاربرد دارند. عکس‌هایی که انتخاب و ارسال می‌کنی هم بخشی از اطلاعات ثبت‌شده‌اند.',
          ),
          _PrivacySection(
            title: 'ذخیره روی دستگاه و در حساب',
            body:
                'در حالت نمایشی، پاسخ‌ها و گفت‌وگو با مربی روی دستگاه ذخیره می‌شوند. با استفاده از حساب آنلاین، اطلاعات ثبت‌شده برای ارائهٔ خدمات به سرور ارسال می‌شوند؛ بعضی تنظیمات و پیش‌نویس‌ها نیز روی دستگاه باقی می‌مانند.',
          ),
          _PrivacySection(
            title: 'برنامهٔ غذایی و مربی هوشمند',
            body:
                'اطلاعات مرتبط با برنامه برای بررسی در اختیار متخصص مسئول قرار می‌گیرد. هنگام استفاده از مربی آنلاین، پیام‌ها، عکس‌های ارسالی و اطلاعات مرتبط با تغذیه ممکن است برای تولید پاسخ توسط سرویس هوش مصنوعی پردازش شوند.',
          ),
          _PrivacySection(
            title: 'دسترسی به عکس و میکروفون',
            body:
                'برای قابلیت‌هایی مثل انتخاب عکس یا ضبط صدا، ممکن است دسترسی دستگاه درخواست شود. می‌توانی این مجوزها را در تنظیمات دستگاه مدیریت کنی.',
          ),
          _PrivacySection(
            title: 'کنترل اطلاعاتت',
            body:
                'اطلاعات فردی و پاسخ‌ها را از پروفایل ویرایش کن. گفت‌وگوهای مربی را می‌توانی از تاریخچه حذف کنی. خروج از حساب به معنی حذف اطلاعات حساب از سرور نیست.',
          ),
        ],
      ),
    ),
  );
}

class _PrivacySection extends StatelessWidget {
  const _PrivacySection({required this.title, required this.body});
  final String title, body;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 8),
          Text(body, style: const TextStyle(height: 1.9)),
        ],
      ),
    ),
  );
}
