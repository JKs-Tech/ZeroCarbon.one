/**
 * Phase 9 document status machine (active transitions):
 *
 * … → VALIDATING → VALIDATION_COMPLETED → WAITING_FOR_REVIEW → APPROVED
 * Worker stops at WAITING_FOR_REVIEW. Approval is manual via API.
 * Any unexpected terminal failure → FAILED
 *
 * Deferred: REJECTED (not in assignment)
 */
export { DocumentProcessingStatus } from '../../../common/constants';
