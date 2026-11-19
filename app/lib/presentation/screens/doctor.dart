import 'package:flutter/material.dart';
import '../../data/demo_store.dart';
import '../../core/theme/theme.dart';
import '../widgets/doctor_profile.dart';
import '../widgets/ui.dart';

class DoctorDetailsScreen extends StatelessWidget {
  const DoctorDetailsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      backgroundColor: DoctorProfile.background,
      appBar: AppBar(
        title: const Text('مشخصات دکتر'),
        backgroundColor: DoctorProfile.background,
        surfaceTintColor: Colors.transparent,
        foregroundColor: AppColors.emeraldDark,
        titleTextStyle: AppTypography.sectionTitle.copyWith(
          fontSize: 20,
          color: AppColors.emeraldDark,
        ),
      ),
      body: SafeArea(
        top: false,
        child: store.assignedDoctor == null
            ? const PageBody(
                children: [
                  EmptyPanel(
                    'متخصص هنوز مشخص نشده',
                    'اطلاعات پزشک اینجا نمایش داده می‌شود.',
                    icon: Icons.person_search_outlined,
                  ),
                ],
              )
            : DoctorProfile(
                doctor: store.assignedDoctor!,
                sample: !store.serverAuthEnabled,
              ),
      ),
    );
  }
}

class ExpertProfileEditor extends StatefulWidget {
  const ExpertProfileEditor({super.key});
  @override
  State<ExpertProfileEditor> createState() => _ExpertProfileEditorState();
}

class _ExpertProfileEditorState extends State<ExpertProfileEditor> {
  final form = GlobalKey<FormState>();
  final fields = <String, TextEditingController>{};
  ExpertRecord? draft;
  bool saving = false;
  static const labels = {
    'name': 'نام و نام خانوادگی',
    'specialty': 'تخصص',
    'medicalCode': 'کد نظام پزشکی',
    'degree': 'مدرک تحصیلی',
    'experience': 'سابقهٔ کار / سال',
    'mobile': 'شمارهٔ همراه شخصی',
    'city': 'شهر',
    'address': 'آدرس مطب',
    'clinicPhone': 'شماره تلفن مطب',
    'hours': 'روزها و ساعت پذیرش',
    'bio': 'دربارهٔ من',
  };
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (draft == null) {
      draft = DemoScope.of(context).experts.first.copy();
      final data = draft!.toJson();
      for (final key in labels.keys) {
        fields[key] = TextEditingController(text: data[key] as String? ?? '');
      }
    }
  }

  @override
  void dispose() {
    for (final f in fields.values) {
      f.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (saving || !form.currentState!.validate()) return;
    setState(() => saving = true);
    final data = draft!.toJson();
    for (final entry in fields.entries) {
      data[entry.key] = entry.value.text.trim();
    }
    try {
      await DemoScope.of(
        context,
      ).saveExpertProfile(ExpertRecord.fromJson(data));
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (mounted) showToast(context, 'ذخیره انجام نشد؛ دوباره تلاش کن.');
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('اطلاعات فردی و مطب')),
    bottomNavigationBar: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: PrimaryButton(
          saving ? 'در حال ذخیره…' : 'ثبت اطلاعات متخصص',
          onPressed: saving ? null : save,
          icon: Icons.check,
        ),
      ),
    ),
    body: Form(
      key: form,
      child: PageBody(
        spacing: 12,
        children: [
          const Heading(
            'پروفایل حرفه‌ای تو',
            subtitle:
                'اطلاعات مطب و تخصص برای کاربر نمایش داده می‌شود؛ شمارهٔ همراه شخصی نمایش عمومی ندارد.',
          ),
          for (final group in [
            (
              'اطلاعات حرفه‌ای',
              [
                'name',
                'specialty',
                'medicalCode',
                'degree',
                'experience',
                'bio',
              ],
            ),
            ('اطلاعات مطب', ['city', 'address', 'clinicPhone', 'hours']),
            ('حساب شخصی', ['mobile']),
          ])
            Surface(
              radius: 14,
              padding: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Heading(group.$1),
                  const SizedBox(height: 14),
                  for (final entry in labels.entries.where(
                    (e) => group.$2.contains(e.key),
                  ))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: TextFormField(
                        key: ValueKey('expert-${entry.key}'),
                        controller: fields[entry.key],
                        enabled: !saving,
                        minLines: entry.key == 'address' || entry.key == 'bio'
                            ? 2
                            : 1,
                        maxLines: entry.key == 'address' || entry.key == 'bio'
                            ? 4
                            : 1,
                        keyboardType:
                            entry.key == 'clinicPhone' || entry.key == 'mobile'
                            ? TextInputType.phone
                            : entry.key == 'experience'
                            ? TextInputType.number
                            : TextInputType.text,
                        decoration: InputDecoration(labelText: entry.value),
                        validator: (v) {
                          final text = (v ?? '').trim();
                          if ([
                                'name',
                                'specialty',
                                'medicalCode',
                                'address',
                                'clinicPhone',
                                'city',
                              ].contains(entry.key) &&
                              text.isEmpty) {
                            return 'این قسمت را تکمیل کن.';
                          }
                          if (text.isNotEmpty &&
                              (entry.key == 'clinicPhone' ||
                                  entry.key == 'mobile') &&
                              !RegExp(r'^\+?\d{8,15}$').hasMatch(
                                latinDigits(
                                  text,
                                ).replaceAll(RegExp(r'[\s\-()]'), ''),
                              )) {
                            return 'شمارهٔ تلفن معتبر وارد کن.';
                          }
                          if (text.isNotEmpty && entry.key == 'experience') {
                            final n = int.tryParse(latinDigits(text));
                            if (n == null || n < 0 || n > 80) {
                              return 'تعداد سال معتبر وارد کن.';
                            }
                          }
                          return null;
                        },
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}
