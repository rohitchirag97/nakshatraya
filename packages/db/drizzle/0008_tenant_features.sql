ALTER TABLE "tenant_applications" ADD COLUMN "wants_shop" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_applications" ADD COLUMN "wants_consult" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_applications" ADD COLUMN "pdf_price_paise" integer DEFAULT 9900 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_applications" ADD COLUMN "print_price_paise" integer DEFAULT 50000 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "shop_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "consult_enabled" boolean DEFAULT false NOT NULL;