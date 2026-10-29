import 'dart:convert';

class ChecklistItem {
  final String t;
  final bool done;

  const ChecklistItem({required this.t, this.done = false});

  ChecklistItem copyWith({String? t, bool? done}) {
    return ChecklistItem(
      t: t ?? this.t,
      done: done ?? this.done,
    );
  }

  Map<String, dynamic> toMap() => {'t': t, 'done': done};

  factory ChecklistItem.fromMap(Map<String, dynamic> map) {
    return ChecklistItem(
      t: map['t'] ?? '',
      done: map['done'] ?? false,
    );
  }
}

class NoteModel {
  final String id;
  final String type; // 'text' or 'list'
  final String title;
  final String body;
  final List<ChecklistItem> items;
  final String? photo;
  final DateTime updatedAt;

  const NoteModel({
    required this.id,
    this.type = 'text',
    required this.title,
    this.body = '',
    this.items = const [],
    this.photo,
    required this.updatedAt,
  });

  NoteModel copyWith({
    String? id,
    String? type,
    String? title,
    String? body,
    List<ChecklistItem>? items,
    String? photo,
    DateTime? updatedAt,
  }) {
    return NoteModel(
      id: id ?? this.id,
      type: type ?? this.type,
      title: title ?? this.title,
      body: body ?? this.body,
      items: items ?? this.items,
      photo: photo ?? this.photo,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'type': type,
      'title': title,
      'body': body,
      'items': items.map((x) => x.toMap()).toList(),
      'photo': photo,
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  factory NoteModel.fromMap(Map<String, dynamic> map) {
    return NoteModel(
      id: map['id'] ?? '',
      type: map['type'] ?? 'text',
      title: map['title'] ?? '',
      body: map['body'] ?? '',
      items: (map['items'] as List<dynamic>?)
              ?.map((x) => ChecklistItem.fromMap(Map<String, dynamic>.from(x)))
              .toList() ??
          [],
      photo: map['photo'],
      updatedAt: DateTime.tryParse(map['updatedAt'] ?? '') ?? DateTime.now(),
    );
  }

  String toJson() => json.encode(toMap());

  factory NoteModel.fromJson(String source) => NoteModel.fromMap(json.decode(source));
}
