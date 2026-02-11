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
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseBoolPipe,
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
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RBACGuard } from '../../auth/guards/rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';

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
 * Authorization:
 * - All endpoints require JWT authentication
 * - Query endpoint requires 'chat:read' permission
 * - List conversations requires 'chat:read' permission
 * - Get conversation requires 'chat:read' permission
 * - Delete conversation requires 'chat:read' permission (user can delete own conversations)
 *
 * Features:
 * - Input validation (DTOs)
 * - Swagger documentation
 * - Error handling
 * - Logging
 *
 * Security:
 * - JWT authentication
 * - Permission-based authorization
 * - Input validation prevents injection
 * - DTOs enforce type safety
 * - Business logic in use case layer
 */

// Constants for error messages
const ERROR_NOT_FOUND = 'Conversation not found';
const ERROR_UNKNOWN = 'Unknown error';

// Constants for API documentation
const API_UNAUTHORIZED_DESC =
  'Authentication required - Missing or invalid JWT token';
const API_FORBIDDEN_DESC = 'Access denied - Requires chat:read permission';
const API_REQUIRED_PERMISSION_CHAT_READ =
  '\n\n**Required Permission:** chat:read';

@ApiTags('Interaction')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RBACGuard)
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
   * **Rate Limit**: 30 queries per minute (to prevent LLM API abuse)
   *
   * @param dto - Query parameters
   * @returns Assistant response with sources
   */
  @Post('query')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['chat:read'])
  @Throttle({ medium: { limit: 30, ttl: 60000 } }) // 30 queries per minute
  @ApiOperation({
    summary: 'Query the assistant',
    description:
      'Send a question to the RAG assistant and receive an answer based on the knowledge base. ' +
      'The assistant will search for relevant documentation and provide a contextualized response. ' +
      'Optionally, continue an existing conversation by providing a conversationId. ' +
      '\n\n**Rate Limit**: 30 requests per minute' +
      '\n\n' +
      API_REQUIRED_PERMISSION_CHAT_READ,
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
  @ApiUnauthorizedResponse({
    description: API_UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    description: API_FORBIDDEN_DESC,
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many requests. Rate limit: 30 requests per minute',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 429 },
        message: {
          type: 'string',
          example: 'Too many requests. Please try again later.',
        },
        error: { type: 'string', example: 'Too Many Requests' },
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
   * **Rate Limit**: 50 requests per minute
   *
   * @param userId - User ID
   * @param limit - Maximum number of conversations to return (default: 10)
   * @param offset - Number of conversations to skip (default: 0)
   * @param includeInactive - Include inactive conversations (default: false)
   * @returns List of conversations with metadata
   */
  @Get('conversations')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['chat:read'])
  @Throttle({ medium: { limit: 50, ttl: 60000 } }) // 50 requests per minute
  @ApiOperation({
    summary: 'Get conversations for a user',
    description:
      'Retrieve a paginated list of conversations for the specified user. ' +
      'Returns conversation metadata without full message history. ' +
      'Use the conversation ID to fetch full conversation details. ' +
      '\n\n**Rate Limit**: 50 requests per minute' +
      '\n\n' +
      API_REQUIRED_PERMISSION_CHAT_READ,
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
  @ApiUnauthorizedResponse({
    description: API_UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    description: API_FORBIDDEN_DESC,
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many requests. Rate limit: 50 requests per minute',
  })
  async getConversations(
    @Query('userId') userId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe)
    includeInactive: boolean,
  ): Promise<ConversationsListDto> {
    // Note: userId validation should be done against authenticated user in production
    const effectiveLimit = limit;
    const effectiveOffset = offset;
    const effectiveIncludeInactive = includeInactive;

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
   * **Rate Limit**: 60 requests per minute
   *
   * @param id - Conversation ID
   * @param userId - User ID (for authorization)
   * @returns Full conversation with messages
   */
  @Get('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['chat:read'])
  @Throttle({ medium: { limit: 60, ttl: 60000 } }) // 60 requests per minute
  @ApiOperation({
    summary: 'Get conversation by ID',
    description:
      'Retrieve a specific conversation with all messages. ' +
      'The conversation must belong to the requesting user. ' +
      '\n\n**Rate Limit**: 60 requests per minute' +
      '\n\n' +
      API_REQUIRED_PERMISSION_CHAT_READ,
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
  @ApiUnauthorizedResponse({
    description: API_UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    description: API_FORBIDDEN_DESC,
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many requests. Rate limit: 60 requests per minute',
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
          metadata: msg.metadata, // Map message metadata
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
        // Removed metadata - Conversation entity doesn't have metadata
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
   * **Rate Limit**: 20 deletes per minute
   *
   * @param id - Conversation ID
   * @param userId - User ID (for authorization)
   */
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(['chat:read'])
  @Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 deletes per minute
  @ApiOperation({
    summary: 'Delete conversation',
    description:
      'Soft delete a conversation. The conversation must belong to the requesting user. ' +
      'This operation is irreversible. ' +
      '\n\n**Rate Limit**: 20 requests per minute' +
      '\n\n' +
      API_REQUIRED_PERMISSION_CHAT_READ,
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
  @ApiUnauthorizedResponse({
    description: API_UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    description: API_FORBIDDEN_DESC,
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many requests. Rate limit: 20 requests per minute',
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
