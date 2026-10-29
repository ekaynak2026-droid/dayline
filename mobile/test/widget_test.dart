import 'package:flutter_test/flutter_test.dart';
import 'package:dayline_mobile/main.dart';

void main() {
  testWidgets('DaylineApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const DaylineApp());
    expect(find.text('Tasks'), findsWidgets);
  });
}
