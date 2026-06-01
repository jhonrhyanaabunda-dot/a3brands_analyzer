-- Adds the interactive-intro capture fields (Stage 2) to the leads table.
--
-- REQUIRED before deploying the funnel redesign: POST /api/leads now inserts
-- `goal` and `rival`, and an insert against a table missing these columns will
-- fail (regressing every lead write). Run this once in the Supabase SQL editor
-- (or via the CLI) against the same project SUPABASE_URL points at.
--
-- Safe to re-run: IF NOT EXISTS guards make it idempotent.

alter table public.leads add column if not exists goal  text;
alter table public.leads add column if not exists rival text;
