ALTER TABLE "orders" ADD COLUMN "payment_method" text DEFAULT 'razorpay' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_ref" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "recorded_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_recorded_by_users_tenant_id_id_fk" FOREIGN KEY ("tenant_id","recorded_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE SET NULL ("recorded_by") /* hand-edited: plain SET NULL would null tenant_id too */ ON UPDATE no action;