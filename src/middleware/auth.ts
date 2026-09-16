import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { fail } from '../utils/response';
import {
  Action,
  PermissionMap,
  SUPER_ADMIN_SLUG,
  hasPermission,
  parsePermissions,
} from '../lib/permissions';

export type AdminContext = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  roleId: string;
  roleSlug: string;
  roleName: string;
  isSuperAdmin: boolean;
  permissions: PermissionMap;
};

export interface AuthRequest extends Request {
  admin?: AdminContext;
}

type AdminWithRole = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  roleId: string;
  role: { slug: string; name: string; permissions: string };
};

export function serializeAdmin(user: AdminWithRole): AdminContext {
  const permissions = parsePermissions(user.role.permissions);
  // Only the system super-admin slug is privileged — never treat permissions="*" alone as super-admin.
  const isSuperAdmin = user.role.slug === SUPER_ADMIN_SLUG;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    roleId: user.roleId,
    roleSlug: user.role.slug,
    roleName: user.role.name,
    isSuperAdmin,
    permissions,
  };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return fail(res, 'Unauthorized', 401, undefined, 'UNAUTHORIZED');
  }
  let payload: { id: string; email: string };
  try {
    const token = header.slice(7);
    payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      id: string;
      email: string;
    };
  } catch {
    return fail(res, 'Invalid or expired token', 401, undefined, 'UNAUTHORIZED');
  }

  prisma.adminUser
    .findUnique({
      where: { id: payload.id },
      include: { role: true },
    })
    .then((user) => {
      if (!user || !user.active) {
        return fail(res, 'Unauthorized', 401, undefined, 'UNAUTHORIZED');
      }
      req.admin = serializeAdmin(user);
      next();
    })
    .catch(() => fail(res, 'Unauthorized', 401, undefined, 'UNAUTHORIZED'));
}

export function requirePermission(resource: string, action: Action) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return fail(res, 'Unauthorized', 401, undefined, 'UNAUTHORIZED');
    }
    if (hasPermission(req.admin.permissions, resource, action, req.admin.isSuperAdmin)) {
      return next();
    }
    return fail(res, 'ليس لديك صلاحية لتنفيذ هذا الإجراء', 403, undefined, 'FORBIDDEN');
  };
}
