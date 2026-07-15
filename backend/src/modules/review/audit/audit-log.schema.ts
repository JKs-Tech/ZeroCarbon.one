import { Schema, model, type HydratedDocument, type Model, Types } from 'mongoose';
import { AuditAction, type AuditActionValue } from './audit.constants';

/**
 * Append-only audit log entry for review edits and approvals.
 */
export interface IAuditLog {
  documentId: Types.ObjectId;
  userId: Types.ObjectId;
  action: AuditActionValue;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
      index: true,
    },
    fieldName: {
      type: String,
      required: false,
    },
    oldValue: {
      type: String,
      required: false,
      default: null,
    },
    newValue: {
      type: String,
      required: false,
      default: null,
    },
    timestamp: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'audit_logs',
    versionKey: false,
  },
);

auditLogSchema.index({ documentId: 1, timestamp: -1 });

export type AuditLogRecord = HydratedDocument<IAuditLog>;
export type AuditLogModelType = Model<IAuditLog>;

export const AuditLogModel: AuditLogModelType = model<IAuditLog>('AuditLog', auditLogSchema);
