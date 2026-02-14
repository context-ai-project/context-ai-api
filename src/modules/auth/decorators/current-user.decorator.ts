import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ValidatedUser } from '../types/jwt-payload.type';

/**
 * Return type for the CurrentUser decorator.
 * When a property key is provided, returns the value of that property.
 * When no key is provided, returns the entire ValidatedUser object.
 */
type CurrentUserResult = ValidatedUser | ValidatedUser[keyof ValidatedUser];

/**
 * Safely extracts a specific property from the ValidatedUser object.
 * Uses explicit switch-case to avoid bracket notation (security/detect-object-injection).
 *
 * @param user - The validated user object from the JWT strategy
 * @param property - The property key to extract
 * @returns The value of the specified property
 */
function getValidatedUserProperty(
  user: ValidatedUser,
  property: keyof ValidatedUser,
): ValidatedUser[keyof ValidatedUser] {
  switch (property) {
    case 'auth0Id':
      return user.auth0Id;
    case 'email':
      return user.email;
    case 'name':
      return user.name;
    case 'picture':
      return user.picture;
    case 'permissions':
      return user.permissions;
    case 'userId':
      return user.userId;
    case 'jti':
      return user.jti;
  }
}

/**
 * Resolves the current user data from the request context.
 * Extracted as a named function with explicit return type to satisfy
 * sonarjs/function-return-type rule.
 *
 * @param data - Optional property key to extract from user object
 * @param ctx - NestJS execution context
 * @returns The entire user or a specific property value
 */
function resolveCurrentUser(
  data: keyof ValidatedUser | undefined,
  ctx: ExecutionContext,
): CurrentUserResult {
  const request = ctx.switchToHttp().getRequest<{ user: ValidatedUser }>();
  const user = request.user;

  if (data !== undefined) {
    return getValidatedUserProperty(user, data);
  }

  return user;
}

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
export const CurrentUser = createParamDecorator(resolveCurrentUser);
