import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme.dart';
import '../data/demo_store.dart';

void pushPage(BuildContext context, Widget page) {
  final store = DemoScope.of(context);
  if (!store.userSignedIn &&
      (store.role == AppRole.user || store.role == null)) {
    Navigator.of(context).popUntil((route) => route.isFirst);
    store.openUserLogin();
    return;
  }
  Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
}

void showToast(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(text),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
}

class PageBody extends StatelessWidget {
  const PageBody({
    super.key,
    required this.children,
    this.padding = 20,
    this.controller,
    this.scrollable = true,
    this.spacing = 18,
  });
  final List<Widget> children;
  final double padding;
  final ScrollController? controller;
  final bool scrollable;
  final double spacing;
  @override
  Widget build(BuildContext context) {
    final content = Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children
              .expand((w) => [w, SizedBox(height: spacing)])
              .toList(),
        ),
      ),
    );
    return scrollable
        ? SingleChildScrollView(
            padding: EdgeInsets.all(padding),
            controller: controller,
            child: content,
          )
        : Padding(padding: EdgeInsets.all(padding), child: content);
  }
}

class Surface extends StatelessWidget {
  const Surface({
    super.key,
    required this.child,
    this.color = Colors.white,
    this.padding = 20,
    this.onTap,
    this.radius = 22,
  });
  final double radius;
  final Widget child;
  final Color color;
  final double padding;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: color,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radius),
      side: const BorderSide(color: Color(0xFFE4EAD9)),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(padding: EdgeInsets.all(padding), child: child),
    ),
  );
}

class Heading extends StatelessWidget {
  const Heading(this.title, {super.key, this.subtitle, this.action});
  final String title;
  final String? subtitle;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            if (subtitle != null)
              Text(subtitle!, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
      ?action,
    ],
  );
}

class Tag extends StatelessWidget {
  const Tag(this.text, {super.key, this.warning = false, this.gray = false});
  final String text;
  final bool warning, gray;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: warning
          ? const Color(0xFFFFF3D8)
          : gray
          ? const Color(0xFFF0F2EA)
          : sage,
      borderRadius: BorderRadius.circular(11),
    ),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 11,
        color: warning
            ? amber
            : gray
            ? muted
            : pine,
      ),
    ),
  );
}

class Notice extends StatelessWidget {
  const Notice(
    this.text, {
    super.key,
    this.warning = false,
    this.icon = Icons.info_outline,
  });
  final String text;
  final bool warning;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: warning ? const Color(0xFFFFF4DC) : sage,
      borderRadius: BorderRadius.circular(15),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: warning ? amber : pine, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 12,
              color: warning ? amber : pine,
              height: 1.9,
            ),
          ),
        ),
      ],
    ),
  );
}

class PersonAvatar extends StatelessWidget {
  const PersonAvatar(this.name, {super.key, this.size = 46, this.color = sage});
  final String name;
  final double size;
  final Color color;
  @override
  Widget build(BuildContext context) => CircleAvatar(
    radius: size / 2,
    backgroundColor: color,
    child: Text(
      name.trim().isEmpty ? 'س' : name.trim().characters.first,
      style: TextStyle(
        color: pine,
        fontWeight: FontWeight.bold,
        fontSize: size * .35,
      ),
    ),
  );
}

class PrimaryButton extends StatelessWidget {
  const PrimaryButton(
    this.label, {
    super.key,
    required this.onPressed,
    this.icon = Icons.arrow_back_rounded,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData icon;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: FilledButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 20),
      label: Text(label),
    ),
  );
}

class InfoRows extends StatelessWidget {
  const InfoRows(this.values, {super.key});
  final Map<String, String> values;
  @override
  Widget build(BuildContext context) => Column(
    children: values.entries
        .map(
          (e) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 9),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    e.key,
                    style: const TextStyle(color: muted, fontSize: 12),
                  ),
                ),
                const SizedBox(width: 12),
                Flexible(
                  child: Text(
                    e.value,
                    textAlign: TextAlign.end,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        )
        .toList(),
  );
}

class EmptyPanel extends StatelessWidget {
  const EmptyPanel(
    this.title,
    this.description, {
    super.key,
    this.icon = Icons.hourglass_empty_rounded,
    this.action,
  });
  final String title, description;
  final IconData icon;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Surface(
    child: Column(
      children: [
        const SizedBox(height: 16),
        CircleAvatar(
          radius: 36,
          backgroundColor: sage,
          child: Icon(icon, size: 32, color: pine),
        ),
        const SizedBox(height: 18),
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 10),
        Text(
          description,
          textAlign: TextAlign.center,
          style: const TextStyle(color: muted, height: 2),
        ),
        if (action != null) ...[const SizedBox(height: 22), action!],
        const SizedBox(height: 16),
      ],
    ),
  );
}

class Metric extends StatelessWidget {
  const Metric(this.title, this.value, this.icon, {super.key, this.hint = ''});
  final String title, value, hint;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Surface(
    padding: 16,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: pine, size: 23),
        const SizedBox(height: 10),
        Text(value, style: Theme.of(context).textTheme.headlineMedium),
        Text(title, style: const TextStyle(fontSize: 12)),
        if (hint.isNotEmpty)
          Text(hint, style: Theme.of(context).textTheme.bodySmall),
      ],
    ),
  );
}

class MetricGrid extends StatelessWidget {
  const MetricGrid({super.key, required this.items});
  final List<Widget> items;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) => Wrap(
      spacing: 12,
      runSpacing: 12,
      children: items
          .map((w) => SizedBox(width: (c.maxWidth - 12) / 2, child: w))
          .toList(),
    ),
  );
}

class MenuRow extends StatelessWidget {
  const MenuRow(
    this.title,
    this.icon, {
    super.key,
    required this.onTap,
    this.subtitle,
    this.trailing,
  });
  final String title;
  final IconData icon;
  final VoidCallback? onTap;
  final String? subtitle;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
    leading: Icon(icon, color: pine),
    title: Text(title, style: const TextStyle(fontSize: 14)),
    subtitle: subtitle == null
        ? null
        : Text(subtitle!, style: const TextStyle(fontSize: 11, color: muted)),
    trailing:
        trailing ??
        const Icon(Icons.chevron_left_rounded, size: 21, color: muted),
    onTap: onTap,
  );
}

class ChoiceCard extends StatelessWidget {
  const ChoiceCard(
    this.title, {
    super.key,
    required this.selected,
    required this.onTap,
    this.subtitle = '',
    this.icon = Icons.eco_outlined,
  });
  final String title, subtitle;
  final bool selected;
  final VoidCallback onTap;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Material(
      color: selected ? sage : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: selected ? pine : const Color(0xFFE0E7D7)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Icon(icon, color: selected ? pine : muted),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    if (subtitle.isNotEmpty)
                      Text(
                        subtitle,
                        style: const TextStyle(color: muted, fontSize: 11),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                selected ? Icons.radio_button_checked : Icons.radio_button_off,
                color: selected ? pine : const Color(0xFFB3BDA7),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class FoodArt extends StatelessWidget {
  const FoodArt({super.key, this.kind = 0, this.size = 140});
  final int kind;
  final double size;
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'تصویرسازی غذا',
    child: SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _FoodPainter(kind)),
    ),
  );
}

class _FoodPainter extends CustomPainter {
  _FoodPainter(this.kind);
  final int kind;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 200, size.height / 200);
    final p = Paint(), center = const Offset(100, 100);
    canvas.drawCircle(
      const Offset(100, 104),
      88,
      p..color = const Color(0x180F4121),
    );
    canvas.drawCircle(
      center,
      87,
      p
        ..shader = const RadialGradient(
          colors: [Color(0xFFFFFFF8), Color(0xFFE4E5D5), Color(0xFFFEFFF8)],
          stops: [.75, .92, 1],
        ).createShader(const Rect.fromLTWH(10, 10, 180, 180)),
    );
    p.shader = null;
    canvas.drawCircle(
      center,
      73,
      p..color = kind == 1 ? const Color(0xFFF3E8CE) : const Color(0xFF789448),
    );
    canvas.save();
    canvas.clipPath(
      Path()..addOval(Rect.fromCircle(center: center, radius: 72)),
    );
    final random = math.Random(42 + kind);
    if (kind == 1) {
      canvas.translate(98, 100);
      canvas.rotate(-.25);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          const Rect.fromLTWH(-42, -55, 84, 110),
          const Radius.circular(20),
        ),
        p..color = const Color(0xFFA67D43),
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          const Rect.fromLTWH(-36, -49, 72, 98),
          const Radius.circular(16),
        ),
        p..color = const Color(0xFFE5C993),
      );
      canvas.drawOval(
        const Rect.fromLTWH(-30, -35, 60, 74),
        p..color = const Color(0xFFFFFDF1),
      );
      canvas.drawCircle(
        const Offset(0, 0),
        19,
        p..color = const Color(0xFFEAB64A),
      );
      canvas.drawCircle(
        const Offset(-4, -4),
        10,
        p..color = const Color(0xFFF2CA5F),
      );
    } else {
      for (var i = 0; i < 70; i++) {
        final x = 30 + random.nextDouble() * 140,
            y = 30 + random.nextDouble() * 140;
        p.color = [
          const Color(0xFF4E7E36),
          const Color(0xFF719B45),
          const Color(0xFF92AF57),
        ][i % 3];
        canvas.drawOval(
          Rect.fromCenter(
            center: Offset(x, y),
            width: 22 + random.nextDouble() * 12,
            height: 15 + random.nextDouble() * 12,
          ),
          p,
        );
      }
      for (final o in [
        const Offset(65, 60),
        const Offset(125, 135),
        const Offset(67, 132),
        const Offset(142, 73),
      ]) {
        canvas.drawCircle(o, 12, p..color = const Color(0xFFCB6046));
        canvas.drawCircle(o, 8, p..color = const Color(0xFFEFA975));
        canvas.drawLine(
          o + const Offset(-6, 0),
          o + const Offset(6, 0),
          p
            ..color = const Color(0xFFCB6046)
            ..strokeWidth = 2,
        );
      }
      for (var i = 0; i < 4; i++) {
        final rect = Rect.fromLTWH(110 + i * 7, 72 + i * 4, 17, 54);
        canvas.drawArc(
          rect,
          -1.4,
          2.8,
          false,
          p
            ..color = const Color(0xFFD8D98A)
            ..strokeWidth = 9
            ..style = PaintingStyle.stroke,
        );
        p.style = PaintingStyle.fill;
      }
      for (var i = 0; i < 22; i++) {
        final x = 50 + random.nextDouble() * 100,
            y = 50 + random.nextDouble() * 100;
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(x, y, 6, 5),
            const Radius.circular(1),
          ),
          p..color = const Color(0xFFF5E9C7),
        );
      }
    }
    canvas.restore();
    canvas.drawCircle(
      center,
      79,
      p
        ..color = const Color(0xFFCFD5BD)
        ..style = PaintingStyle.stroke
        ..strokeWidth = .7,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _FoodPainter old) => old.kind != kind;
}

class RequestTile extends StatelessWidget {
  const RequestTile(this.request, {super.key, required this.onTap});
  final DietRequest request;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Surface(
    onTap: onTap,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            PersonAvatar(request.name),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    request.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  Text(
                    'درخواست ${fa(request.id)} · ${request.wait}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_left, color: muted),
          ],
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 7,
          runSpacing: 7,
          children: [
            Tag(
              request.status.label,
              warning: request.status != PlanStatus.ready,
            ),
            if (request.revisionRequested)
              const Tag('درخواست اصلاح', warning: true),
            if (request.priority) const Tag('نیاز به توجه', warning: true),
          ],
        ),
        const SizedBox(height: 7),
        Text(request.goal, style: const TextStyle(color: muted, fontSize: 12)),
      ],
    ),
  );
}

class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.onChanged,
    this.hint = 'جست‌وجو…',
  });
  final ValueChanged<String> onChanged;
  final String hint;
  @override
  Widget build(BuildContext context) => TextField(
    onChanged: onChanged,
    decoration: InputDecoration(
      hintText: hint,
      prefixIcon: const Icon(Icons.search_rounded),
    ),
  );
}

class Filters extends StatelessWidget {
  const Filters({
    super.key,
    required this.values,
    required this.selected,
    required this.onSelected,
  });
  final List<String> values;
  final String selected;
  final ValueChanged<String> onSelected;
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: values
          .map(
            (s) => Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: ChoiceChip(
                label: Text(s, style: const TextStyle(fontSize: 12)),
                selected: selected == s,
                onSelected: (_) => onSelected(s),
                showCheckmark: false,
                selectedColor: sage,
              ),
            ),
          )
          .toList(),
    ),
  );
}
