-- =============================================================================
-- Student Rental Brokerage Platform — PostgreSQL schema (v0.1 draft)
--
-- Framework-neutral reference DDL. The Laravel (or NestJS) migrations should
-- reproduce these tables, constraints and indexes exactly; this file is the
-- source of truth until migrations exist.
--
-- Conventions
--   * UUID primary keys (gen_random_uuid, built in since PG 13).
--   * Status/enum columns are TEXT + CHECK (easier to evolve than PG ENUMs).
--   * Money is NUMERIC(12,2) in INR.
--   * All timestamps are TIMESTAMPTZ, stored in UTC.
--   * PRIVATE tables (owners, property_private_details) must never be read by
--     any code path that serves a student. See docs/data-model.md §3.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Users, roles, authentication
-- -----------------------------------------------------------------------------

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role            TEXT NOT NULL CHECK (role IN ('super_admin', 'broker', 'student', 'owner')),
    name            TEXT NOT NULL,
    phone           TEXT NOT NULL UNIQUE,            -- E.164, e.g. +919876543210
    email           TEXT,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'deactivated')),
    receives_ops_alerts BOOLEAN NOT NULL DEFAULT FALSE, -- "operations team" recipients
    -- Permissions beyond the role (Super Admin always has them):
    can_verify_properties  BOOLEAN NOT NULL DEFAULT FALSE, -- "authorized verifier" (D-06)
    can_override_brokerage BOOLEAN NOT NULL DEFAULT FALSE, -- property/assignment brokerage overrides (D-04)
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE otp_challenges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           TEXT NOT NULL,
    code_hash       TEXT NOT NULL,                   -- never store the plain OTP
    attempts        SMALLINT NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed_at     TIMESTAMPTZ,
    request_ip      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX otp_challenges_phone_idx ON otp_challenges (phone, created_at DESC);

-- Revocable sessions. If Laravel Sanctum is used, personal_access_tokens replaces this.
CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL UNIQUE,
    user_agent      TEXT,
    ip              INET,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_sessions_user_idx ON user_sessions (user_id);

-- -----------------------------------------------------------------------------
-- 2. Lookups (configured by Super Admin)
-- -----------------------------------------------------------------------------

CREATE TABLE areas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    city            TEXT NOT NULL,
    parent_area_id  UUID REFERENCES areas(id),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (city, name)
);

CREATE TABLE colleges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    short_name      TEXT,
    area_id         UUID REFERENCES areas(id),
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (name)
);

CREATE TABLE amenities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    category        TEXT,                            -- e.g. 'room', 'building', 'food', 'safety'
    icon            TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Generic key/value settings (response window, contact policy, etc.).
-- See docs/broker-allocation.md §7 for the allocation keys.
CREATE TABLE system_settings (
    key             TEXT PRIMARY KEY,
    value           JSONB NOT NULL,
    description     TEXT,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. Actor profiles
-- -----------------------------------------------------------------------------

CREATE TABLE students (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    college_id      UUID REFERENCES colleges(id),
    course          TEXT,
    year_of_study   SMALLINT CHECK (year_of_study BETWEEN 1 AND 10),
    gender          TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    budget_min      NUMERIC(12,2),
    budget_max      NUMERIC(12,2),
    preferred_area_ids UUID[] NOT NULL DEFAULT '{}',
    preferred_sharing  SMALLINT[] NOT NULL DEFAULT '{}',  -- e.g. {1,2}
    move_in_from    DATE,
    preferences     JSONB NOT NULL DEFAULT '{}',     -- food, gender policy, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE brokers (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name    TEXT NOT NULL,                   -- what a student may see (per contact policy)
    business_name   TEXT,
    business_phone  TEXT,                            -- public-facing number, never the owner's
    -- Allocation controls (docs/broker-allocation.md §3)
    accepting_leads BOOLEAN NOT NULL DEFAULT TRUE,   -- broker's own "available for new leads" toggle
    max_active_leads INTEGER NOT NULL DEFAULT 40 CHECK (max_active_leads >= 0),
    last_assigned_at TIMESTAMPTZ,                    -- round-robin tie-breaker
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leave / "marked unavailable" windows. Created by the broker or by Super Admin.
CREATE TABLE broker_unavailability (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broker_id       UUID NOT NULL REFERENCES brokers(user_id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK (kind IN ('leave', 'unavailable')),
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    reason          TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);
CREATE INDEX broker_unavailability_window_idx
    ON broker_unavailability (broker_id, starts_at, ends_at) WHERE cancelled_at IS NULL;

-- Which brokers may receive leads for an area / a specific property.
CREATE TABLE broker_area_authorizations (
    broker_id       UUID NOT NULL REFERENCES brokers(user_id) ON DELETE CASCADE,
    area_id         UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (broker_id, area_id)
);
CREATE INDEX broker_area_authorizations_area_idx ON broker_area_authorizations (area_id);

-- PRIVATE. Never joined into a student-facing query.
CREATE TABLE owners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE REFERENCES users(id), -- set only when the future Owner portal is enabled
    name            TEXT NOT NULL,
    phone           TEXT NOT NULL,
    alternate_phone TEXT,
    email           TEXT,
    address         TEXT,
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX owners_phone_idx ON owners (phone);

-- -----------------------------------------------------------------------------
-- 4. Properties, rooms, beds
-- -----------------------------------------------------------------------------

-- PUBLIC-SAFE columns only. Anything that identifies the exact house or the
-- owner lives in property_private_details.
CREATE TABLE properties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,            -- human/share code, e.g. 'PR-1042'
    broker_id       UUID REFERENCES brokers(user_id),-- the property's assigned broker
    title           TEXT NOT NULL,
    description     TEXT,
    property_type   TEXT NOT NULL CHECK (property_type IN ('pg', 'hostel', 'flat', 'independent_room', 'shared_house')),
    gender_policy   TEXT NOT NULL DEFAULT 'any' CHECK (gender_policy IN ('male', 'female', 'any')),
    area_id         UUID NOT NULL REFERENCES areas(id),
    locality_label  TEXT,                            -- e.g. "Near City Mall" — must not identify the house
    -- Approximate location: computed ONCE when the exact location is saved
    -- (deterministic offset/grid snap), never re-randomised per request.
    approx_latitude  NUMERIC(9,6),
    approx_longitude NUMERIC(9,6),
    -- "Starting from" prices, maintained from rooms for fast listing filters.
    min_rent        NUMERIC(12,2),
    max_rent        NUMERIC(12,2),
    min_deposit     NUMERIC(12,2),
    maintenance_fee NUMERIC(12,2),
    food_included   BOOLEAN NOT NULL DEFAULT FALSE,
    house_rules     TEXT,
    available_from  DATE,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                        'draft', 'verification', 'published', 'partially_occupied',
                        'fully_occupied', 'unavailable', 'archived')),
    verified_by     UUID REFERENCES users(id),
    verified_at     TIMESTAMPTZ,
    published_at    TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX properties_listing_idx ON properties (status, area_id, min_rent);
CREATE INDEX properties_broker_idx ON properties (broker_id);

-- PRIVATE: exact address, exact pin and owner link. Broker/Super Admin only.
CREATE TABLE property_private_details (
    property_id     UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
    owner_id        UUID NOT NULL REFERENCES owners(id),
    address_line1   TEXT NOT NULL,
    address_line2   TEXT,
    landmark        TEXT,
    pincode         TEXT,
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),
    owner_commercial_notes TEXT,                     -- negotiated terms, commission with owner, etc.
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX property_private_details_owner_idx ON property_private_details (owner_id);

-- Property-specific broker authorization (in addition to area authorization).
CREATE TABLE broker_property_authorizations (
    broker_id       UUID NOT NULL REFERENCES brokers(user_id) ON DELETE CASCADE,
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (broker_id, property_id)
);
CREATE INDEX broker_property_authorizations_property_idx ON broker_property_authorizations (property_id);

CREATE TABLE property_amenities (
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    amenity_id      UUID NOT NULL REFERENCES amenities(id),
    PRIMARY KEY (property_id, amenity_id)
);

-- Distance to colleges, computed from the EXACT location but only the rounded
-- distance is ever exposed.
CREATE TABLE property_college_distances (
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    college_id      UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    distance_km     NUMERIC(5,1) NOT NULL,
    PRIMARY KEY (property_id, college_id)
);
CREATE INDEX property_college_distances_college_idx ON property_college_distances (college_id, distance_km);

CREATE TABLE property_photos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_id         UUID,                            -- optional, FK added after rooms
    storage_key     TEXT NOT NULL,                   -- object storage key; URLs are signed on read
    caption         TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_public       BOOLEAN NOT NULL DEFAULT FALSE,  -- only public photos reach students
    privacy_checked BOOLEAN NOT NULL DEFAULT FALSE,  -- verified: no house number / signboard / owner visible
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (NOT is_public OR privacy_checked)
);
CREATE INDEX property_photos_property_idx ON property_photos (property_id, sort_order);

-- Room-level status only covers maintenance/blocking. Availability is derived
-- from beds (docs/data-model.md §4).
CREATE TABLE rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    label           TEXT NOT NULL,                   -- e.g. "Room 2 (First floor)"
    sharing         SMALLINT NOT NULL CHECK (sharing BETWEEN 1 AND 12), -- beds in the room
    room_type       TEXT CHECK (room_type IN ('ac', 'non_ac')),
    attached_bathroom BOOLEAN NOT NULL DEFAULT FALSE,
    -- Current prices per bed. Authoritative history is rent_history.
    rent_per_bed    NUMERIC(12,2) NOT NULL CHECK (rent_per_bed >= 0),
    deposit_per_bed NUMERIC(12,2) NOT NULL CHECK (deposit_per_bed >= 0),
    maintenance_per_bed NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'blocked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (property_id, label)
);
CREATE INDEX rooms_property_idx ON rooms (property_id);

ALTER TABLE property_photos
    ADD CONSTRAINT property_photos_room_fk FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;

CREATE TABLE beds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    label           TEXT NOT NULL,                   -- e.g. "Bed A (window)"
    status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
                        'available', 'reserved', 'occupied', 'maintenance', 'blocked')),
    available_from  DATE,                            -- for beds freeing up at a known date
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (room_id, label)
);
CREATE INDEX beds_room_status_idx ON beds (room_id, status);

-- Price changes with effective dates. Existing assignments keep their snapshot.
CREATE TABLE rent_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    rent_per_bed    NUMERIC(12,2) NOT NULL,
    deposit_per_bed NUMERIC(12,2) NOT NULL,
    maintenance_per_bed NUMERIC(12,2) NOT NULL DEFAULT 0,
    effective_from  DATE NOT NULL,
    reason          TEXT,
    changed_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (room_id, effective_from)
);

-- -----------------------------------------------------------------------------
-- 5. Student engagement: shortlist, leads, follow-ups, visits
-- -----------------------------------------------------------------------------

CREATE TABLE shortlists (
    student_id      UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, property_id)
);

-- Lead state machine: docs/data-model.md §5.
-- allocation_status tracks who owns the lead (docs/broker-allocation.md §5):
--   unassigned -> offered (awaiting broker acceptance, has response_due_at)
--              -> accepted (broker is actively handling it)
CREATE TABLE leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,            -- e.g. 'LD-20481'
    student_id      UUID NOT NULL REFERENCES students(user_id),
    property_id     UUID REFERENCES properties(id),  -- NULL for general requirement leads
    broker_id       UUID REFERENCES brokers(user_id),
    source          TEXT NOT NULL CHECK (source IN (
                        'visit_request', 'interest', 'whatsapp_share', 'walk_in', 'phone', 'broker_created')),
    status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                        'new', 'contacted', 'requirement_confirmed', 'properties_suggested',
                        'visit_scheduled', 'visited', 'interested', 'negotiation', 'assigned',
                        'brokerage_pending', 'brokerage_paid', 'move_in_complete',
                        -- terminal (unsuccessful)
                        'not_interested', 'lost', 'student_cancelled', 'property_unavailable', 'duplicate')),
    is_active       BOOLEAN GENERATED ALWAYS AS (status NOT IN (
                        'move_in_complete', 'not_interested', 'lost', 'student_cancelled',
                        'property_unavailable', 'duplicate')) STORED,
    allocation_status TEXT NOT NULL DEFAULT 'unassigned'
                    CHECK (allocation_status IN ('unassigned', 'offered', 'accepted')),
    response_due_at TIMESTAMPTZ,                     -- set while allocation_status = 'offered'
    queued_at       TIMESTAMPTZ,                     -- set while in the Unassigned Queue
    requirements    JSONB NOT NULL DEFAULT '{}',     -- budget, sharing, move-in date captured on the lead
    lost_reason     TEXT,
    last_student_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((allocation_status = 'unassigned') = (broker_id IS NULL)),
    CHECK ((allocation_status = 'offered') = (response_due_at IS NOT NULL)),
    CHECK ((allocation_status = 'unassigned') = (queued_at IS NOT NULL))
);
-- Core anti-duplicate rule: one ACTIVE lead per student + property.
CREATE UNIQUE INDEX leads_one_active_per_student_property
    ON leads (student_id, property_id) WHERE is_active AND property_id IS NOT NULL;
CREATE INDEX leads_broker_active_idx ON leads (broker_id) WHERE is_active;
CREATE INDEX leads_unassigned_queue_idx ON leads (queued_at) WHERE allocation_status = 'unassigned' AND is_active;
CREATE INDEX leads_offer_timeout_idx ON leads (response_due_at) WHERE allocation_status = 'offered';

CREATE TABLE lead_status_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    from_status     TEXT,
    to_status       TEXT NOT NULL,
    changed_by      UUID REFERENCES users(id),       -- NULL = system
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lead_status_history_lead_idx ON lead_status_history (lead_id, created_at);

-- Every broker allocation / reassignment (docs/broker-allocation.md §8).
CREATE TABLE lead_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    previous_broker_id UUID REFERENCES brokers(user_id),
    new_broker_id   UUID REFERENCES brokers(user_id),-- NULL = moved to Unassigned Queue
    method          TEXT NOT NULL CHECK (method IN ('automatic', 'manual')),
    reason          TEXT NOT NULL CHECK (reason IN (
                        'property_broker',            -- tier 1
                        'authorized_fallback',        -- tier 2 (property or area authorized)
                        'queue_retry',                -- picked up from the Unassigned Queue
                        'no_eligible_broker',         -- moved to the Unassigned Queue
                        'broker_unavailable',         -- previous broker went unavailable before accepting
                        'response_timeout',           -- previous broker missed the response window
                        'broker_declined',
                        'broker_deactivated',         -- explicit rule: account deactivated
                        'manual_reassignment')),
    reason_note     TEXT,                            -- required for manual reassignment
    response_due_at TIMESTAMPTZ,
    assigned_by     UUID REFERENCES users(id),       -- NULL = system
    accepted_at     TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,                     -- when this assignment was superseded
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (method = 'automatic' OR (assigned_by IS NOT NULL AND reason_note IS NOT NULL))
);
CREATE INDEX lead_assignments_lead_idx ON lead_assignments (lead_id, created_at);
CREATE INDEX lead_assignments_broker_idx ON lead_assignments (new_broker_id, created_at);

-- Every open lead must always have at least one open follow-up (app invariant,
-- checked by a nightly report). Open follow-ups move with the lead on reassignment.
CREATE TABLE follow_ups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    broker_id       UUID REFERENCES brokers(user_id),
    action          TEXT NOT NULL,                   -- e.g. "Call student to confirm requirements"
    due_at          TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'snoozed', 'cancelled')),
    snooze_reason   TEXT,
    completed_at    TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id),       -- NULL = system
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status <> 'snoozed' OR snooze_reason IS NOT NULL)
);
CREATE INDEX follow_ups_due_idx ON follow_ups (broker_id, due_at) WHERE status IN ('open', 'snoozed');
CREATE INDEX follow_ups_lead_idx ON follow_ups (lead_id);

CREATE TABLE visits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    property_id     UUID NOT NULL REFERENCES properties(id),
    status          TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
                        'requested', 'proposed', 'confirmed', 'rescheduled',
                        'completed', 'cancelled', 'no_show')),
    preferred_slots JSONB NOT NULL DEFAULT '[]',     -- student's requested [{date, from, to}]
    scheduled_at    TIMESTAMPTZ,                     -- broker-proposed / confirmed time
    people_count    SMALLINT NOT NULL DEFAULT 1 CHECK (people_count BETWEEN 1 AND 10),
    student_note    TEXT,
    outcome         TEXT CHECK (outcome IN ('interested', 'not_interested', 'wants_more_options', 'negotiating')),
    outcome_note    TEXT,
    cancelled_by    UUID REFERENCES users(id),
    cancel_reason   TEXT,
    reminder_sent_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status NOT IN ('proposed', 'confirmed', 'rescheduled', 'completed', 'no_show') OR scheduled_at IS NOT NULL),
    CHECK (status <> 'completed' OR outcome IS NOT NULL)
);
CREATE INDEX visits_lead_idx ON visits (lead_id);
CREATE INDEX visits_schedule_idx ON visits (scheduled_at) WHERE status IN ('proposed', 'confirmed', 'rescheduled');

-- -----------------------------------------------------------------------------
-- 6. Assignments, brokerage, payments
-- -----------------------------------------------------------------------------

-- Bed-level assignment with an immutable commercial snapshot.
CREATE TABLE assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,            -- e.g. 'AS-3307'
    lead_id         UUID NOT NULL REFERENCES leads(id),
    student_id      UUID NOT NULL REFERENCES students(user_id),
    property_id     UUID NOT NULL REFERENCES properties(id),
    room_id         UUID NOT NULL REFERENCES rooms(id),
    bed_id          UUID NOT NULL REFERENCES beds(id),
    broker_id       UUID NOT NULL REFERENCES brokers(user_id),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                        'draft', 'pending_confirmation', 'reserved', 'confirmed', 'cancelled', 'completed')),
    -- Commercial snapshot, frozen at confirmation; never updated by rent changes.
    rent_snapshot        NUMERIC(12,2) NOT NULL,
    deposit_snapshot     NUMERIC(12,2) NOT NULL,
    maintenance_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0,
    agreed_terms    TEXT,
    move_in_date    DATE,
    moved_in_at     TIMESTAMPTZ,                     -- set when status -> completed (move-in done)
    vacated_at      TIMESTAMPTZ,                     -- tenancy ended; bed is free again
    owner_confirmed_at TIMESTAMPTZ,                  -- optional owner confirmation step
    reserved_until  TIMESTAMPTZ,                     -- hold expiry for 'reserved'
    cancel_reason   TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    confirmed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status <> 'completed' OR moved_in_at IS NOT NULL)
);
-- A bed can hold only one live assignment (hold, confirmed, or currently moved-in).
CREATE UNIQUE INDEX assignments_one_live_per_bed
    ON assignments (bed_id)
    WHERE status IN ('pending_confirmation', 'reserved', 'confirmed')
       OR (status = 'completed' AND vacated_at IS NULL);
CREATE INDEX assignments_lead_idx ON assignments (lead_id);
CREATE INDEX assignments_student_idx ON assignments (student_id);

-- Brokerage policy (decision D-04). One row decides, for a scope, WHO pays
-- (student, owner or both) and HOW EACH PARTY's amount is calculated,
-- independently. Rows are never edited in place: a change inserts a new row
-- and deactivates the old one, so history is preserved.
-- Calculation types:
--   flat                    value = amount in INR
--   percent_of_monthly_rent value = percentage (0–100) of the monthly rent snapshot
--   months_of_rent          value = number of months (>= 1) × monthly rent snapshot
CREATE TABLE brokerage_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    area_id         UUID REFERENCES areas(id),       -- NULL = any area
    property_type   TEXT,                            -- NULL = any type
    priority        INTEGER NOT NULL DEFAULT 0,      -- higher wins, then more specific scope
    payer_mode      TEXT NOT NULL CHECK (payer_mode IN ('student', 'owner', 'both')),
    student_calc_type TEXT CHECK (student_calc_type IN ('flat', 'percent_of_monthly_rent', 'months_of_rent')),
    student_value   NUMERIC(12,2),
    owner_calc_type TEXT CHECK (owner_calc_type IN ('flat', 'percent_of_monthly_rent', 'months_of_rent')),
    owner_value     NUMERIC(12,2),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at  TIMESTAMPTZ,
    deactivated_by  UUID REFERENCES users(id),
    -- the parties that pay have a calculation; the others have none
    CHECK ((payer_mode IN ('student', 'both')) = (student_calc_type IS NOT NULL AND student_value IS NOT NULL)),
    CHECK ((payer_mode IN ('student', 'both')) OR (student_calc_type IS NULL AND student_value IS NULL)),
    CHECK ((payer_mode IN ('owner', 'both')) = (owner_calc_type IS NOT NULL AND owner_value IS NOT NULL)),
    CHECK ((payer_mode IN ('owner', 'both')) OR (owner_calc_type IS NULL AND owner_value IS NULL)),
    CHECK (student_value IS NULL OR student_value >= 0),
    CHECK (owner_value IS NULL OR owner_value >= 0),
    CHECK (student_calc_type <> 'percent_of_monthly_rent' OR student_value <= 100),
    CHECK (owner_calc_type <> 'percent_of_monthly_rent' OR owner_value <= 100),
    CHECK (student_calc_type <> 'months_of_rent' OR student_value >= 1),
    CHECK (owner_calc_type <> 'months_of_rent' OR owner_value >= 1),
    CHECK (is_active OR deactivated_at IS NOT NULL)
);
CREATE INDEX brokerage_policies_active_idx ON brokerage_policies (priority DESC) WHERE is_active;

-- Property-level or assignment-level override for ONE party. A reason is
-- mandatory. Rows are never edited: they are revoked (with a reason) and
-- replaced, so the full history stays. calc_type 'not_charged' means this
-- party pays nothing at this level.
-- Who may create overrides: users.can_override_brokerage (+ Super Admin).
CREATE TABLE brokerage_overrides (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level           TEXT NOT NULL CHECK (level IN ('property', 'assignment')),
    property_id     UUID REFERENCES properties(id),
    assignment_id   UUID REFERENCES assignments(id),
    party           TEXT NOT NULL CHECK (party IN ('student', 'owner')),
    calc_type       TEXT NOT NULL CHECK (calc_type IN ('flat', 'percent_of_monthly_rent', 'months_of_rent', 'not_charged')),
    value           NUMERIC(12,2),
    reason          TEXT NOT NULL CHECK (length(trim(reason)) > 0),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ,
    revoked_by      UUID REFERENCES users(id),
    revoke_reason   TEXT,
    CHECK ((level = 'property') = (property_id IS NOT NULL AND assignment_id IS NULL)),
    CHECK ((level = 'assignment') = (assignment_id IS NOT NULL AND property_id IS NULL)),
    CHECK ((calc_type = 'not_charged') = (value IS NULL)),
    CHECK (value IS NULL OR value >= 0),
    CHECK (calc_type <> 'percent_of_monthly_rent' OR value <= 100),
    CHECK (calc_type <> 'months_of_rent' OR value >= 1),
    CHECK (revoked_at IS NULL OR (revoked_by IS NOT NULL AND revoke_reason IS NOT NULL))
);
CREATE UNIQUE INDEX brokerage_overrides_one_active_property
    ON brokerage_overrides (property_id, party) WHERE level = 'property' AND revoked_at IS NULL;
CREATE UNIQUE INDEX brokerage_overrides_one_active_assignment
    ON brokerage_overrides (assignment_id, party) WHERE level = 'assignment' AND revoked_at IS NULL;

-- Proof that each paying party was shown the brokerage amount BEFORE the
-- assignment is confirmed. Confirmation is refused unless every charged
-- party has a disclosure whose amount equals the current quote; any change
-- to the quote (e.g. a new override) therefore needs a fresh disclosure.
CREATE TABLE brokerage_disclosures (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    party           TEXT NOT NULL CHECK (party IN ('student', 'owner')),
    amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    calc_snapshot   JSONB NOT NULL,                  -- what the party was shown and how it was calculated
    method          TEXT NOT NULL CHECK (method IN ('in_app', 'whatsapp', 'phone', 'in_person', 'email')),
    disclosed_by    UUID REFERENCES users(id),       -- NULL = system (in-app)
    disclosed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ                      -- set if the party acknowledged (see open question BR-6)
);
CREATE INDEX brokerage_disclosures_assignment_idx ON brokerage_disclosures (assignment_id, party, disclosed_at DESC);

-- One brokerage record per charged party, created when the assignment is
-- confirmed, with the calculation frozen. Each party is tracked separately.
CREATE TABLE brokerages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES assignments(id),
    party           TEXT NOT NULL CHECK (party IN ('student', 'owner')),
    source          TEXT NOT NULL CHECK (source IN ('policy', 'property_override', 'assignment_override')),
    policy_id       UUID REFERENCES brokerage_policies(id),
    override_id     UUID REFERENCES brokerage_overrides(id),
    calc_snapshot   JSONB NOT NULL,                  -- calc_type, value, rent base, as applied
    amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    paid_amount     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'pending', 'partially_paid', 'paid', 'waived', 'cancelled',
                        'refund_pending', 'refunded')),
    -- Brokerage credit (decision D-15): fixed when the record is created,
    -- changed only by an authorized override (brokerage_credit_changes).
    -- Reassigning the lead never changes it.
    credited_broker_id UUID NOT NULL REFERENCES brokers(user_id),
    due_date        DATE,
    waived_reason   TEXT,
    waived_by       UUID REFERENCES users(id),
    cancel_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (assignment_id, party),
    CHECK ((source = 'policy') = (policy_id IS NOT NULL AND override_id IS NULL)),
    CHECK ((source <> 'policy') = (override_id IS NOT NULL)),
    CHECK (paid_amount <= amount),
    CHECK (refunded_amount <= paid_amount),
    CHECK (status <> 'waived' OR (waived_reason IS NOT NULL AND waived_by IS NOT NULL)),
    CHECK (status <> 'cancelled' OR cancel_reason IS NOT NULL),
    CHECK (status <> 'paid' OR paid_amount = amount),
    CHECK (status <> 'refunded' OR refunded_amount > 0)
);
CREATE INDEX brokerages_status_idx ON brokerages (status);
CREATE INDEX brokerages_credited_broker_idx ON brokerages (credited_broker_id, status);

-- Every change of brokerage credit. The first row (previous_broker_id NULL,
-- authorized_by NULL) records the initial credit by the system.
CREATE TABLE brokerage_credit_changes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brokerage_id    UUID NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
    previous_broker_id UUID REFERENCES brokers(user_id),
    new_broker_id   UUID NOT NULL REFERENCES brokers(user_id),
    reason          TEXT NOT NULL,
    authorized_by   UUID REFERENCES users(id),       -- Super Admin; NULL only for the initial system credit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (previous_broker_id IS NULL OR authorized_by IS NOT NULL)
);
CREATE INDEX brokerage_credit_changes_brokerage_idx ON brokerage_credit_changes (brokerage_id, created_at);

-- MVP records payments manually; there is no online collection (decision D-08).
-- 'online_gateway' will be added by migration when a gateway is integrated.
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brokerage_id    UUID NOT NULL REFERENCES brokerages(id),
    amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    method          TEXT NOT NULL CHECK (method IN ('upi', 'cash', 'bank_transfer')),
    reference       TEXT,                            -- UPI ref / UTR
    received_at     TIMESTAMPTZ NOT NULL,
    receipt_number  TEXT NOT NULL UNIQUE,            -- e.g. 'RC-2026-000123'
    status          TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'voided')),
    void_reason     TEXT,
    recorded_by     UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (method = 'cash' OR reference IS NOT NULL),
    CHECK (status <> 'voided' OR void_reason IS NOT NULL)
);
CREATE INDEX payments_brokerage_idx ON payments (brokerage_id);

-- Refunds of brokerage already paid, recorded manually. When refunds apply,
-- who approves them and whether partial refunds are allowed are open
-- questions (BR-3); the table supports partial amounts.
CREATE TABLE brokerage_refunds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brokerage_id    UUID NOT NULL REFERENCES brokerages(id),
    amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    reason          TEXT NOT NULL,
    method          TEXT CHECK (method IN ('upi', 'cash', 'bank_transfer')),
    reference       TEXT,
    requested_by    UUID NOT NULL REFERENCES users(id),
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_by    UUID REFERENCES users(id),
    processed_at    TIMESTAMPTZ,
    CHECK (status <> 'completed' OR (processed_by IS NOT NULL AND processed_at IS NOT NULL
                                     AND method IS NOT NULL AND (method = 'cash' OR reference IS NOT NULL)))
);
CREATE INDEX brokerage_refunds_brokerage_idx ON brokerage_refunds (brokerage_id);

-- -----------------------------------------------------------------------------
-- 7. Documents, notifications, audit
-- -----------------------------------------------------------------------------

CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_type    TEXT NOT NULL CHECK (subject_type IN ('student', 'owner', 'property', 'assignment', 'payment')),
    subject_id      UUID NOT NULL,
    doc_type        TEXT NOT NULL CHECK (doc_type IN (
                        'college_id', 'government_id', 'agreement', 'receipt', 'owner_document', 'other')),
    storage_key     TEXT NOT NULL,                   -- private bucket; access only via short-lived signed URL
    file_name       TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size_bytes      INTEGER NOT NULL CHECK (size_bytes > 0),
    sha256          TEXT NOT NULL,
    purpose         TEXT NOT NULL,                   -- why it was collected (DPDP purpose limitation)
    retention_until DATE,                            -- purge job deletes the object after this date
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX documents_subject_idx ON documents (subject_type, subject_id) WHERE deleted_at IS NULL;

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,                   -- e.g. 'lead.assigned', 'visit.reminder'
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    data            JSONB NOT NULL DEFAULT '{}',     -- deep-link ids; never owner contact for students
    channel         TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'push', 'whatsapp', 'sms', 'email')),
    status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

-- Append-only. The application DB role should have INSERT/SELECT only.
CREATE TABLE audit_logs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id        UUID REFERENCES users(id),       -- NULL = system
    action          TEXT NOT NULL,                   -- e.g. 'lead.reassigned', 'owner.viewed'
    entity_type     TEXT NOT NULL,
    entity_id       UUID,
    metadata        JSONB NOT NULL DEFAULT '{}',
    ip              INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at);

-- -----------------------------------------------------------------------------
-- 8. Student-safe read model
--
-- The ONLY relation student/public endpoints may read for property data.
-- Optionally enforce at the DB level by running student reads under a role
-- that is granted SELECT on these views but not on owners /
-- property_private_details (see docs/data-model.md §3).
-- -----------------------------------------------------------------------------

CREATE VIEW student_property_listings AS
SELECT
    p.id,
    p.code,
    p.title,
    p.description,
    p.property_type,
    p.gender_policy,
    p.area_id,
    a.name  AS area_name,
    a.city,
    p.locality_label,
    p.approx_latitude,
    p.approx_longitude,
    p.min_rent,
    p.max_rent,
    p.min_deposit,
    p.maintenance_fee,
    p.food_included,
    p.house_rules,
    p.available_from,
    p.status,
    p.published_at,
    (SELECT count(*) FROM beds b JOIN rooms r ON r.id = b.room_id
      WHERE r.property_id = p.id AND r.status = 'active' AND b.status = 'available') AS available_beds
FROM properties p
JOIN areas a ON a.id = p.area_id
WHERE p.status IN ('published', 'partially_occupied');

CREATE VIEW student_room_availability AS
SELECT
    r.id,
    r.property_id,
    r.label,
    r.sharing,
    r.room_type,
    r.attached_bathroom,
    r.rent_per_bed,
    r.deposit_per_bed,
    r.maintenance_per_bed,
    count(b.id) FILTER (WHERE b.status = 'available') AS available_beds,
    min(b.available_from) FILTER (WHERE b.status IN ('occupied', 'reserved') AND b.available_from IS NOT NULL) AS next_available_from
FROM rooms r
JOIN properties p ON p.id = r.property_id AND p.status IN ('published', 'partially_occupied')
LEFT JOIN beds b ON b.room_id = r.id
WHERE r.status = 'active'
GROUP BY r.id;

-- -----------------------------------------------------------------------------
-- 9. Broker eligibility (docs/broker-allocation.md §3–4)
--
-- Returns eligible brokers for a property, best candidate first:
--   1. the property's assigned broker
--   2. brokers authorized for the property or its area
--   then fewest active leads, then least-recently assigned (round-robin).
-- p_excluded: brokers that already timed out / declined / went unavailable
-- on this lead, so a lead never bounces back to them automatically.
-- The caller must still lock the chosen broker row (SELECT ... FOR UPDATE)
-- and re-check capacity before assigning.
-- -----------------------------------------------------------------------------

CREATE FUNCTION eligible_brokers(
    p_property_id UUID,
    p_excluded    UUID[] DEFAULT '{}',
    p_at          TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (broker_id UUID, tier SMALLINT, active_leads BIGINT, last_assigned_at TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
    SELECT b.user_id,
           CASE WHEN b.user_id = p.broker_id THEN 1 ELSE 2 END::SMALLINT AS tier,
           COALESCE(ac.n, 0) AS active_leads,
           b.last_assigned_at
    FROM properties p
    JOIN brokers b ON TRUE
    JOIN users u ON u.id = b.user_id AND u.role = 'broker' AND u.status = 'active'
    LEFT JOIN LATERAL (
        SELECT count(*) AS n FROM leads l WHERE l.broker_id = b.user_id AND l.is_active
    ) ac ON TRUE
    WHERE p.id = p_property_id
      AND b.accepting_leads
      AND COALESCE(ac.n, 0) < b.max_active_leads
      AND NOT (b.user_id = ANY (p_excluded))
      AND NOT EXISTS (
            SELECT 1 FROM broker_unavailability bu
            WHERE bu.broker_id = b.user_id AND bu.cancelled_at IS NULL
              AND p_at >= bu.starts_at AND p_at < bu.ends_at)
      AND (    b.user_id = p.broker_id
           OR EXISTS (SELECT 1 FROM broker_property_authorizations x
                      WHERE x.broker_id = b.user_id AND x.property_id = p.id)
           OR EXISTS (SELECT 1 FROM broker_area_authorizations x
                      WHERE x.broker_id = b.user_id AND x.area_id = p.area_id))
    ORDER BY tier, active_leads, b.last_assigned_at NULLS FIRST, b.user_id
$$;

-- -----------------------------------------------------------------------------
-- 10. Brokerage quote (docs/brokerage.md §3)
--
-- The amount each party owes for an assignment, one row per CHARGED party
-- (a party that is not charged has no row). Used both to show the amount
-- before confirmation and to create the brokerages rows at confirmation,
-- so the two can never differ. Resolution per party:
--   1. active assignment-level override
--   2. active property-level override
--   3. the best matching active policy: highest priority, then most specific
--      scope (area + property type), then newest
-- Amounts are rounded to 2 decimals; the business rounding rule is open (BR-5).
-- -----------------------------------------------------------------------------

CREATE FUNCTION brokerage_quote(p_assignment_id UUID)
RETURNS TABLE (party TEXT, source TEXT, policy_id UUID, override_id UUID,
               calc_type TEXT, value NUMERIC, rent_base NUMERIC, amount NUMERIC)
LANGUAGE sql STABLE AS $$
    WITH a AS (
        SELECT asg.id, asg.rent_snapshot, p.id AS property_id, p.area_id, p.property_type
        FROM assignments asg JOIN properties p ON p.id = asg.property_id
        WHERE asg.id = p_assignment_id
    ),
    pol AS (
        SELECT bp.*
        FROM brokerage_policies bp, a
        WHERE bp.is_active
          AND (bp.area_id IS NULL OR bp.area_id = a.area_id)
          AND (bp.property_type IS NULL OR bp.property_type = a.property_type)
        ORDER BY bp.priority DESC,
                 ((bp.area_id IS NOT NULL)::int + (bp.property_type IS NOT NULL)::int) DESC,
                 bp.created_at DESC
        LIMIT 1
    ),
    resolved AS (
        SELECT pt.party,
               ao.id AS ao_id, po.id AS po_id, pol.id AS pol_id,
               COALESCE(ao.calc_type, po.calc_type, pc.calc_type) AS calc_type,
               CASE WHEN ao.id IS NOT NULL THEN ao.value
                    WHEN po.id IS NOT NULL THEN po.value
                    ELSE pc.value END AS value,
               a.rent_snapshot
        FROM (VALUES ('student'), ('owner')) AS pt(party)
        CROSS JOIN a
        LEFT JOIN pol ON TRUE
        LEFT JOIN LATERAL (
            SELECT CASE pt.party WHEN 'student' THEN pol.student_calc_type ELSE pol.owner_calc_type END AS calc_type,
                   CASE pt.party WHEN 'student' THEN pol.student_value     ELSE pol.owner_value     END AS value
        ) pc ON TRUE
        LEFT JOIN brokerage_overrides ao
               ON ao.level = 'assignment' AND ao.assignment_id = a.id
              AND ao.party = pt.party AND ao.revoked_at IS NULL
        LEFT JOIN brokerage_overrides po
               ON po.level = 'property' AND po.property_id = a.property_id
              AND po.party = pt.party AND po.revoked_at IS NULL
    )
    SELECT party,
           CASE WHEN ao_id IS NOT NULL THEN 'assignment_override'
                WHEN po_id IS NOT NULL THEN 'property_override'
                ELSE 'policy' END,
           CASE WHEN ao_id IS NULL AND po_id IS NULL THEN pol_id END,
           COALESCE(ao_id, po_id),
           calc_type,
           value,
           rent_snapshot,
           round(CASE calc_type
                     WHEN 'flat' THEN value
                     WHEN 'percent_of_monthly_rent' THEN rent_snapshot * value / 100
                     WHEN 'months_of_rent' THEN rent_snapshot * value
                 END, 2)
    FROM resolved
    WHERE calc_type IS NOT NULL AND calc_type <> 'not_charged'
    ORDER BY party DESC   -- student first
$$;

COMMIT;
