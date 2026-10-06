"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeAdmin = serializeAdmin;
exports.requireAdmin = requireAdmin;
exports.requirePermission = requirePermission;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const response_1 = require("../utils/response");
const permissions_1 = require("../lib/permissions");
function serializeAdmin(user) {
    const permissions = (0, permissions_1.parsePermissions)(user.role.permissions);
    // Only the system super-admin slug is privileged — never treat permissions="*" alone as super-admin.
    const isSuperAdmin = user.role.slug === permissions_1.SUPER_ADMIN_SLUG;
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
function requireAdmin(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return (0, response_1.fail)(res, 'Unauthorized', 401, undefined, 'UNAUTHORIZED');
    }
    let payload;
    try {
        const token = header.slice(7);
        payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
    }
    catch {
        return (0, response_1.fail)(res, 'Invalid or expired token', 401, undefined, 'UNAUTHORIZED');
    }
    prisma_1.prisma.adminUser
        .findUnique({
        where: { id: payload.id },
        include: { role: true },
    })
        .then((user) => {
        if (!user || !user.active) {
            return (0, response_1.fail)(res, 'Unauthorized', 401, undefined, 'UNAUTHORIZED');
        }
        req.admin = serializeAdmin(user);
        next();
    })
        .catch(() => (0, response_1.fail)(res, 'Unauthorized', 401, undefined, 'UNAUTHORIZED'));
}
function requirePermission(resource, action) {
    return (req, res, next) => {
        if (!req.admin) {
            return (0, response_1.fail)(res, 'Unauthorized', 401, undefined, 'UNAUTHORIZED');
        }
        if ((0, permissions_1.hasPermission)(req.admin.permissions, resource, action, req.admin.isSuperAdmin)) {
            return next();
        }
        return (0, response_1.fail)(res, 'ليس لديك صلاحية لتنفيذ هذا الإجراء', 403, undefined, 'FORBIDDEN');
    };
}
