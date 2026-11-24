CREATE TABLE "platform_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"report_fee_paise" integer DEFAULT 1000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_topups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"razorpay_order_id" text NOT NULL,
	"razorpay_payment_id" text,
	"status" text DEFAULT 'created' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_topups_razorpay_order_id_unique" UNIQUE("razorpay_order_id"),
	CONSTRAINT "wallet_topups_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id")
);
--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "report_fee_paise" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "report_fee_paise" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Hand-added. One settings row; existing tenants follow the platform fee (they all had the old default).
ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_single_row CHECK (id);--> statement-breakpoint
INSERT INTO platform_settings (id) VALUES (true);--> statement-breakpoint
UPDATE tenants SET report_fee_paise = NULL;--> statement-breakpoint
GRANT SELECT, UPDATE ON platform_settings TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON wallet_topups TO app_user;--> statement-breakpoint
ALTER TABLE wallet_topups ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE wallet_topups FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON wallet_topups
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
