import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticationClient, ManagementClient } from 'auth0';
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
 * Auth0 SDK v5 returns the response body directly when awaited.
 * This interface describes the shape of the unwrapped user response.
 */
interface Auth0UserResponseData {
  user_id?: string;
}

/**
 * Auth0 Management Service
 *
 * Wraps the Auth0 APIs to:
 * - Create users via Management API (M2M)
 * - Send password-reset emails via Authentication API
 *
 * Management API requires an M2M Application with scopes: create:users, read:users
 * Authentication API uses the same M2M client_id to trigger password reset emails.
 */
@Injectable()
export class Auth0ManagementService {
  private readonly logger = new Logger(Auth0ManagementService.name);
  private readonly managementClient: ManagementClient;
  private readonly authClient: AuthenticationClient;
  private readonly connection: string;

  constructor(private readonly configService: ConfigService) {
    const domain = this.configService.getOrThrow<string>('AUTH0_MGMT_DOMAIN');
    const clientId = this.configService.getOrThrow<string>(
      'AUTH0_MGMT_CLIENT_ID',
    );
    const clientSecret = this.configService.getOrThrow<string>(
      'AUTH0_MGMT_CLIENT_SECRET',
    );

    this.managementClient = new ManagementClient({
      domain,
      clientId,
      clientSecret,
    });

    this.authClient = new AuthenticationClient({
      domain,
      clientId,
      clientSecret,
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
   * via the password-reset email sent by Auth0.
   */
  async createUser(params: {
    email: string;
    name: string;
  }): Promise<Auth0UserResult> {
    try {
      const tempCredential = crypto.randomUUID() + TEMP_CREDENTIAL_SUFFIX;

      // Auth0 SDK v5: awaiting HttpResponsePromise returns the body directly
      const userData = (await this.managementClient.users.create({
        email: params.email,
        name: params.name,
        connection: this.connection,
        password: tempCredential,
        email_verified: false,
        verify_email: false,
      })) as Auth0UserResponseData;

      const userId = userData.user_id;

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
   * Send a password-reset email to the user
   *
   * Uses Auth0 Authentication API (POST /dbconnections/change_password).
   * Auth0 sends an email with a link for the user to set their password.
   * This is the proper way to trigger password-reset emails from Auth0.
   */
  async sendPasswordResetEmail(params: { email: string }): Promise<void> {
    try {
      await this.authClient.database.changePassword({
        email: params.email,
        connection: this.connection,
      });

      this.logger.log(`Password reset email sent to: ${params.email}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send password reset email to ${params.email}: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw new Error(
        `Failed to send password reset email: ${extractErrorMessage(error)}`,
      );
    }
  }
}
