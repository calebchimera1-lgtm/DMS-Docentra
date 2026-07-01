import 'package:flutter_test/flutter_test.dart';
import 'package:docentra_mobile/models/models.dart';

void main() {
  group('DocumentItem.fromJson', () {
    test('parses a full API document payload', () {
      final doc = DocumentItem.fromJson({
        'id': 'doc-1',
        'name': 'contract.pdf',
        'fileType': 'pdf',
        'mimeType': 'application/pdf',
        'sizeBytes': '2048',
        'currentVersion': 3,
        'status': 'ACTIVE',
        'isLocked': true,
        'folderId': 'folder-1',
      });

      expect(doc.id, 'doc-1');
      expect(doc.name, 'contract.pdf');
      expect(doc.currentVersion, 3);
      expect(doc.isLocked, true);
    });

    test('falls back to sane defaults for missing optional fields', () {
      final doc = DocumentItem.fromJson({'id': 'doc-2', 'name': 'note.txt'});
      expect(doc.fileType, 'other');
      expect(doc.currentVersion, 1);
      expect(doc.isLocked, false);
      expect(doc.folderId, isNull);
    });
  });

  group('ApprovalTask.fromJson', () {
    test('extracts nested document name and step name', () {
      final task = ApprovalTask.fromJson({
        'id': 'step-1',
        'workflowInstanceId': 'wf-1',
        'status': 'PENDING',
        'workflowInstance': {
          'document': {'name': 'Invoice #42'},
        },
        'step': {'name': 'Manager Approval'},
      });

      expect(task.documentName, 'Invoice #42');
      expect(task.stepName, 'Manager Approval');
    });
  });

  group('NotificationItem.fromJson', () {
    test('parses read/unread state', () {
      final n = NotificationItem.fromJson({
        'id': 'n-1',
        'title': 'Approval requested',
        'message': 'You have a pending approval',
        'isRead': false,
        'createdAt': '2026-01-01T00:00:00.000Z',
      });
      expect(n.isRead, false);
      expect(n.title, 'Approval requested');
    });
  });
}
