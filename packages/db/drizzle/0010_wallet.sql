CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"kind" text NOT NULL,
	"report_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_transactions_report_id_kind_unique" UNIQUE("report_id","kind")
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "wallet_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "report_fee_paise" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_tenant_id_report_id_reports_tenant_id_id_fk" FOREIGN KEY ("tenant_id","report_id") REFERENCES "public"."reports"("tenant_id","id") ON DELETE SET NULL ("report_id") ON UPDATE no action;--> statement-breakpoint
-- Hand-added: tenant isolation and grants (see 0001_rls.sql). No UPDATE/DELETE: the ledger is append-only.
GRANT SELECT, INSERT ON wallet_transactions TO app_user;--> statement-breakpoint
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE wallet_transactions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON wallet_transactions
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
