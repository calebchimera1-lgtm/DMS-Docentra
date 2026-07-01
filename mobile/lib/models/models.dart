class FolderItem {
  final String id;
  final String name;
  final String? parentId;

  FolderItem({required this.id, required this.name, this.parentId});

  factory FolderItem.fromJson(Map<String, dynamic> json) =>
      FolderItem(id: json['id'], name: json['name'], parentId: json['parentId']);
}

class DocumentItem {
  final String id;
  final String name;
  final String fileType;
  final String mimeType;
  final String sizeBytes;
  final int currentVersion;
  final String status;
  final bool isLocked;
  final String? folderId;

  DocumentItem({
    required this.id,
    required this.name,
    required this.fileType,
    required this.mimeType,
    required this.sizeBytes,
    required this.currentVersion,
    required this.status,
    required this.isLocked,
    this.folderId,
  });

  factory DocumentItem.fromJson(Map<String, dynamic> json) => DocumentItem(
        id: json['id'],
        name: json['name'],
        fileType: json['fileType'] ?? 'other',
        mimeType: json['mimeType'] ?? 'application/octet-stream',
        sizeBytes: json['sizeBytes']?.toString() ?? '0',
        currentVersion: json['currentVersion'] ?? 1,
        status: json['status'] ?? 'ACTIVE',
        isLocked: json['isLocked'] ?? false,
        folderId: json['folderId'],
      );
}

class ApprovalTask {
  final String id;
  final String workflowInstanceId;
  final String documentName;
  final String stepName;
  final String status;

  ApprovalTask({
    required this.id,
    required this.workflowInstanceId,
    required this.documentName,
    required this.stepName,
    required this.status,
  });

  factory ApprovalTask.fromJson(Map<String, dynamic> json) => ApprovalTask(
        id: json['id'],
        workflowInstanceId: json['workflowInstanceId'],
        documentName: json['workflowInstance']?['document']?['name'] ?? 'Untitled document',
        stepName: json['step']?['name'] ?? 'Approval step',
        status: json['status'] ?? 'PENDING',
      );
}

class SignatureTask {
  final String id;
  final String documentId;
  final String documentName;
  final String status;

  SignatureTask({required this.id, required this.documentId, required this.documentName, required this.status});

  factory SignatureTask.fromJson(Map<String, dynamic> json) => SignatureTask(
        id: json['id'],
        documentId: json['signatureRequest']?['document']?['id'] ?? '',
        documentName: json['signatureRequest']?['document']?['name'] ?? 'Untitled document',
        status: json['status'] ?? 'PENDING',
      );
}

class NotificationItem {
  final String id;
  final String title;
  final String message;
  final bool isRead;
  final String createdAt;

  NotificationItem({required this.id, required this.title, required this.message, required this.isRead, required this.createdAt});

  factory NotificationItem.fromJson(Map<String, dynamic> json) => NotificationItem(
        id: json['id'],
        title: json['title'],
        message: json['message'],
        isRead: json['isRead'] ?? false,
        createdAt: json['createdAt'] ?? '',
      );
}
