-- Migration: RBAC Tables (Roles, Permissions, Relations)
-- Description: Create tables for Role-Based Access Control system
-- Dependencies: 001_extensions.sql, 002_users_table.sql

-- =====================================================
-- Table: roles
-- Purpose: Store user roles (admin, manager, user)
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for role name lookups
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- Comment
COMMENT ON TABLE roles IS 'User roles for RBAC system';
COMMENT ON COLUMN roles.is_system_role IS 'System roles (admin, manager, user) cannot be deleted';

-- =====================================================
-- Table: permissions
-- Purpose: Store granular permissions (resource:action)
-- =====================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  is_system_permission BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for permission lookups
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);

-- Comment
COMMENT ON TABLE permissions IS 'Granular permissions for RBAC system';
COMMENT ON COLUMN permissions.name IS 'Permission name in format resource:action (e.g., knowledge:read)';
COMMENT ON COLUMN permissions.resource IS 'Resource type (e.g., knowledge, chat, users)';
COMMENT ON COLUMN permissions.action IS 'Action type (e.g., read, create, update, delete)';

-- =====================================================
-- Table: user_roles (Junction Table)
-- Purpose: Many-to-Many relationship between users and roles
-- =====================================================
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL,
  role_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- Comment
COMMENT ON TABLE user_roles IS 'Junction table for user-role many-to-many relationship';

-- =====================================================
-- Table: role_permissions (Junction Table)
-- Purpose: Many-to-Many relationship between roles and permissions
-- =====================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL,
  permission_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Comment
COMMENT ON TABLE role_permissions IS 'Junction table for role-permission many-to-many relationship';

-- =====================================================
-- Insert System Roles
-- =====================================================
INSERT INTO roles (name, description, is_system_role) VALUES
  ('admin', 'Full system access and management capabilities', true),
  ('manager', 'Knowledge management and user oversight', true),
  ('user', 'Basic user access with read permissions', true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- Insert System Permissions
-- =====================================================
-- Chat permissions
INSERT INTO permissions (name, description, resource, action, is_system_permission) VALUES
  ('chat:read', 'Interact with AI assistant', 'chat', 'read', true)
ON CONFLICT (name) DO NOTHING;

-- Knowledge permissions
INSERT INTO permissions (name, description, resource, action, is_system_permission) VALUES
  ('knowledge:read', 'View knowledge documents', 'knowledge', 'read', true),
  ('knowledge:create', 'Upload and create knowledge documents', 'knowledge', 'create', true),
  ('knowledge:update', 'Edit knowledge documents', 'knowledge', 'update', true),
  ('knowledge:delete', 'Delete knowledge documents', 'knowledge', 'delete', true)
ON CONFLICT (name) DO NOTHING;

-- Profile permissions
INSERT INTO permissions (name, description, resource, action, is_system_permission) VALUES
  ('profile:read', 'View own profile', 'profile', 'read', true),
  ('profile:update', 'Update own profile', 'profile', 'update', true)
ON CONFLICT (name) DO NOTHING;

-- User management permissions
INSERT INTO permissions (name, description, resource, action, is_system_permission) VALUES
  ('users:read', 'View user information', 'users', 'read', true),
  ('users:manage', 'Manage users (create, update, delete)', 'users', 'manage', true)
ON CONFLICT (name) DO NOTHING;

-- System administration permissions
INSERT INTO permissions (name, description, resource, action, is_system_permission) VALUES
  ('system:admin', 'Full system administration access', 'system', 'admin', true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- Assign Permissions to Roles
-- =====================================================
-- USER ROLE: Basic access (chat:read, knowledge:read, profile:update)
-- NO knowledge:create for regular users
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN (
  'chat:read',
  'knowledge:read',
  'profile:read',
  'profile:update'
)
ON CONFLICT DO NOTHING;

-- MANAGER ROLE: Knowledge management + all user permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'manager' AND p.name IN (
  'chat:read',
  'knowledge:read',
  'knowledge:create',
  'knowledge:update',
  'knowledge:delete',
  'profile:read',
  'profile:update',
  'users:read'
)
ON CONFLICT DO NOTHING;

-- ADMIN ROLE: Full system access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
