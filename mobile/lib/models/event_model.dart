import 'dart:convert';

/// Dayline Etkinlik (Event) Modeli (Takvim için)
class EventModel {
  final String id;
  final String title;
  final String date; // YYYY-MM-DD
  final String? time; // HH:MM veya null
  final String? remind;
  final int color; // 1, 2, 3, 4 renk swatch

  const EventModel({
    required this.id,
    required this.title,
    required this.date,
    this.time,
    this.remind,
    this.color = 1,
  });

  EventModel copyWith({
    String? id,
    String? title,
    String? date,
    String? time,
    String? remind,
    int? color,
  }) {
    return EventModel(
      id: id ?? this.id,
      title: title ?? this.title,
      date: date ?? this.date,
      time: time ?? this.time,
      remind: remind ?? this.remind,
      color: color ?? this.color,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'date': date,
      'time': time,
      'remind': remind,
      'color': color,
    };
  }

  factory EventModel.fromMap(Map<String, dynamic> map) {
    return EventModel(
      id: map['id'] ?? '',
      title: map['title'] ?? '',
      date: map['date'] ?? '',
      time: map['time'],
      remind: map['remind'],
      color: map['color'] ?? 1,
    );
  }

  String toJson() => json.encode(toMap());

  factory EventModel.fromJson(String source) => EventModel.fromMap(json.decode(source));
}

