import 'dart:convert';

class TaskModel {
  final String id;
  final String text;
  final String date; // YYYY-MM-DD
  final String? time; // HH:MM
  final String? remind;
  final bool done;

  const TaskModel({
    required this.id,
    required this.text,
    required this.date,
    this.time,
    this.remind,
    this.done = false,
  });

  TaskModel copyWith({
    String? id,
    String? text,
    String? date,
    String? time,
    String? remind,
    bool? done,
  }) {
    return TaskModel(
      id: id ?? this.id,
      text: text ?? this.text,
      date: date ?? this.date,
      time: time ?? this.time,
      remind: remind ?? this.remind,
      done: done ?? this.done,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'text': text,
      'date': date,
      'time': time,
      'remind': remind,
      'done': done,
    };
  }

  factory TaskModel.fromMap(Map<String, dynamic> map) {
    return TaskModel(
      id: map['id'] ?? '',
      text: map['text'] ?? map['title'] ?? '',
      date: map['date'] ?? '',
      time: map['time'],
      remind: map['remind'],
      done: map['done'] ?? false,
    );
  }

  String toJson() => json.encode(toMap());

  factory TaskModel.fromJson(String source) => TaskModel.fromMap(json.decode(source));
}
