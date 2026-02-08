import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { QueryAssistantUseCase } from '../application/use-cases/query-assistant.use-case';
import type { IConversationRepository } from '../domain/repositories/conversation.repository.interface';
import {
  QueryAssistantDto,
  QueryAssistantResponseDto,
  SourceFragmentDto,
  ConversationsListDto,
  ConversationSummaryDto,
  ConversationDetailDto,
  MessageDto,
} from './dtos/query-assistant.dto';

/**
 * Interaction Controller
 *
 * Handles HTTP requests for conversational interactions with the RAG assistant.
 *
 * Endpoints:
 * - POST /interaction/query: Query the assistant
 * - GET /interaction/conversations: List conversations
 * - GET /interaction/conversations/:id: Get conversation details
 * - DELETE /interaction/conversations/:id: Delete conversation
 *
 * Features:
 * - Input validation (DTOs)
 * - Swagger documentation
 * - Error handling
 * - Logging
 *
 * Security:
 * - Input validation prevents injection
 * - DTOs enforce type safety
 * - Business logic in use case layer
 */

// Constants for error messages
const ERROR_NOT_FOUND = 'Conversation not found';
const ERROR_UNKNOWN = 'Unknown error';

@ApiTags('Interaction')
@Controller('interaction')
export class InteractionController {
  private readonly logger = new Logger(InteractionController.name);

  constructor(
    private readonly queryAssistantUseCase: QueryAssistantUseCase,
    @Inject('IConversationRepository')
    private readonly conversationRepository: IConversationRepository,
  ) {}

  /**
   * Query the assistant
   *
   * POST /interaction/query
   *
   * Sends a query to the RAG assistant and receives a response
   * based on the knowledge base for the specified sector.
   *
   * @param dto - Query parameters
   * @returns Assistant response with sources
   */
  @Post('query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Query the assistant',
    description:
      'Send a question to the RAG assistant and receive an answer based on the knowledge base. ' +
      'The assistant will search for relevant documentation and provide a contextualized response. ' +
      'Optionally, continue an existing conversation by providing a conversationId.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Query processed successfully',
    type: QueryAssistantResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input (validation failed)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['userId must be a UUID', 'query should not be empty'],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Internal server error' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async query(
    @Body() dto: QueryAssistantDto,
  ): Promise<QueryAssistantResponseDto> {
    const LOG_QUERY_MAX_LENGTH = 50;
    this.logger.log(
      `Query from user ${dto.userId} in sector ${dto.sectorId}: "${dto.query.substring(0, LOG_QUERY_MAX_LENGTH)}..."`,
    );

    try {
      // Execute use case
      const result = await this.queryAssistantUseCase.execute({
        userId: dto.userId,
        sectorId: dto.sectorId,
        query: dto.query,
        conversationId: dto.conversationId,
        maxResults: dto.maxResults,
        minSimilarity: dto.minSimilarity,
      });

      // Map to DTO
      const response: QueryAssistantResponseDto = {
        response: result.response,
        conversationId: result.conversationId,
        sources: result.sources.map(
          (source): SourceFragmentDto => ({
            id: source.id,
            content: source.content,
            sourceId: source.sourceId,
            similarity: source.similarity,
            metadata: source.metadata,
          }),
        ),
        timestamp: result.timestamp,
      };

      this.logger.log(
        `Query completed: conversation ${response.conversationId}, ${response.sources.length} sources`,
      );

      return response;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(ERROR_UNKNOWN);
      this.logger.error(`Query failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get conversations for a user
   *
   * GET /interaction/conversations
   *
   * Retrieves a list of conversations for the specified user with pagination.
   *
   * @param userId - User ID
   * @param limit - Maximum number of conversations to return (default: 10)
   * @param offset - Number of conversations to skip (default: 0)
   * @param includeInactive - Include inactive conversations (default: false)
   * @returns List of conversations with metadata
   */
  @Get('conversations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get conversations for a user',
    description:
      'Retrieve a paginated list of conversations for the specified user. ' +
      'Returns conversation metadata without full message history. ' +
      'Use the conversation ID to fetch full conversation details.',
  })
  @ApiQuery({
    name: 'userId',
    description: 'User ID to filter conversations',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of conversations to return',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Number of conversations to skip',
    required: false,
    type: Number,
    example: 0,
  })
  @ApiQuery({
    name: 'includeInactive',
    description: 'Include inactive conversations',
    required: false,
    type: Boolean,
    example: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversations retrieved successfully',
    type: ConversationsListDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
  })
  async getConversations(
    @Query('userId') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<ConversationsListDto> {
    const DEFAULT_LIMIT = 10;
    const DEFAULT_OFFSET = 0;
    const effectiveLimit = limit ?? DEFAULT_LIMIT;
    const effectiveOffset = offset ?? DEFAULT_OFFSET;
    const effectiveIncludeInactive = includeInactive ?? false;

    this.logger.log(
      `Getting conversations for user ${userId} (limit: ${effectiveLimit}, offset: ${effectiveOffset})`,
    );

    try {
      // Fetch conversations and total count
      const [conversations, total] = await Promise.all([
        this.conversationRepository.findByUserId(userId, {
          limit: effectiveLimit,
          offset: effectiveOffset,
          includeInactive: effectiveIncludeInactive,
        }),
        this.conversationRepository.countByUserId(userId),
      ]);

      // Map to DTOs
      const conversationDtos: ConversationSummaryDto[] = [];
      for (const conv of conversations) {
        const lastMessage =
          conv.messages.length > 0
            ? conv.messages[conv.messages.length - 1]
            : undefined;

        const dto: ConversationSummaryDto = {
          id: conv.id,
          userId: conv.userId,
          sectorId: conv.sectorId,
          title: undefined,
          isActive: conv.isActive(),
          messageCount: conv.messages.length,
          lastMessagePreview: lastMessage?.content,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        };
        conversationDtos.push(dto);
      }

      const response: ConversationsListDto = {
        conversations: conversationDtos,
        total,
        count: conversationDtos.length,
        offset: effectiveOffset,
        hasMore: effectiveOffset + conversationDtos.length < total,
      };

      this.logger.log(
        `Retrieved ${conversationDtos.length} of ${total} conversations`,
      );

      return response;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(ERROR_UNKNOWN);
      this.logger.error(
        `Failed to get conversations: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get conversation by ID
   *
   * GET /interaction/conversations/:id
   *
   * Retrieves a specific conversation with all messages.
   *
   * @param id - Conversation ID
   * @param userId - User ID (for authorization)
   * @returns Full conversation with messages
   */
  @Get('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get conversation by ID',
    description:
      'Retrieve a specific conversation with all messages. ' +
      'The conversation must belong to the requesting user.',
  })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    type: String,
  })
  @ApiQuery({
    name: 'userId',
    description: 'User ID for authorization',
    required: true,
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversation retrieved successfully',
    type: ConversationDetailDto,
  })
  @ApiNotFoundResponse({
    description: 'Conversation not found or unauthorized',
  })
  async getConversationById(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<ConversationDetailDto> {
    this.logger.log(`Getting conversation ${id} for user ${userId}`);

    try {
      const conversation = await this.conversationRepository.findById(id);

      if (!conversation || conversation.userId !== userId) {
        throw new NotFoundException(ERROR_NOT_FOUND);
      }

      // Map to DTO
      const messageDtos: MessageDto[] = [];
      for (const msg of conversation.messages) {
        const dto: MessageDto = {
          id: msg.id ?? '',
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt,
          metadata: undefined,
        };
        messageDtos.push(dto);
      }

      const response: ConversationDetailDto = {
        id: conversation.id,
        userId: conversation.userId,
        sectorId: conversation.sectorId,
        title: undefined,
        isActive: conversation.isActive(),
        messages: messageDtos,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        metadata: undefined,
      };

      this.logger.log(
        `Retrieved conversation ${id} with ${messageDtos.length} messages`,
      );

      return response;
    } catch (err: unknown) {
      if (err instanceof NotFoundException) {
        throw err;
      }

      const error = err instanceof Error ? err : new Error(ERROR_UNKNOWN);
      this.logger.error(
        `Failed to get conversation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete conversation
   *
   * DELETE /interaction/conversations/:id
   *
   * Soft deletes a conversation. The conversation must belong to the requesting user.
   *
   * @param id - Conversation ID
   * @param userId - User ID (for authorization)
   */
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete conversation',
    description:
      'Soft delete a conversation. The conversation must belong to the requesting user. ' +
      'This operation is irreversible.',
  })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    type: String,
  })
  @ApiQuery({
    name: 'userId',
    description: 'User ID for authorization',
    required: true,
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Conversation deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Conversation not found or unauthorized',
  })
  async deleteConversation(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<void> {
    this.logger.log(`Deleting conversation ${id} for user ${userId}`);

    try {
      // Verify conversation exists and belongs to user
      const conversation = await this.conversationRepository.findById(id);

      if (!conversation || conversation.userId !== userId) {
        throw new NotFoundException(ERROR_NOT_FOUND);
      }

      // Perform soft delete
      await this.conversationRepository.delete(id);

      this.logger.log(`Successfully deleted conversation ${id}`);
    } catch (err: unknown) {
      if (err instanceof NotFoundException) {
        throw err;
      }

      const error = err instanceof Error ? err : new Error(ERROR_UNKNOWN);
      this.logger.error(
        `Failed to delete conversation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
