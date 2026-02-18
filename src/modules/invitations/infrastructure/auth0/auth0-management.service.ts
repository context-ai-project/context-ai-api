import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManagementClient } from 'auth0';
import { extractErrorMessage, extractErrorStack } from '@shared/utils';

/** Suffix appended to random UUID to satisfy Auth0 password complexity */
const TEMP_CREDENTIAL_SUFFIX = 'Aa1!';

/**
 * Auth0 User Creation Result
 */
export interface Auth0UserResult {
  userId: string;
}

/**
 * Type guard for Auth0 user response data
 */
interface Auth0UserResponseData {
  user_id?: string;
}

/**
 * Type guard for Auth0 ticket response data
 */
interface Auth0TicketResponseData {
  ticket?: string;
}

/**
 * Auth0 Management Service
 *
 * Wraps the Auth0 Management API (M2M) to:
 * - Create users in Auth0
 * - Generate password-change tickets (sends email to user)
 *
 * Requires an M2M Application with scopes: create:users, create:user_tickets, read:users
 */
@Injectable()
export class Auth0ManagementService {
  private readonly logger = new Logger(Auth0ManagementService.name);
  private readonly client: ManagementClient;
  private readonly connection: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new ManagementClient({
      domain: this.configService.getOrThrow<string>('AUTH0_MGMT_DOMAIN'),
      clientId: this.configService.getOrThrow<string>('AUTH0_MGMT_CLIENT_ID'),
      clientSecret: this.configService.getOrThrow<string>(
        'AUTH0_MGMT_CLIENT_SECRET',
      ),
    });
    this.connection = this.configService.get<string>(
      'AUTH0_DB_CONNECTION',
      'Username-Password-Authentication',
    );
  }

  /**
   * Create a user in Auth0 via Management API
   *
   * Uses a temporary random credential. The user will set their real password
   * via the password-change ticket (sent by email).
   */
  async createUser(params: {
    email: string;
    name: string;
  }): Promise<Auth0UserResult> {
    try {
      const tempCredential = crypto.randomUUID() + TEMP_CREDENTIAL_SUFFIX;

      const response = await this.client.users.create({
        email: params.email,
        name: params.name,
        connection: this.connection,
        password: tempCredential,
        email_verified: false,
      });

      const responseData = response.data as Auth0UserResponseData;
      const userId = responseData.user_id;

      if (!userId) {
        throw new Error('Auth0 did not return a user_id');
      }

      this.logger.log(`Auth0 user created: ${userId} (${params.email})`);
      return { userId };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create Auth0 user for ${params.email}: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw new Error(
        `Failed to create user in Auth0: ${extractErrorMessage(error)}`,
      );
    }
  }

  /**
   * Create a password-change ticket for a user
   *
   * Auth0 sends an email to the user with a link to set their password.
   * After setting the password, they are redirected to the result_url.
   */
  async createPasswordChangeTicket(params: {
    userId: string;
    resultUrl: string;
  }): Promise<string> {
    try {
      const response = await this.client.tickets.changePassword({
        user_id: params.userId,
        result_url: params.resultUrl,
        mark_email_as_verified: true,
      });

      const responseData = response.data as Auth0TicketResponseData;
      const ticket = responseData.ticket;

      if (!ticket) {
        throw new Error('Auth0 did not return a ticket');
      }

      this.logger.log(
        `Password change ticket created for user: ${params.userId}`,
      );
      return ticket;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create password change ticket: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw new Error(
        `Failed to create password change ticket: ${extractErrorMessage(error)}`,
      );
    }
  }
}
