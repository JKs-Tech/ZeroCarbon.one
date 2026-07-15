import type { Request, Response } from 'express';
import { ApiResponse } from '../../common/response';
import type { AppRequest } from '../../common/types/api.types';
import { validateRequest } from '../../common/validation';
import { updateUserSchema } from './dto/update-user.dto';
import type { UsersService } from './users.service';

/**
 * Responsibility: Thin HTTP adapter for user management (ADMIN).
 */
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/v1/users — Admin lists all users.
   */
  public async list(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const result = await this.usersService.listUsers(req.query.page, req.query.limit);

    ApiResponse.success(res, { users: result.users }, {
      message: 'Users retrieved',
      requestId: appReq.requestId,
      pagination: result.pagination,
    });
  }

  /**
   * GET /api/v1/users/:id — Admin or self.
   */
  public async getById(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const targetId = req.params.id;

    this.usersService.assertSelfOrAdmin(appReq.user!, targetId);
    const user = await this.usersService.getById(targetId);

    ApiResponse.success(res, { user }, {
      message: 'User retrieved',
      requestId: appReq.requestId,
    });
  }

  /**
   * PATCH /api/v1/users/:id — Admin updates user role.
   */
  public async update(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const user = await this.usersService.updateUserRole(
      appReq.user!.id,
      req.params.id,
      req.body,
    );

    ApiResponse.success(res, { user }, {
      message: 'User updated',
      requestId: appReq.requestId,
    });
  }
}

/**
 * Re-export validation schemas used by routes.
 */
export const usersValidation = {
  update: validateRequest(updateUserSchema, 'body'),
};
