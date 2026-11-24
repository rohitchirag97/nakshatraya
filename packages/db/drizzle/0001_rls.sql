-- Row-level security. app.tenant_id is set per transaction by withTenant().
-- nullif(...,'') matters: after a transaction ends the setting reverts to '' (not NULL), and ''::uuid would error.
-- FORCE so even the table owner is filtered; only superusers / BYPASSRLS roles skip it.

GRANT SELECT, INSERT, UPDATE ON tenants TO app_user;--> statement-breakpoint
GRANT SELECT ON places, content TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON users, profiles, charts, reports, orders TO app_user;--> statement-breakpoint

-- tenants: anyone can resolve a tenant by slug and onboarding can insert, but a tenant can only update itself.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenants_read ON tenants FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY tenants_insert ON tenants FOR INSERT WITH CHECK (true);--> statement-breakpoint
CREATE POLICY tenants_update_self ON tenants FOR UPDATE
  USING (id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE users FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON profiles
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE charts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE charts FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON charts
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE reports FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON reports
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE orders FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
