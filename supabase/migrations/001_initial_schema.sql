-- Orbit Platform Initial Schema
-- Campaign-agnostic donor recognition system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Campaigns table
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL, -- e.g., 'toras-zev'
  name TEXT NOT NULL,
  organization TEXT NOT NULL,

  -- Destination
  destination_name TEXT NOT NULL,
  destination_address TEXT,
  destination_latitude DOUBLE PRECISION NOT NULL,
  destination_longitude DOUBLE PRECISION NOT NULL,

  -- Branding
  title TEXT NOT NULL,
  hebrew_title TEXT,
  tagline TEXT,
  hebrew_tagline TEXT,
  primary_color TEXT DEFAULT '#D4AF37',
  secondary_color TEXT DEFAULT '#1a1a2e',
  logo_url TEXT,

  -- Settings
  show_donation_amounts BOOLEAN DEFAULT FALSE,
  enable_satellites BOOLEAN DEFAULT TRUE,
  enable_driving_route BOOLEAN DEFAULT TRUE,
  donation_url TEXT,
  currency TEXT DEFAULT '$',
  campaign_goal NUMERIC(12, 2),

  -- Copy
  journey_message TEXT,
  hebrew_journey_message TEXT,
  arrival_message TEXT,
  hebrew_arrival_message TEXT,
  donor_reveal_message TEXT,
  hebrew_donor_reveal_message TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Donors table
CREATE TABLE donors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Display info
  public_display_name TEXT NOT NULL, -- Shown publicly
  private_donor_name TEXT, -- Actual donor name (hidden)

  -- Donation details
  donation_amount NUMERIC(12, 2),
  donation_date DATE DEFAULT CURRENT_DATE,
  currency TEXT DEFAULT '$',

  -- Visibility
  is_anonymous BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT TRUE, -- Whether to show on donor wall
  is_hidden BOOLEAN DEFAULT FALSE, -- Admin can hide without deleting

  -- Dedication
  dedication TEXT,
  hebrew_dedication TEXT,

  -- Star placement (relative to destination)
  star_offset_lat DOUBLE PRECISION, -- Offset from destination
  star_offset_lon DOUBLE PRECISION,
  star_tier INTEGER DEFAULT 1, -- Visual tier (1-5)

  -- Private viewing
  private_token TEXT UNIQUE, -- Cryptographically random token
  token_created_at TIMESTAMPTZ,
  token_revoked_at TIMESTAMPTZ,

  -- Demo data flag
  is_demo BOOLEAN DEFAULT FALSE,

  -- Metadata
  notes TEXT, -- Admin notes
  external_id TEXT, -- For future integrations
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin users (linked to Supabase Auth)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'admin', -- 'admin', 'viewer'
  campaigns UUID[], -- Specific campaigns they can access (NULL = all)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for sensitive operations
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL, -- 'donor_created', 'token_generated', 'token_revoked', etc.
  entity_type TEXT NOT NULL, -- 'donor', 'campaign', etc.
  entity_id UUID NOT NULL,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_donors_campaign ON donors(campaign_id);
CREATE INDEX idx_donors_token ON donors(private_token) WHERE private_token IS NOT NULL;
CREATE INDEX idx_donors_public ON donors(campaign_id, is_public, is_hidden) WHERE is_public = TRUE AND is_hidden = FALSE;
CREATE INDEX idx_campaigns_slug ON campaigns(slug);
CREATE INDEX idx_audit_log_admin ON audit_log(admin_user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_donors_updated_at
  BEFORE UPDATE ON donors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security Policies

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Public can read active campaigns
CREATE POLICY campaigns_public_read ON campaigns
  FOR SELECT
  USING (is_active = TRUE);

-- Admins can do everything with campaigns
CREATE POLICY campaigns_admin_all ON campaigns
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND (admin_users.campaigns IS NULL OR campaigns.id = ANY(admin_users.campaigns))
    )
  );

-- Public donor view: only public, non-hidden donors
-- IMPORTANT: Never expose private_donor_name or donation_amount for anonymous donors
CREATE POLICY donors_public_read ON donors
  FOR SELECT
  USING (
    is_public = TRUE
    AND is_hidden = FALSE
    -- Additional security: for anonymous donors, only allow reading safe columns
    -- This is enforced at the API/view level, not here
  );

-- Private token access: allow reading own record via token
-- This is handled via a secure function, not direct table access

-- Admins can do everything with donors in their campaigns
CREATE POLICY donors_admin_all ON donors
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND (admin_users.campaigns IS NULL OR donors.campaign_id = ANY(admin_users.campaigns))
    )
  );

-- Admin users can only see themselves unless they're super admins
CREATE POLICY admin_users_self ON admin_users
  FOR SELECT
  USING (id = auth.uid());

-- Audit log: admins can read logs for their campaigns
CREATE POLICY audit_log_admin_read ON audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Audit log: system can insert (via functions)
CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT
  WITH CHECK (TRUE);

-- Secure function to get donor by private token
-- Returns full donor info including private details
CREATE OR REPLACE FUNCTION get_donor_by_token(token TEXT)
RETURNS TABLE (
  id UUID,
  campaign_id UUID,
  public_display_name TEXT,
  private_donor_name TEXT,
  donation_amount NUMERIC,
  donation_date DATE,
  currency TEXT,
  is_anonymous BOOLEAN,
  dedication TEXT,
  hebrew_dedication TEXT,
  star_offset_lat DOUBLE PRECISION,
  star_offset_lon DOUBLE PRECISION,
  star_tier INTEGER
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.campaign_id,
    d.public_display_name,
    d.private_donor_name,
    d.donation_amount,
    d.donation_date,
    d.currency,
    d.is_anonymous,
    d.dedication,
    d.hebrew_dedication,
    d.star_offset_lat,
    d.star_offset_lon,
    d.star_tier
  FROM donors d
  WHERE d.private_token = token
    AND d.token_revoked_at IS NULL
    AND d.is_hidden = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Secure function to generate a new private token
CREATE OR REPLACE FUNCTION generate_donor_token(donor_id UUID)
RETURNS TEXT
SECURITY DEFINER
AS $$
DECLARE
  new_token TEXT;
  admin_id UUID;
BEGIN
  -- Verify caller is an admin
  admin_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE id = admin_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Generate cryptographically secure token
  new_token := encode(gen_random_bytes(32), 'base64');
  -- Make URL-safe
  new_token := replace(replace(new_token, '+', '-'), '/', '_');

  -- Update donor with new token
  UPDATE donors
  SET
    private_token = new_token,
    token_created_at = NOW(),
    token_revoked_at = NULL
  WHERE id = donor_id;

  -- Audit log
  INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id, details)
  VALUES (admin_id, 'token_generated', 'donor', donor_id, '{}');

  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Secure function to revoke a private token
CREATE OR REPLACE FUNCTION revoke_donor_token(donor_id UUID)
RETURNS VOID
SECURITY DEFINER
AS $$
DECLARE
  admin_id UUID;
BEGIN
  -- Verify caller is an admin
  admin_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE id = admin_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Revoke token
  UPDATE donors
  SET token_revoked_at = NOW()
  WHERE id = donor_id;

  -- Audit log
  INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id, details)
  VALUES (admin_id, 'token_revoked', 'donor', donor_id, '{}');
END;
$$ LANGUAGE plpgsql;

-- View for public donor wall (safe to expose)
CREATE OR REPLACE VIEW public_donors AS
SELECT
  d.id,
  d.campaign_id,
  CASE
    WHEN d.is_anonymous THEN 'Anonymous Supporter'
    ELSE d.public_display_name
  END as display_name,
  d.donation_date,
  d.star_offset_lat,
  d.star_offset_lon,
  d.star_tier,
  d.is_anonymous,
  d.is_demo,
  c.show_donation_amounts,
  CASE
    WHEN c.show_donation_amounts AND NOT d.is_anonymous THEN d.donation_amount
    ELSE NULL
  END as donation_amount,
  CASE
    WHEN c.show_donation_amounts AND NOT d.is_anonymous THEN d.currency
    ELSE NULL
  END as currency
FROM donors d
JOIN campaigns c ON c.id = d.campaign_id
WHERE d.is_public = TRUE
  AND d.is_hidden = FALSE
  AND c.is_active = TRUE;

-- Grant access to the view
GRANT SELECT ON public_donors TO anon, authenticated;

-- Insert initial Toras Zev campaign
INSERT INTO campaigns (
  slug,
  name,
  organization,
  destination_name,
  destination_address,
  destination_latitude,
  destination_longitude,
  title,
  hebrew_title,
  tagline,
  hebrew_tagline,
  journey_message,
  hebrew_journey_message,
  arrival_message,
  hebrew_arrival_message,
  donor_reveal_message,
  hebrew_donor_reveal_message
) VALUES (
  'toras-zev',
  'Kochvei Toras Zev',
  'Cheder Toras Zev',
  'Cheder Toras Zev',
  '1000 Cross St, Lakewood, NJ 08701',
  40.0795,
  -74.2179,
  'Kochvei Toras Zev',
  'כוכבי תורת זאב',
  'Your chelek in Torah',
  'חלקך בתורה',
  'Your journey to Toras Zev begins here.',
  'המסע שלך לתורת זאב מתחיל כאן.',
  'Welcome to Cheder Toras Zev',
  'ברוכים הבאים לחדר תורת זאב',
  'Your chelek in the Torah of Toras Zev.',
  'חלקך בתורה של תורת זאב.'
);
