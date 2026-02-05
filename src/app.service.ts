import { Injectable } from '@nestjs/common';

/**
 * Application Service
 *
 * Basic service for health check and application status verification
 */
@Injectable()
export class AppService {
  /**
   * Returns a hello world message for health check purposes
   * @returns A greeting string indicating the service is running
   */
  getHello(): string {
    return 'Hello World!';
  }
}
