-- Run this in your Supabase Dashboard > SQL Editor
-- Go to: https://supabase.com/dashboard/project/tjymkybomhevysmwdwyk/sql/new

CREATE TABLE IF NOT EXISTS licenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  domain TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'monthly' CHECK (plan IN ('hourly','daily','monthly','yearly','lifetime')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','expired')),
  customer_name TEXT DEFAULT '',
  customer_email TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS (panel is already auth-protected with admin password)
ALTER TABLE licenses DISABLE ROW LEVEL SECURITY;

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
