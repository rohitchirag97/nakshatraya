ALTER TABLE "tenants" ALTER COLUMN "kundli_price_paise" SET DEFAULT 9900;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "kind" text DEFAULT 'pdf' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ship_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ship_phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ship_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ship_city" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ship_state" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ship_pincode" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_no" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "print_price_paise" integer DEFAULT 50000 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_kind_check" CHECK ("kind" IN ('pdf', 'print'));
