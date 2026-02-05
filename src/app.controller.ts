import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

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
   * @returns A greeting string indicating the service is operational
   */
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Verifica que el servidor esté funcionando correctamente',
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
