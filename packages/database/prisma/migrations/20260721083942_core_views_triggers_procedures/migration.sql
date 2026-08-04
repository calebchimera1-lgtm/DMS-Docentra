-- Supplementary database objects layered on top of the Prisma-managed
-- schema: a trigger that enforces updated_at at the database layer
-- (defense in depth beyond the ORM's @updatedAt), reporting views for
-- the dashboard/BI modules, and a stored procedure for cascading
-- soft-deletes, which Prisma's declarative FK cascade cannot express
-- (it only cascades hard deletes).

-- ---------------------------------------------------------------------------
-- Trigger: keep updated_at current on every UPDATE, regardless of caller
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_set_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_branches_set_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_roles_set_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_settings_set_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_comments_set_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Views: read models for the Dashboard / BI modules
-- ---------------------------------------------------------------------------

-- One row per active (non-deleted) user, with their company, branch
-- assignments, and role names flattened for simple listing/search.
CREATE VIEW active_users AS
SELECT
  u.id,
  u.company_id,
  u.email,
  u.first_name,
  u.last_name,
  u.status,
  u.last_login_at,
  c.name AS company_name,
  COALESCE(
    array_agg(DISTINCT b.name) FILTER (WHERE b.id IS NOT NULL),
    ARRAY[]::text[]
  ) AS branch_names,
  COALESCE(
    array_agg(DISTINCT r.name) FILTER (WHERE r.id IS NOT NULL),
    ARRAY[]::text[]
  ) AS role_names
FROM users u
JOIN companies c ON c.id = u.company_id
LEFT JOIN user_branches ub ON ub.user_id = u.id
LEFT JOIN branches b ON b.id = ub.branch_id
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, c.name;

-- Per-company headline counts for the executive dashboard.
CREATE VIEW company_dashboard_stats AS
SELECT
  c.id AS company_id,
  c.name AS company_name,
  count(DISTINCT b.id) FILTER (WHERE b.deleted_at IS NULL) AS branch_count,
  count(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL AND u.status = 'ACTIVE') AS active_user_count,
  count(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL) AS total_user_count,
  count(DISTINCT n.id) FILTER (WHERE n.read_at IS NULL) AS unread_notification_count
FROM companies c
LEFT JOIN branches b ON b.company_id = c.id
LEFT JOIN users u ON u.company_id = c.id
LEFT JOIN notifications n ON n.company_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id;

-- ---------------------------------------------------------------------------
-- Stored procedure: cascading soft-delete for a company and its tenant
-- data (offboarding a customer without losing history/audit trail).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE soft_delete_company(target_company_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE branches SET deleted_at = now()
    WHERE company_id = target_company_id AND deleted_at IS NULL;

  UPDATE users SET deleted_at = now(), status = 'INACTIVE'
    WHERE company_id = target_company_id AND deleted_at IS NULL;

  UPDATE comments SET deleted_at = now()
    WHERE company_id = target_company_id AND deleted_at IS NULL;

  UPDATE attachments SET deleted_at = now()
    WHERE company_id = target_company_id AND deleted_at IS NULL;

  UPDATE companies SET deleted_at = now(), status = 'CANCELLED'
    WHERE id = target_company_id AND deleted_at IS NULL;
END;
$$;