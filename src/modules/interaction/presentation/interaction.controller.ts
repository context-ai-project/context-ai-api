import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { QueryAssistantUseCase } from '../application/use-cases/query-assistant.use-case';
import {
  QueryAssistantDto,
  QueryAssistantResponseDto,
  SourceFragmentDto,
} from './dtos/query-assistant.dto';

/**
 * Interaction Controller
 *
 * Handles HTTP requests for conversational interactions with the RAG assistant.
 *
 * Endpoints:
 * - POST /interaction/query: Query the assistant
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
@ApiTags('Interaction')
@Controller('interaction')
export class InteractionController {
  private readonly logger = new Logger(InteractionController.name);

  constructor(private readonly queryAssistantUseCase: QueryAssistantUseCase) {}

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
    } catch (error: unknown) {
      this.logger.error(
        `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
