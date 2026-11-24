CREATE TYPE "public"."chart_style" AS ENUM('north', 'south');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('created', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('locked', 'ready');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'astrologer', 'customer');--> statement-breakpoint
CREATE TABLE "charts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"engine_version" text NOT NULL,
	"result_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charts_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "content" (
	"key" text NOT NULL,
	"lang" text NOT NULL,
	"text" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "content_key_lang_pk" PRIMARY KEY("key","lang")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"razorpay_order_id" text,
	"razorpay_event_id" text,
	"status" "order_status" DEFAULT 'created' NOT NULL,
	"invoice_no" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_razorpay_order_id_unique" UNIQUE("razorpay_order_id"),
	CONSTRAINT "orders_razorpay_event_id_unique" UNIQUE("razorpay_event_id"),
	CONSTRAINT "orders_tenant_id_invoice_no_unique" UNIQUE("tenant_id","invoice_no")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"alt_names" text[] DEFAULT '{}' NOT NULL,
	"admin1" text,
	"country" text NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"tz" text NOT NULL,
	"population" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"gender" text NOT NULL,
	"birth_local" timestamp NOT NULL,
	"birth_utc" timestamp with time zone NOT NULL,
	"time_known" boolean NOT NULL,
	"place_id" integer,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"tz" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"chart_id" uuid NOT NULL,
	"type" text DEFAULT 'kundli' NOT NULL,
	"lang" text NOT NULL,
	"status" "report_status" DEFAULT 'locked' NOT NULL,
	"pdf_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"domain" text,
	"name" text NOT NULL,
	"logo_url" text,
	"brand_color" text DEFAULT '#7c2d12' NOT NULL,
	"default_lang" text DEFAULT 'en' NOT NULL,
	"enabled_langs" text[] DEFAULT '{"en"}' NOT NULL,
	"chart_style" chart_style DEFAULT 'north' NOT NULL,
	"ayanamsa" text DEFAULT 'lahiri' NOT NULL,
	"plan" text DEFAULT 'pilot' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"password_hash" text,
	"role" "role" DEFAULT 'customer' NOT NULL,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "users_tenant_id_phone_unique" UNIQUE("tenant_id","phone")
);
--> statement-breakpoint
ALTER TABLE "charts" ADD CONSTRAINT "charts_tenant_id_profile_id_profiles_tenant_id_id_fk" FOREIGN KEY ("tenant_id","profile_id") REFERENCES "public"."profiles"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_report_id_reports_tenant_id_id_fk" FOREIGN KEY ("tenant_id","report_id") REFERENCES "public"."reports"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_tenant_id_user_id_users_tenant_id_id_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_tenant_id_chart_id_charts_tenant_id_id_fk" FOREIGN KEY ("tenant_id","chart_id") REFERENCES "public"."charts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;