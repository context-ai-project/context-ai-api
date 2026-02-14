import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';

/**
 * Application Controller
 *
 * Provides endpoints for health checks and basic application status verification
 */
@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check endpoint
   * Verifies that the server is running and responding correctly
   *
   * This endpoint is publicly accessible (no authentication required)
   *
   * @returns A greeting string indicating the service is operational
   */
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Verifica que el servidor esté funcionando correctamente. Este endpoint es público (no requiere autenticación).',
  })
  @ApiResponse({
    status: 200,
    description: 'Servidor funcionando correctamente',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
