CREATE TABLE "invoice_counters" (
	"tenant_id" uuid NOT NULL,
	"fy" text NOT NULL,
	"last" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invoice_counters_tenant_id_fy_pk" PRIMARY KEY("tenant_id","fy")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "razorpay_payment_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "commission_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "taxable_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gst_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "commission_bps" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "razorpay_account_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "gstin" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_user_id_users_tenant_id_id_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE SET NULL ("user_id") /* hand-edited: plain SET NULL would null tenant_id too */ ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id");--> statement-breakpoint
-- Hand-added: tenant isolation and grants for the new tenant table (see 0001_rls.sql).
GRANT SELECT, INSERT, UPDATE ON invoice_counters TO app_user;--> statement-breakpoint
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE invoice_counters FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON invoice_counters
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
