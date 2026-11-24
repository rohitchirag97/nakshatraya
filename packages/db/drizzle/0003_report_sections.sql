-- Default only so the migration can't fail on existing rows; new reports always set it.
ALTER TABLE "reports" ADD COLUMN "sections" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "sections" DROP DEFAULT;
