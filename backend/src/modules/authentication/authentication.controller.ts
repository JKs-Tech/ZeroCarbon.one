import type { Request, Response } from 'express';
import { ApiResponse } from '../../common/response';
import type { AppRequest } from '../../common/types/api.types';
import { validateRequest } from '../../common/validation';
import { loginSchema } from './dto/login.dto';
import { registerSchema } from './dto/register.dto';
import type { AuthenticationService } from './authentication.service';

/**
 * Responsibility: Thin HTTP adapter for authentication endpoints.
 */
export class AuthenticationController {
  public constructor(private readonly authenticationService: AuthenticationService) {}

  /**
   * POST /api/v1/auth/register
   */
  public async register(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const result = await this.authenticationService.register(req.body);

    ApiResponse.success(res, result, {
      message: 'Registration successful',
      statusCode: 201,
      requestId: appReq.requestId,
    });
  }

  /**
   * POST /api/v1/auth/login
   */
  public async login(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const result = await this.authenticationService.login(req.body);

    ApiResponse.success(res, result, {
      message: 'Login successful',
      requestId: appReq.requestId,
    });
  }

  /**
   * GET /api/v1/auth/profile
   */
  public async profile(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const user = await this.authenticationService.getProfile(appReq.user!.id);

    ApiResponse.success(res, { user }, {
      message: 'Profile retrieved',
      requestId: appReq.requestId,
    });
  }
}

/**
 * Request validation middleware for auth routes.
 */
export const authenticationValidation = {
  register: validateRequest(registerSchema, 'body'),
  login: validateRequest(loginSchema, 'body'),
};
