import 'package:flutter/material.dart';

import '../../../core/icons/diet_icon.dart';
import '../data/coach_parse.dart';

const _background = Color(0xFFFAFAF5);
const _ink = Color(0xFF183E31);
const _green = Color(0xFF087B56);
const _muted = Color(0xFF5D7064);
const _sage = Color(0xFFEDF3E9);
const _line = Color(0xFFDBE5D7);
const _terracotta = Color(0xFF99583D);

/// Presentation only: loading, editing and persistence stay in CoachMemoryPage.
class CoachMemoryView extends StatelessWidget {
  const CoachMemoryView({
    super.key,
    required this.preferences,
    required this.summary,
    required this.loaded,
    required this.busy,
    required this.error,
    required this.onRetry,
    required this.onEdit,
    required this.onForget,
  });

  final List<Map<String, dynamic>> preferences;
  final String summary;
  final bool loaded;
  final bool busy;
  final String? error;
  final VoidCallback onRetry;
  final ValueChanged<Map<String, dynamic>> onEdit;
  final ValueChanged<Map<String, dynamic>> onForget;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _background,
    appBar: AppBar(
      title: const Text('حافظه مربی'),
      titleTextStyle: const TextStyle(
        fontFamily: 'Vazirmatn',
        color: _ink,
        fontSize: 18,
        fontWeight: FontWeight.bold,
      ),
      foregroundColor: _ink,
      backgroundColor: _background,
      surfaceTintColor: Colors.transparent,
      shape: const Border(bottom: BorderSide(color: _line)),
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
            children: [
              const _MemoryIntro(),
              if (busy)
                const Padding(
                  padding: EdgeInsets.only(top: 16),
                  child: LinearProgressIndicator(
                    color: _green,
                    backgroundColor: _line,
                    semanticsLabel: 'در حال دریافت یا ذخیره حافظه',
                  ),
                ),
              if (error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Semantics(
                    liveRegion: true,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          error!,
                          style: const TextStyle(color: _terracotta),
                        ),
                        Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: TextButton(
                            onPressed: busy ? null : onRetry,
                            child: const Text('تلاش دوباره'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 24),
              Semantics(
                header: true,
                child: const Text(
                  'ترجیحات غذایی',
                  style: TextStyle(
                    color: _ink,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              for (final row in preferences)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _PreferenceCard(
                    row: row,
                    onEdit: busy ? null : () => onEdit(row),
                    onForget: busy ? null : () => onForget(row),
                  ),
                ),
              if (loaded && preferences.isEmpty)
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: _panel(),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'سلیقه‌ات رو بهم بگو',
                        style: TextStyle(
                          color: _ink,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'هنوز ترجیحی ثبت نشده. توی گفتگو بگو چه غذایی دوست داری یا چقدر برای آشپزی وقت داری.',
                        style: TextStyle(color: _muted, height: 1.8),
                      ),
                    ],
                  ),
                ),
              if (loaded) ...[
                const SizedBox(height: 12),
                _ConversationRecap(summary: summary),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}

BoxDecoration _panel({Color color = Colors.white}) => BoxDecoration(
  color: color,
  borderRadius: BorderRadius.circular(20),
  border: Border.all(color: _line),
);

class _MemoryIntro extends StatelessWidget {
  const _MemoryIntro();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: _panel(color: _sage),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final showArt =
                constraints.maxWidth >= 300 &&
                MediaQuery.textScalerOf(context).scale(14) < 21;
            return Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Semantics(
                        header: true,
                        child: const Text(
                          'چیزهایی که\nدرباره‌ات می‌دونم',
                          style: TextStyle(
                            color: _ink,
                            fontSize: 21,
                            fontWeight: FontWeight.bold,
                            height: 1.6,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'ترجیحاتت رو ببین و هر وقت خواستی تغییرشون بده.',
                        style: TextStyle(
                          color: _muted,
                          fontSize: 12,
                          height: 1.9,
                        ),
                      ),
                    ],
                  ),
                ),
                if (showArt) ...[
                  const SizedBox(width: 8),
                  const ExcludeSemantics(
                    child: CustomPaint(
                      size: Size(100, 112),
                      painter: _BookSproutPainter(),
                    ),
                  ),
                ],
              ],
            );
          },
        ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: Divider(height: 1, color: _line),
        ),
        const Text(
          'تغییر این موارد، ثبت غذا و برنامه تأییدشده رو عوض نمی‌کنه.',
          style: TextStyle(color: _muted, fontSize: 11, height: 1.8),
        ),
      ],
    ),
  );
}

class _PreferenceCard extends StatelessWidget {
  const _PreferenceCard({required this.row, this.onEdit, this.onForget});
  final Map<String, dynamic> row;
  final VoidCallback? onEdit;
  final VoidCallback? onForget;

  @override
  Widget build(BuildContext context) {
    final specialist =
        row['source'] == 'specialist' || row['key'] == 'specialist_note';
    final (label, icon) = switch (row['key']) {
      'food_like' => ('غذای موردعلاقه', DietIconKind.meal),
      'food_dislike' => ('غذایی که دوست نداری', DietIconKind.foodAllergy),
      'specialist_note' => ('یادداشت متخصص', DietIconKind.medicalNotes),
      _ => ('عادت و ترجیح', DietIconKind.clock),
    };
    return Container(
      decoration: _panel(),
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ExcludeSemantics(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _sage,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: row['key'] == 'food_dislike'
                      ? const Icon(
                          Icons.invert_colors_off_outlined,
                          size: 25,
                          color: _green,
                        )
                      : DietIcon(
                          icon,
                          size: 25,
                          color: _green,
                          monochrome: true,
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(color: _muted, fontSize: 11),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      asString(row['value']),
                      style: const TextStyle(
                        color: _ink,
                        fontSize: 15,
                        height: 1.8,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (!specialist) ...[
            const Divider(height: 1, color: _line),
            const SizedBox(height: 4),
            Wrap(
              alignment: WrapAlignment.end,
              spacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                OutlinedButton.icon(
                  onPressed: onEdit,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _green,
                    minimumSize: const Size(92, 48),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    side: const BorderSide(color: _line),
                    shape: const StadiumBorder(),
                  ),
                  icon: const Icon(Icons.edit_outlined, size: 17),
                  label: const Text('اصلاح'),
                ),
                TextButton(
                  onPressed: onForget,
                  style: TextButton.styleFrom(
                    foregroundColor: _terracotta,
                    minimumSize: const Size(88, 48),
                  ),
                  child: const Text('فراموش کن'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ConversationRecap extends StatefulWidget {
  const _ConversationRecap({required this.summary});
  final String summary;
  @override
  State<_ConversationRecap> createState() => _ConversationRecapState();
}

class _ConversationRecapState extends State<_ConversationRecap> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    // Preserve continuation lines and unfamiliar roles instead of dropping text.
    final quotes = <({String role, String text})>[];
    for (final line in widget.summary.trim().split('\n')) {
      if (line.trim().isEmpty) continue;
      final match = RegExp(r'^(کاربر|مربی):\s*(.*)$').firstMatch(line.trim());
      if (match != null) {
        quotes.add((
          role: match[1] == 'کاربر' ? 'تو' : 'مربی',
          text: match[2]!,
        ));
      } else if (quotes.isNotEmpty) {
        final previous = quotes.removeLast();
        quotes.add((role: previous.role, text: '${previous.text}\n$line'));
      } else {
        quotes.add((role: 'گفتگو', text: line));
      }
    }
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _panel(color: _sage),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.forum_outlined, color: _green, size: 23),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Semantics(
                  header: true,
                  child: const Text(
                    'مرور همین گفتگو',
                    style: TextStyle(
                      color: _ink,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              if (quotes.isNotEmpty) const SizedBox(width: 8),
              if (quotes.isNotEmpty)
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE1ECCD),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text(
                      'ذخیره‌شده',
                      style: TextStyle(color: _green, fontSize: 10),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            quotes.isEmpty
                ? 'با طولانی‌تر شدن گفتگو، گزیده پیام‌های قبلی اینجا نگه داشته می‌شه.'
                : 'گزیده صحبت‌های قبلی برای ادامه گفتگو؛ نقل صحبت‌هاست و تأیید پزشکی نیست.',
            style: const TextStyle(color: _muted, height: 1.8, fontSize: 11),
          ),
          for (final quote in (_expanded ? quotes : quotes.take(2)))
            Container(
              margin: const EdgeInsets.only(top: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    quote.role,
                    style: const TextStyle(
                      color: _green,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (_expanded)
                    SelectableText(
                      quote.text,
                      style: const TextStyle(
                        color: _ink,
                        height: 1.8,
                        fontSize: 12,
                      ),
                    )
                  else
                    Text(
                      quote.text,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: _ink,
                        height: 1.8,
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
            ),
          if (quotes.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Divider(height: 1, color: _line),
            Semantics(
              expanded: _expanded,
              child: TextButton.icon(
                onPressed: () => setState(() => _expanded = !_expanded),
                style: TextButton.styleFrom(
                  foregroundColor: _green,
                  minimumSize: const Size(48, 48),
                ),
                icon: Icon(
                  _expanded
                      ? Icons.keyboard_arrow_up
                      : Icons.keyboard_arrow_down,
                  size: 20,
                ),
                label: Text(_expanded ? 'بستن مرور گفتگو' : 'نمایش مرور گفتگو'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Small vector illustration, crisp at every screen density.
class _BookSproutPainter extends CustomPainter {
  const _BookSproutPainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 100, size.height / 112);
    final stroke = Paint()
      ..color = const Color(0xFF426A4B)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    void shape(Path path, Color color) {
      canvas.drawPath(path, Paint()..color = color);
      canvas.drawPath(path, stroke);
    }

    canvas.drawOval(
      const Rect.fromLTWH(3, 87, 94, 12),
      Paint()..color = const Color(0xFFDDE6D4),
    );
    shape(
      Path()
        ..moveTo(7, 61)
        ..quadraticBezierTo(31, 56, 49, 70)
        ..quadraticBezierTo(72, 56, 94, 62)
        ..lineTo(93, 91)
        ..quadraticBezierTo(70, 87, 49, 97)
        ..quadraticBezierTo(27, 87, 7, 91)
        ..close(),
      const Color(0xFFAFC69B),
    );
    shape(
      Path()
        ..moveTo(10, 56)
        ..quadraticBezierTo(31, 52, 49, 66)
        ..lineTo(49, 91)
        ..quadraticBezierTo(29, 80, 10, 85)
        ..close(),
      const Color(0xFFFFFDF0),
    );
    shape(
      Path()
        ..moveTo(49, 66)
        ..quadraticBezierTo(73, 50, 91, 56)
        ..lineTo(91, 85)
        ..quadraticBezierTo(70, 80, 49, 91)
        ..close(),
      const Color(0xFFF3F1DB),
    );
    final pageStroke = Paint()
      ..color = const Color(0xFFB7C3A1)
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    for (var i = 0; i < 3; i++) {
      canvas.drawPath(
        Path()
          ..moveTo(17, 64 + i * 6)
          ..quadraticBezierTo(30, 63 + i * 6, 41, 70 + i * 6),
        pageStroke,
      );
      canvas.drawPath(
        Path()
          ..moveTo(58, 70 + i * 6)
          ..quadraticBezierTo(70, 63 + i * 6, 83, 63 + i * 6),
        pageStroke,
      );
    }
    canvas.drawPath(
      Path()
        ..moveTo(50, 65)
        ..quadraticBezierTo(45, 44, 57, 21),
      stroke,
    );
    shape(
      Path()
        ..moveTo(51, 43)
        ..cubicTo(29, 45, 22, 33, 23, 22)
        ..cubicTo(39, 21, 52, 27, 51, 43)
        ..close(),
      const Color(0xFF7FAD6A),
    );
    shape(
      Path()
        ..moveTo(52, 34)
        ..cubicTo(52, 17, 66, 10, 80, 14)
        ..cubicTo(79, 29, 65, 37, 52, 34)
        ..close(),
      const Color(0xFF598F53),
    );
    canvas.drawPath(
      Path()
        ..moveTo(49, 41)
        ..lineTo(30, 28)
        ..moveTo(53, 32)
        ..lineTo(72, 19),
      stroke,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _BookSproutPainter oldDelegate) => false;
}
