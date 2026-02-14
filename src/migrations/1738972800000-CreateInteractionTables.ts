import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create Interaction Tables
 *
 * Creates the database schema for the Interaction module:
 * - conversations: Stores conversation metadata
 * - messages: Stores individual messages within conversations
 *
 * Features:
 * - UUIDs for primary keys
 * - Timestamps (created_at, updated_at, deleted_at)
 * - Soft delete support for conversations
 * - Foreign key constraints
 * - Indexes for performance
 * - Enum for message roles
 * - JSONB for message metadata
 * - Cascade delete (messages deleted when conversation deleted)
 *
 * Relations:
 * - One conversation has many messages
 * - Messages reference conversations (with CASCADE delete)
 */
export class CreateInteractionTables1738972800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create conversations table
    await queryRunner.createTable(
      new Table({
        name: 'conversations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Reference to user (will be added in auth module)',
          },
          {
            name: 'sector_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Reference to sector for knowledge context',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
            comment: 'Soft delete timestamp',
          },
        ],
      }),
      true,
    );

    // Create messages table
    await queryRunner.createTable(
      new Table({
        name: 'messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'conversation_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Foreign key to conversations',
          },
          {
            name: 'role',
            type: 'varchar',
            length: '20',
            isNullable: false,
            comment: 'user, assistant, or system',
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment:
              'Additional metadata (source fragments, sentiment, intent, etc.)',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Add foreign key constraint with CASCADE delete
    await queryRunner.query(`
      ALTER TABLE messages
      ADD CONSTRAINT fk_messages_conversation_id
      FOREIGN KEY (conversation_id)
      REFERENCES conversations(id)
      ON DELETE CASCADE
    `);

    // Create indexes for conversations
    await queryRunner.createIndex(
      'conversations',
      new TableIndex({
        name: 'idx_conversations_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'conversations',
      new TableIndex({
        name: 'idx_conversations_sector_id',
        columnNames: ['sector_id'],
      }),
    );

    await queryRunner.createIndex(
      'conversations',
      new TableIndex({
        name: 'idx_conversations_user_sector',
        columnNames: ['user_id', 'sector_id'],
      }),
    );

    await queryRunner.createIndex(
      'conversations',
      new TableIndex({
        name: 'idx_conversations_created_at',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createIndex(
      'conversations',
      new TableIndex({
        name: 'idx_conversations_updated_at',
        columnNames: ['updated_at'],
      }),
    );

    await queryRunner.createIndex(
      'conversations',
      new TableIndex({
        name: 'idx_conversations_deleted_at',
        columnNames: ['deleted_at'],
        where: 'deleted_at IS NULL',
      }),
    );

    // Create indexes for messages
    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'idx_messages_conversation_id',
        columnNames: ['conversation_id'],
      }),
    );

    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'idx_messages_role',
        columnNames: ['role'],
      }),
    );

    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'idx_messages_created_at',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'idx_messages_conversation_created',
        columnNames: ['conversation_id', 'created_at'],
      }),
    );

    // Create trigger to auto-update updated_at timestamp for conversations
    await queryRunner.query(`
      CREATE TRIGGER update_conversations_updated_at
      BEFORE UPDATE ON conversations
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    `);

    // Add check constraints for data integrity
    await queryRunner.query(`
      ALTER TABLE messages
      ADD CONSTRAINT chk_messages_role
      CHECK (role IN ('user', 'assistant', 'system'))
    `);

    await queryRunner.query(`
      ALTER TABLE messages
      ADD CONSTRAINT chk_messages_content_not_empty
      CHECK (LENGTH(TRIM(content)) > 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations`,
    );

    // Drop tables (CASCADE will drop foreign keys and indexes automatically)
    await queryRunner.dropTable('messages', true);
    await queryRunner.dropTable('conversations', true);
  }
}
