import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import { ApiError } from './errors.js';
import { verifyAccessToken } from './jwt.js';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES_KEY = 'roles';
export type Role = 'user' | 'specialist' | 'admin';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthUser {
  id: string;
  role: Role;
  sessionId: string;
}

export type AuthedRequest = Request & { user?: AuthUser };

export function actor(req: Request): AuthUser {
  const user = (req as AuthedRequest).user;
  if (!user) throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
  return user;
}

function isPublic(reflector: Reflector, context: ExecutionContext, req: Request): boolean {
  const marked = reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (marked) return true;
  const path = req.path || '';
  return !path.startsWith('/v1');
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (isPublic(this.reflector, context, req)) return true;
    const header = req.header('authorization') ?? '';
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match?.[1]) throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
    const claims = verifyAccessToken(match[1], this.env.JWT_SECRET);
    const session = await this.pool.query<{
      revoked_at: Date | null;
      role: Role;
      status: string;
    }>(
      `select s.revoked_at, u.role, u.status
       from sessions s
       join users u on u.id = s.user_id
       where s.id = $1 and s.user_id = $2 and s.absolute_expires_at > now()`,
      [claims.sid, claims.sub],
    );
    const row = session.rows[0];
    if (!row || row.revoked_at) {
      throw new ApiError(401, 'unauthorized', 'نشست پایان یافته است');
    }
    if (row.status === 'deleted') {
      throw new ApiError(403, 'account_deleted', 'این حساب حذف شده است');
    }
    if (row.status !== 'active') {
      throw new ApiError(403, 'suspended', 'این حساب غیرفعال است');
    }
    req.user = { id: claims.sub, role: row.role, sessionId: claims.sid };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (isPublic(this.reflector, context, req)) return true;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, 'forbidden', 'اجازهٔ این کار را ندارید');
    }
    return true;
  }
}
