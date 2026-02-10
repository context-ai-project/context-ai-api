import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ValidatedUser } from '../types/jwt-payload.type';

/**
 * CurrentUser Decorator
 *
 * Extracts the authenticated user from the request object.
 * This decorator should be used with routes protected by JwtAuthGuard.
 *
 * The user object is populated by the JwtAuthGuard after successful
 * JWT validation via the JwtStrategy.
 *
 * @example Basic usage - Get the entire user object
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile(@CurrentUser() user: ValidatedUser) {
 *   return user; // { auth0Id, email, permissions }
 * }
 * ```
 *
 * @example Extract specific property
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('my-data')
 * getMyData(@CurrentUser('auth0Id') userId: string) {
 *   return this.dataService.findByUserId(userId);
 * }
 * ```
 *
 * @example Extract email
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Post('update-preferences')
 * updatePreferences(
 *   @CurrentUser('email') email: string,
 *   @Body() preferences: UpdatePreferencesDto
 * ) {
 *   return this.userService.updatePreferences(email, preferences);
 * }
 * ```
 *
 * @param data - Optional property name to extract from user object
 * @returns The user object or a specific property
 */
export const CurrentUser = createParamDecorator(
  // eslint-disable-next-line sonarjs/function-return-type -- Decorator intentionally returns different types based on parameter
  (data: keyof ValidatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: ValidatedUser }>();
    const user = request.user;

    // Return specific property if requested, otherwise return entire user
    // eslint-disable-next-line security/detect-object-injection -- data is type-safe key of ValidatedUser
    return data !== undefined ? user[data] : user;
  },
);
