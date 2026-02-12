// Mock pdf-parse before any imports that use it
jest.mock('pdf-parse', () => jest.fn());

// Mock genkit before any imports
jest.mock('genkit', () => ({
  genkit: jest.fn(),
}));

jest.mock('@genkit-ai/google-genai', () => ({
  googleAI: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KnowledgeController } from '../../../../../src/modules/knowledge/presentation/knowledge.controller';
import { IngestDocumentUseCase } from '../../../../../src/modules/knowledge/application/use-cases/ingest-document.use-case';
import { DeleteSourceUseCase } from '../../../../../src/modules/knowledge/application/use-cases/delete-source.use-case';
import { SourceType } from '@shared/types';
import type { IngestDocumentResult } from '../../../../../src/modules/knowledge/application/dtos/ingest-document.dto';
import type { DeleteSourceResult } from '../../../../../src/modules/knowledge/application/dtos/delete-source.dto';
import { JwtAuthGuard } from '../../../../../src/modules/auth/guards/jwt-auth.guard';
import { RBACGuard } from '../../../../../src/modules/auth/guards/rbac.guard';
import { PermissionService } from '../../../../../src/modules/auth/application/services/permission.service';
import { TokenRevocationService } from '../../../../../src/modules/auth/application/services/token-revocation.service';

describe('KnowledgeController', () => {
  let controller: KnowledgeController;
  let mockIngestUseCase: jest.Mocked<IngestDocumentUseCase>;
  let mockDeleteUseCase: jest.Mocked<DeleteSourceUseCase>;

  beforeEach(async () => {
    // Mock IngestDocumentUseCase
    mockIngestUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<IngestDocumentUseCase>;

    // Mock DeleteSourceUseCase
    mockDeleteUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<DeleteSourceUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeController],
      providers: [
        {
          provide: IngestDocumentUseCase,
          useValue: mockIngestUseCase,
        },
        {
          provide: DeleteSourceUseCase,
          useValue: mockDeleteUseCase,
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: PermissionService,
          useValue: {
            getUserRoles: jest.fn().mockResolvedValue(['user']),
            getUserPermissions: jest.fn().mockResolvedValue(['knowledge:create']),
            hasPermission: jest.fn().mockResolvedValue(true),
            hasAnyPermission: jest.fn().mockResolvedValue(true),
            hasAllPermissions: jest.fn().mockResolvedValue(true),
            hasRole: jest.fn().mockResolvedValue(true),
            isAdmin: jest.fn().mockResolvedValue(false),
            isManager: jest.fn().mockResolvedValue(false),
            isUser: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: TokenRevocationService,
          useValue: {
            isTokenRevoked: jest.fn().mockReturnValue(false),
            revokeToken: jest.fn(),
          },
        },
        {
          provide: JwtAuthGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: RBACGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    controller = module.get<KnowledgeController>(KnowledgeController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to create mock file
  const createMockFile = (
    content: string,
    mimetype = 'application/pdf',
    size = 1000,
  ): Express.Multer.File => {
    return {
      fieldname: 'file',
      originalname: 'test.pdf',
      encoding: '7bit',
      mimetype,
      size,
      buffer: Buffer.from(content),
      stream: {} as NodeJS.ReadableStream,
      destination: '',
      filename: '',
      path: '',
    } as Express.Multer.File;
  };

  describe('uploadDocument', () => {
    it('should successfully upload and ingest a PDF document', async () => {
      // Arrange
      const mockFile = createMockFile('PDF content', 'application/pdf');
      const dto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        metadata: { author: 'Test Author' },
      };

      const expectedResult: IngestDocumentResult = {
        sourceId: 'source-123',
        title: 'Test Document',
        fragmentCount: 5,
        contentSize: 1234,
        status: 'COMPLETED',
      };

      mockIngestUseCase.execute.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.uploadDocument(mockFile, dto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockIngestUseCase.execute).toHaveBeenCalledWith({
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: mockFile.buffer,
        metadata: { author: 'Test Author' },
      });
    });

    it('should successfully upload a Markdown document', async () => {
      // Arrange
      const mockFile = createMockFile('# Markdown', 'text/markdown');
      const dto = {
        title: 'Markdown Doc',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.MARKDOWN,
      };

      const expectedResult: IngestDocumentResult = {
        sourceId: 'source-456',
        title: 'Markdown Doc',
        fragmentCount: 3,
        contentSize: 500,
        status: 'COMPLETED',
      };

      mockIngestUseCase.execute.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.uploadDocument(mockFile, dto);

      // Assert
      expect(result.sourceId).toBe('source-456');
      expect(result.status).toBe('COMPLETED');
    });

    it('should throw error if file is missing', async () => {
      // Arrange
      const dto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
      };

      // Act & Assert
      await expect(
        controller.uploadDocument(
          undefined as unknown as Express.Multer.File,
          dto,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.uploadDocument(
          undefined as unknown as Express.Multer.File,
          dto,
        ),
      ).rejects.toThrow('File is required');
    });

    it('should throw error if file is too large', async () => {
      // Arrange
      const largeFile = createMockFile(
        'x',
        'application/pdf',
        11 * 1024 * 1024, // 11MB
      );
      const dto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
      };

      // Act & Assert
      await expect(controller.uploadDocument(largeFile, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.uploadDocument(largeFile, dto)).rejects.toThrow(
        'File too large',
      );
    });

    it('should throw error for invalid MIME type', async () => {
      // Arrange
      const invalidFile = createMockFile('content', 'image/jpeg');
      const dto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
      };

      // Act & Assert
      await expect(controller.uploadDocument(invalidFile, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.uploadDocument(invalidFile, dto)).rejects.toThrow(
        'Invalid file type',
      );
    });

    it('should throw error if title is empty', async () => {
      // Arrange
      const mockFile = createMockFile('content', 'application/pdf');
      const dto = {
        title: '',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
      };

      // Act & Assert
      await expect(controller.uploadDocument(mockFile, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.uploadDocument(mockFile, dto)).rejects.toThrow(
        'Title is required',
      );
    });

    it('should throw error if title is too long', async () => {
      // Arrange
      const mockFile = createMockFile('content', 'application/pdf');
      const dto = {
        title: 'a'.repeat(256), // 256 characters
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
      };

      // Act & Assert
      await expect(controller.uploadDocument(mockFile, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.uploadDocument(mockFile, dto)).rejects.toThrow(
        '255 characters or less',
      );
    });

    it('should throw error if sectorId is empty', async () => {
      // Arrange
      const mockFile = createMockFile('content', 'application/pdf');
      const dto = {
        title: 'Test Document',
        sectorId: '',
        sourceType: SourceType.PDF,
      };

      // Act & Assert
      await expect(controller.uploadDocument(mockFile, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.uploadDocument(mockFile, dto)).rejects.toThrow(
        'SectorId is required',
      );
    });

    it('should throw error if sectorId is not a valid UUID', async () => {
      // Arrange
      const mockFile = createMockFile('content', 'application/pdf');
      const dto = {
        title: 'Test Document',
        sectorId: 'invalid-uuid',
        sourceType: SourceType.PDF,
      };

      // Act & Assert
      await expect(controller.uploadDocument(mockFile, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.uploadDocument(mockFile, dto)).rejects.toThrow(
        'valid UUID',
      );
    });

    it('should throw error if sourceType is invalid', async () => {
      // Arrange
      const mockFile = createMockFile('content', 'application/pdf');
      const dto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: 'INVALID' as unknown as SourceType,
      };

      // Act & Assert
      await expect(controller.uploadDocument(mockFile, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should trim whitespace from title and sectorId', async () => {
      // Arrange
      const mockFile = createMockFile('content', 'application/pdf');
      const dto = {
        title: '  Test Document  ',
        sectorId: '  550e8400-e29b-41d4-a716-446655440000  ',
        sourceType: SourceType.PDF,
      };

      const expectedResult: IngestDocumentResult = {
        sourceId: 'source-789',
        title: 'Test Document',
        fragmentCount: 1,
        contentSize: 100,
        status: 'COMPLETED',
      };

      mockIngestUseCase.execute.mockResolvedValue(expectedResult);

      // Act
      await controller.uploadDocument(mockFile, dto);

      // Assert
      expect(mockIngestUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Document',
          sectorId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      );
    });

    it('should handle use case errors and re-throw them', async () => {
      // Arrange
      const mockFile = createMockFile('content', 'application/pdf');
      const dto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
      };

      const error = new Error('Database connection failed');
      mockIngestUseCase.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.uploadDocument(mockFile, dto)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should accept plain text files with MARKDOWN type', async () => {
      // Arrange
      const mockFile = createMockFile('Plain text', 'text/plain');
      const dto = {
        title: 'Text Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.MARKDOWN, // Use MARKDOWN type for plain text
      };

      const expectedResult: IngestDocumentResult = {
        sourceId: 'source-text',
        title: 'Text Document',
        fragmentCount: 1,
        contentSize: 100,
        status: 'COMPLETED',
      };

      mockIngestUseCase.execute.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.uploadDocument(mockFile, dto);

      // Assert
      expect(result.status).toBe('COMPLETED');
    });

    it('should pass metadata to use case if provided', async () => {
      // Arrange
      const mockFile = createMockFile('content', 'application/pdf');
      const dto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        metadata: { author: 'John Doe', version: '1.0' },
      };

      const expectedResult: IngestDocumentResult = {
        sourceId: 'source-meta',
        title: 'Test Document',
        fragmentCount: 1,
        contentSize: 100,
        status: 'COMPLETED',
      };

      mockIngestUseCase.execute.mockResolvedValue(expectedResult);

      // Act
      await controller.uploadDocument(mockFile, dto);

      // Assert
      expect(mockIngestUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { author: 'John Doe', version: '1.0' },
        }),
      );
    });
  });

  describe('deleteDocument', () => {
    const validSourceId = '550e8400-e29b-41d4-a716-446655440000';
    const validSectorId = '660e8400-e29b-41d4-a716-446655440001';

    it('should successfully delete a knowledge source', async () => {
      const expectedResult: DeleteSourceResult = {
        sourceId: validSourceId,
        fragmentsDeleted: 5,
        vectorsDeleted: true,
      };

      mockDeleteUseCase.execute.mockResolvedValue(expectedResult);

      const result = await controller.deleteDocument(validSourceId, validSectorId);

      expect(result).toEqual(expectedResult);
      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith({
        sourceId: validSourceId,
        sectorId: validSectorId,
      });
    });

    it('should throw BadRequestException if sectorId is missing', async () => {
      await expect(
        controller.deleteDocument(validSourceId, ''),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.deleteDocument(validSourceId, ''),
      ).rejects.toThrow('sectorId query parameter is required');
    });

    it('should throw BadRequestException if sourceId is not a valid UUID', async () => {
      await expect(
        controller.deleteDocument('not-a-uuid', validSectorId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.deleteDocument('not-a-uuid', validSectorId),
      ).rejects.toThrow('sourceId must be a valid UUID');
    });

    it('should throw BadRequestException if sectorId is not a valid UUID', async () => {
      await expect(
        controller.deleteDocument(validSourceId, 'not-a-uuid'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.deleteDocument(validSourceId, 'not-a-uuid'),
      ).rejects.toThrow('sectorId must be a valid UUID');
    });

    it('should throw NotFoundException if source not found', async () => {
      mockDeleteUseCase.execute.mockRejectedValue(
        new Error('Knowledge source not found: ' + validSourceId),
      );

      await expect(
        controller.deleteDocument(validSourceId, validSectorId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if source is already deleted', async () => {
      mockDeleteUseCase.execute.mockRejectedValue(
        new Error('Knowledge source is already deleted'),
      );

      await expect(
        controller.deleteDocument(validSourceId, validSectorId),
      ).rejects.toThrow('Knowledge source is already deleted');
    });
  });
});
