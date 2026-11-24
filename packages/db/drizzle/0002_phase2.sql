ALTER TABLE "charts" DROP CONSTRAINT "charts_tenant_id_profile_id_profiles_tenant_id_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_tenant_id_report_id_reports_tenant_id_id_fk";
--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_tenant_id_user_id_users_tenant_id_id_fk";
--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "reports_tenant_id_chart_id_charts_tenant_id_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "report_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "footer_text" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "kundli_price_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "charts" ADD CONSTRAINT "charts_tenant_id_profile_id_profiles_tenant_id_id_fk" FOREIGN KEY ("tenant_id","profile_id") REFERENCES "public"."profiles"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_report_id_reports_tenant_id_id_fk" FOREIGN KEY ("tenant_id","report_id") REFERENCES "public"."reports"("tenant_id","id") ON DELETE SET NULL ("report_id") /* hand-edited: plain SET NULL would null tenant_id too */ ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_tenant_id_user_id_users_tenant_id_id_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_tenant_id_chart_id_charts_tenant_id_id_fk" FOREIGN KEY ("tenant_id","chart_id") REFERENCES "public"."charts"("tenant_id","id") ON DELETE cascade ON UPDATE no action;