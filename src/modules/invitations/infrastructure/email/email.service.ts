import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { extractErrorMessage } from '@shared/utils';

/**
 * Invitation Email Parameters
 */
export interface InvitationEmailParams {
  to: string;
  inviteeName: string;
  role: string;
  sectorNames: string[];
  invitedByName: string;
}

/**
 * Email Service (Resend)
 *
 * Sends personalized welcome emails to invited users.
 * Uses Resend (free tier: 3,000 emails/month).
 *
 * IMPORTANT: This service does NOT throw errors on failure.
 * The critical email (password-reset) is sent by Auth0.
 * Resend emails are a nice-to-have — failures are logged as warnings.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );
    this.fromEmail = this.configService.get<string>(
      'RESEND_FROM_EMAIL',
      'Context.ai <onboarding@resend.dev>',
    );
    this.frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
  }

  /**
   * Send personalized welcome email to invited user
   *
   * Includes: name, role, sectors, and login link.
   * Sent ALONGSIDE the Auth0 password-reset email.
   */
  async sendInvitationEmail(params: InvitationEmailParams): Promise<void> {
    try {
      const sectorList =
        params.sectorNames.length > 0
          ? params.sectorNames.map((s) => `<li>${s}</li>`).join('')
          : '<li><em>Sectors will be assigned later</em></li>';

      await this.resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: 'You have been invited to Context.ai',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">Welcome to Context.ai, ${params.inviteeName}!</h2>
            <p>${params.invitedByName} has invited you to join the platform.</p>

            <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 8px;"><strong>Role:</strong> ${params.role}</p>
              <p style="margin: 0 0 8px;"><strong>Sectors:</strong></p>
              <ul style="margin: 0; padding-left: 20px;">${sectorList}</ul>
            </div>

            <p>You will receive a separate email to <strong>set up your password</strong>. Once done, you can log in at:</p>

            <a href="${this.frontendUrl}/auth/login"
               style="display: inline-block; background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
              Go to Context.ai
            </a>

            <p style="color: #71717a; font-size: 12px; margin-top: 24px;">
              If you did not expect this invitation, you can ignore this email.
            </p>
          </div>
        `,
      });

      this.logger.log(`Welcome email sent to ${params.to}`);
    } catch (error: unknown) {
      // Do NOT throw — the Auth0 password-reset email is the critical one.
      this.logger.warn(
        `Failed to send welcome email to ${params.to}: ${extractErrorMessage(error)}`,
      );
    }
  }
}
