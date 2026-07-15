/**
 * Authentication module wiring (Express composition equivalent of authentication.module.ts).
 */
export { AuthenticationService } from './authentication.service';
export type { AuthTokenResult } from './authentication.service';
export { AuthenticationController, authenticationValidation } from './authentication.controller';
export { createAuthenticationRouter } from './authentication.routes';
export { JwtStrategy } from './strategies/jwt.strategy';
export type { JwtPayload } from './interfaces/jwt-payload.interface';
export { loginSchema } from './dto/login.dto';
export type { LoginDto } from './dto/login.dto';
export { registerSchema } from './dto/register.dto';
export type { RegisterDto } from './dto/register.dto';
