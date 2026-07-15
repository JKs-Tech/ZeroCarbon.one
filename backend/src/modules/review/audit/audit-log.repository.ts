import { Types } from 'mongoose';
import { AuditLogModel, type AuditLogRecord } from './audit-log.schema';
import type { AuditActionValue } from './audit.constants';

export interface CreateAuditLogInput {
  documentId: string;
  userId: string;
  action: AuditActionValue;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
  timestamp?: Date;
}

/**
 * Append-only persistence for review audit events.
 */
export class AuditLogRepository {
  public async create(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    return AuditLogModel.create({
      documentId: new Types.ObjectId(input.documentId),
      userId: new Types.ObjectId(input.userId),
      action: input.action,
      fieldName: input.fieldName,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      timestamp: input.timestamp ?? new Date(),
    });
  }

  public async createMany(inputs: CreateAuditLogInput[]): Promise<void> {
    if (inputs.length === 0) {
      return;
    }

    await AuditLogModel.insertMany(
      inputs.map((input) => ({
        documentId: new Types.ObjectId(input.documentId),
        userId: new Types.ObjectId(input.userId),
        action: input.action,
        fieldName: input.fieldName,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        timestamp: input.timestamp ?? new Date(),
      })),
    );
  }
}
