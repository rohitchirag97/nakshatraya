CREATE TABLE "platform_admins" (
	"phone" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Hand-added: read-only for the app role; admins are added with the owner role by the script.
GRANT SELECT ON platform_admins TO app_user;
