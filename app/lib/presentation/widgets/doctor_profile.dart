import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/theme.dart';
import '../../data/demo_store.dart';
import 'kit/app_card.dart';
import 'ui.dart' show PersonAvatar, showToast;

/// Public profile of the assigned doctor; personal mobile numbers stay private.
class DoctorProfile extends StatelessWidget {
  const DoctorProfile({super.key, required this.doctor, this.sample = false});
  final ExpertRecord doctor;
  final bool sample;

  static const background = Color(0xFFFCFAF6);
  static const _mint = Color(0xFFEFF7E9);

  static String _value(String text) =>
      text.trim().isEmpty ? 'ثبت نشده' : text.trim();

  String get _phone =>
      latinDigits(doctor.clinicPhone).replaceAll(RegExp(r'[\s\-()]'), '');

  Future<void> _call(BuildContext context) async {
    try {
      if (await launchUrl(
        Uri(scheme: 'tel', path: _phone),
        mode: LaunchMode.externalApplication,
      )) {
        return;
      }
    } catch (_) {
      // Keep the number visible if the device has no phone application.
    }
    if (context.mounted) {
      showToast(context, 'تماس باز نشد؛ شماره را دستی بگیر.');
    }
  }

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
    child: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 600),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _DoctorHeader(doctor: doctor),
            const SizedBox(height: 18),
            _ProfileSection(
              title: 'اطلاعات مطب',
              children: [
                _ClinicRow(
                  icon: Icons.location_on_outlined,
                  label: 'شهر',
                  value: _value(doctor.city),
                ),
                const Divider(height: 1, color: AppColors.line),
                _ClinicRow(
                  icon: Icons.apartment_rounded,
                  label: 'آدرس',
                  value: _value(doctor.address),
                ),
                const Divider(height: 1, color: AppColors.line),
                _ClinicRow(
                  icon: Icons.phone_outlined,
                  label: 'تلفن',
                  value: fa(_value(doctor.clinicPhone)),
                  phone: doctor.clinicPhone.trim().isNotEmpty,
                  action: RegExp(r'^\+?\d{8,15}$').hasMatch(_phone)
                      ? IconButton.filled(
                          key: const ValueKey('doctor-call-clinic'),
                          tooltip: 'تماس با مطب',
                          onPressed: () => _call(context),
                          style: IconButton.styleFrom(
                            backgroundColor: AppColors.emeraldDeep,
                            foregroundColor: Colors.white,
                            minimumSize: const Size.square(48),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          icon: const Icon(Icons.call_rounded, size: 22),
                        )
                      : null,
                ),
                const Divider(height: 1, color: AppColors.line),
                _ClinicRow(
                  icon: Icons.access_time_rounded,
                  label: 'ساعت پذیرش',
                  value: fa(_value(doctor.hours)),
                ),
              ],
            ),
            const SizedBox(height: 18),
            _ProfileSection(
              title: 'تحصیلات',
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 10, bottom: 2),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: _mint,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      const _ProfileIcon(Icons.school_outlined),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _value(doctor.degree),
                          style: AppTypography.body.copyWith(
                            color: AppColors.emeraldDark,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (sample)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Row(
                  children: [
                    Expanded(child: Divider(color: AppColors.line)),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 18),
                      child: Text(
                        'اطلاعات نمونه',
                        style: AppTypography.supporting,
                      ),
                    ),
                    Expanded(child: Divider(color: AppColors.line)),
                  ],
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

class _DoctorHeader extends StatelessWidget {
  const _DoctorHeader({required this.doctor});
  final ExpertRecord doctor;

  @override
  Widget build(BuildContext context) => AppCard(
    key: const ValueKey('doctor-profile-header'),
    color: DoctorProfile._mint,
    padding: EdgeInsets.zero,
    radius: 28,
    shadows: const [],
    clip: true,
    child: Stack(
      children: [
        const Positioned(
          left: -8,
          top: -16,
          child: IgnorePointer(
            child: ExcludeSemantics(
              child: SizedBox(
                width: 94,
                height: 104,
                child: CustomPaint(painter: _ProfileLeavesPainter()),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              LayoutBuilder(
                builder: (context, constraints) {
                  final compact =
                      constraints.maxWidth < 280 ||
                      MediaQuery.textScalerOf(context).scale(20) > 26;
                  final avatar = ExcludeSemantics(
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: PersonAvatar(
                        doctor.name,
                        size: compact ? 60 : 78,
                        color: const Color(0xFFD6ECD3),
                      ),
                    ),
                  );
                  final identity = Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(
                        header: true,
                        child: Text(
                          doctor.name,
                          style: AppTypography.sectionTitle.copyWith(
                            fontSize: 20,
                            color: AppColors.emeraldDark,
                          ),
                        ),
                      ),
                      if (doctor.specialty.trim().isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          doctor.specialty,
                          style: AppTypography.body.copyWith(
                            color: AppColors.inkSoft,
                          ),
                        ),
                      ],
                    ],
                  );
                  if (compact) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [avatar, const SizedBox(height: 12), identity],
                    );
                  }
                  return Row(
                    children: [
                      avatar,
                      const SizedBox(width: 14),
                      Expanded(child: identity),
                    ],
                  );
                },
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (doctor.experience.trim().isNotEmpty)
                    _ProfileBadge(
                      '${fa(doctor.experience.trim())} سال سابقه',
                      icon: Icons.calendar_month_outlined,
                    ),
                  _ProfileBadge(
                    'نظام پزشکی ${fa(DoctorProfile._value(doctor.medicalCode))}',
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _ProfileBadge extends StatelessWidget {
  const _ProfileBadge(this.label, {this.icon});
  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
    decoration: BoxDecoration(
      color: const Color(0xFFDFF0D8),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          ExcludeSemantics(child: Icon(icon, size: 17, color: pine)),
          const SizedBox(width: 6),
        ],
        Flexible(
          child: Text(
            label,
            style: AppTypography.supporting.copyWith(
              color: AppColors.emeraldDark,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    ),
  );
}

class _ProfileSection extends StatelessWidget {
  const _ProfileSection({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => AppCard(
    padding: const EdgeInsets.all(18),
    radius: 26,
    shadows: const [],
    border: Border.all(color: AppColors.line),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(
            title,
            style: AppTypography.sectionTitle.copyWith(
              color: AppColors.emeraldDark,
            ),
          ),
        ),
        const SizedBox(height: 8),
        ...children,
      ],
    ),
  );
}

class _ClinicRow extends StatelessWidget {
  const _ClinicRow({
    required this.icon,
    required this.label,
    required this.value,
    this.action,
    this.phone = false,
  });
  final IconData icon;
  final String label, value;
  final Widget? action;
  final bool phone;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Row(
      children: [
        _ProfileIcon(icon),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(label, style: AppTypography.supporting),
              const SizedBox(height: 2),
              Text(
                value,
                textDirection: phone ? TextDirection.ltr : TextDirection.rtl,
                textAlign: TextAlign.right,
                style: AppTypography.body.copyWith(
                  color: AppColors.emeraldDark,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        if (action != null) ...[const SizedBox(width: 8), action!],
      ],
    ),
  );
}

class _ProfileIcon extends StatelessWidget {
  const _ProfileIcon(this.icon);
  final IconData icon;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: DoctorProfile._mint,
        borderRadius: BorderRadius.circular(13),
      ),
      child: Icon(icon, color: AppColors.emeraldDark, size: 24),
    ),
  );
}

/// A lightweight vector version of the approved botanical corner decoration.
class _ProfileLeavesPainter extends CustomPainter {
  const _ProfileLeavesPainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 100, size.height / 110);
    final stem = Paint()
      ..color = const Color(0xFFABC86B).withValues(alpha: .5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(
      Path()
        ..moveTo(4, 106)
        ..quadraticBezierTo(20, 43, 88, 12),
      stem,
    );
    void leaf(double x, double y, double angle, double length) {
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(angle);
      canvas.drawPath(
        Path()
          ..moveTo(0, 0)
          ..quadraticBezierTo(-length * .7, -length * .4, 0, -length)
          ..quadraticBezierTo(length * .5, -length * .5, 0, 0),
        Paint()..color = const Color(0xFFB8D97D).withValues(alpha: .36),
      );
      canvas.drawLine(Offset.zero, Offset(0, -length * .86), stem);
      canvas.restore();
    }

    leaf(14, 76, -.36, 38);
    leaf(23, 61, 1.35, 40);
    leaf(35, 47, -.15, 44);
    leaf(48, 37, 1.45, 36);
    leaf(63, 26, .16, 34);
    canvas.drawPath(
      Path()
        ..moveTo(49, 36)
        ..quadraticBezierTo(68, 29, 93, 35),
      stem,
    );
    for (final at in [
      const Offset(78, 20),
      const Offset(91, 16),
      const Offset(94, 35),
    ]) {
      canvas.drawCircle(
        at,
        3,
        Paint()..color = const Color(0xFFB8D97D).withValues(alpha: .55),
      );
    }
  }

  @override
  bool shouldRepaint(_ProfileLeavesPainter oldDelegate) => false;
}
