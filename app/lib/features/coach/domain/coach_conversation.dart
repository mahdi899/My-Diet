/// A saved conversation. Messages are loaded separately with cursor pagination.
class CoachConversation {
  const CoachConversation({
    required this.id,
    required this.title,
    this.preview = '',
    required this.createdAt,
    this.lastMessageAt,
  });

  final String id;
  final String title;
  final String preview;
  final DateTime createdAt;
  final DateTime? lastMessageAt;

  factory CoachConversation.fromJson(Map<String, dynamic> json) =>
      CoachConversation(
        id: json['id'] as String,
        title: json['title'] as String? ?? 'گفتگوی جدید',
        preview: json['preview'] as String? ?? '',
        createdAt: DateTime.parse(json['createdAt'] as String),
        lastMessageAt: DateTime.tryParse(
          json['lastMessageAt'] as String? ?? '',
        ),
      );
}

/// Optional capability, kept separate from the message transport for small test clients.
abstract interface class CoachConversationRepository {
  String? get conversationId;
  Future<List<CoachConversation>> listConversations();
  Future<void> selectConversation(String? id);
  Future<void> renameConversation(String id, String title);
  Future<void> deleteConversation(String id);
}
