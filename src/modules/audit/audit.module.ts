import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModel } from './infrastructure/persistence/models/audit-log.model';
import { AuditLogRepository } from './infrastructure/persistence/repositories/audit-log.repository';
import { AuditService } from './application/services/audit.service';

/**
 * Audit Module
 *
 * Provides audit logging functionality for security compliance and debugging.
 *
 * **Features**:
 * - Security event logging (login, logout, access denied, etc.)
 * - Append-only audit trail
 * - Privacy-conscious (IP masking, data sanitization)
 * - Query capabilities for compliance reporting
 *
 * **Exports**:
 * - AuditService: For use in guards, interceptors, and controllers
 *
 * **Usage**:
 * ```typescript
 * @Module({
 *   imports: [AuditModule],
 *   // ...
 * })
 * export class AppModule {}
 * ```
 *
 * Phase 6 Implementation:
 * - Issue 6.15: Audit Logging ✅
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogModel])],
  providers: [AuditService, AuditLogRepository],
  exports: [AuditService],
})
export class AuditModule {}
