-- Database-level checks for the allocation and integrity rules.
-- Run against a database loaded with db/schema.sql:
--   psql -v ON_ERROR_STOP=1 -d <db> -f db/tests/schema_rules_test.sql
-- Everything runs inside one transaction and is rolled back.
-- A failing ASSERT aborts with the message of the rule that broke.

BEGIN;

-- ---------------------------------------------------------------- fixtures --
INSERT INTO users (id, role, name, phone) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin', 'Admin',      '+910000000001'),
  ('00000000-0000-0000-0000-0000000000b1', 'broker',      'Prop Broker','+910000000011'),
  ('00000000-0000-0000-0000-0000000000b2', 'broker',      'Area B2',    '+910000000012'),
  ('00000000-0000-0000-0000-0000000000b3', 'broker',      'Area B3',    '+910000000013'),
  ('00000000-0000-0000-0000-0000000000b4', 'broker',      'Other Area', '+910000000014'),
  ('00000000-0000-0000-0000-0000000000c1', 'student',     'Student 1',  '+910000000021'),
  ('00000000-0000-0000-0000-0000000000c2', 'student',     'Student 2',  '+910000000022');

INSERT INTO brokers (user_id, display_name, max_active_leads) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'Prop Broker', 2),
  ('00000000-0000-0000-0000-0000000000b2', 'Area B2', 10),
  ('00000000-0000-0000-0000-0000000000b3', 'Area B3', 10),
  ('00000000-0000-0000-0000-0000000000b4', 'Other Area', 10);

INSERT INTO students (user_id) VALUES
  ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2');

INSERT INTO areas (id, name, city) VALUES
  ('00000000-0000-0000-0000-00000000aa01', 'North Campus', 'Pune'),
  ('00000000-0000-0000-0000-00000000aa02', 'South Campus', 'Pune');

INSERT INTO broker_area_authorizations VALUES
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000aa01'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-00000000aa01'),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-00000000aa02');

INSERT INTO owners (id, name, phone, created_by) VALUES
  ('00000000-0000-0000-0000-00000000ee01', 'Owner', '+919999999999', '00000000-0000-0000-0000-0000000000a1');

INSERT INTO properties (id, code, broker_id, title, property_type, area_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-00000000dd01', 'PR-1', '00000000-0000-0000-0000-0000000000b1',
   'Sunrise PG', 'pg', '00000000-0000-0000-0000-00000000aa01', 'published', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000dd02', 'PR-2', '00000000-0000-0000-0000-0000000000b1',
   'Lakeview', 'flat', '00000000-0000-0000-0000-00000000aa01', 'published', '00000000-0000-0000-0000-0000000000a1');

INSERT INTO property_private_details (property_id, owner_id, address_line1) VALUES
  ('00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-00000000ee01', '12 Secret Lane');

INSERT INTO rooms (id, property_id, label, sharing, rent_per_bed, deposit_per_bed) VALUES
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000dd01', 'R1', 2, 8000, 16000);
INSERT INTO beds (id, room_id, label) VALUES
  ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f001', 'A'),
  ('00000000-0000-0000-0000-00000000f102', '00000000-0000-0000-0000-00000000f001', 'B');

CREATE TEMP TABLE t AS SELECT
  '00000000-0000-0000-0000-00000000dd01'::uuid AS prop,
  '00000000-0000-0000-0000-0000000000b1'::uuid AS b1,
  '00000000-0000-0000-0000-0000000000b2'::uuid AS b2,
  '00000000-0000-0000-0000-0000000000b3'::uuid AS b3,
  '00000000-0000-0000-0000-0000000000b4'::uuid AS b4;

-- ------------------------------------------------------------- allocation --
DO $$
DECLARE r record; first uuid; ids uuid[];
BEGIN
  SELECT * INTO r FROM t;

  -- AC1: an available property broker receives the lead first.
  SELECT broker_id INTO first FROM eligible_brokers(r.prop) LIMIT 1;
  ASSERT first = r.b1, 'AC1: property broker should be first';

  -- Brokers authorized only for another area are never candidates.
  SELECT array_agg(broker_id) INTO ids FROM eligible_brokers(r.prop);
  ASSERT NOT (r.b4 = ANY(ids)), 'other-area broker must not be eligible';

  -- AC2/AC3: property broker on leave is bypassed; an area broker gets it.
  INSERT INTO broker_unavailability (broker_id, kind, starts_at, ends_at, created_by)
  VALUES (r.b1, 'leave', now() - interval '1 day', now() + interval '1 day', r.b1);
  SELECT broker_id INTO first FROM eligible_brokers(r.prop) LIMIT 1;
  ASSERT first IN (r.b2, r.b3), 'AC2/3: on-leave broker must be bypassed for an area broker';

  -- Leave in the future does not block.
  UPDATE broker_unavailability SET starts_at = now() + interval '1 day', ends_at = now() + interval '2 days';
  SELECT broker_id INTO first FROM eligible_brokers(r.prop) LIMIT 1;
  ASSERT first = r.b1, 'future leave must not block';

  -- Availability toggle off -> bypassed.
  UPDATE brokers SET accepting_leads = FALSE WHERE user_id = r.b1;
  SELECT broker_id INTO first FROM eligible_brokers(r.prop) LIMIT 1;
  ASSERT first <> r.b1, 'broker with accepting_leads=false must be bypassed';
  UPDATE brokers SET accepting_leads = TRUE WHERE user_id = r.b1;

  -- Suspended account -> bypassed.
  UPDATE users SET status = 'suspended' WHERE id = r.b1;
  SELECT broker_id INTO first FROM eligible_brokers(r.prop) LIMIT 1;
  ASSERT first <> r.b1, 'suspended broker must be bypassed';
  UPDATE users SET status = 'active' WHERE id = r.b1;

  -- Excluded (already timed out on this lead) -> bypassed.
  SELECT broker_id INTO first FROM eligible_brokers(r.prop, ARRAY[r.b1]) LIMIT 1;
  ASSERT first <> r.b1, 'excluded broker must be bypassed';

  -- Tie-break: fewest active leads, then least recently assigned.
  UPDATE brokers SET last_assigned_at = now() - interval '1 hour' WHERE user_id = r.b2;
  UPDATE brokers SET last_assigned_at = now() - interval '2 hours' WHERE user_id = r.b3;
  SELECT broker_id INTO first FROM eligible_brokers(r.prop, ARRAY[r.b1]) LIMIT 1;
  ASSERT first = r.b3, 'round-robin: least recently assigned wins a tie';

  INSERT INTO leads (code, student_id, property_id, broker_id, source, allocation_status)
  VALUES ('LD-T1', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000dd02',
          r.b3, 'interest', 'accepted');
  SELECT broker_id INTO first FROM eligible_brokers(r.prop, ARRAY[r.b1]) LIMIT 1;
  ASSERT first = r.b2, 'fewest active leads beats round-robin';

  -- Capacity: property broker at max_active_leads (2) is bypassed.
  INSERT INTO leads (code, student_id, property_id, broker_id, source, allocation_status) VALUES
    ('LD-T2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000dd02', r.b1, 'interest', 'accepted'),
    ('LD-T3', '00000000-0000-0000-0000-0000000000c2', NULL, r.b1, 'phone', 'accepted');
  SELECT broker_id INTO first FROM eligible_brokers(r.prop) LIMIT 1;
  ASSERT first <> r.b1, 'broker at capacity must be bypassed';

  -- Closed leads free capacity.
  UPDATE leads SET status = 'lost' WHERE code = 'LD-T3';
  SELECT broker_id INTO first FROM eligible_brokers(r.prop) LIMIT 1;
  ASSERT first = r.b1, 'closed lead must free capacity';

  -- AC5: nobody eligible -> empty result (caller puts lead in Unassigned Queue).
  UPDATE brokers SET accepting_leads = FALSE;
  ASSERT NOT EXISTS (SELECT 1 FROM eligible_brokers(r.prop)), 'AC5: expected no eligible brokers';
  UPDATE brokers SET accepting_leads = TRUE;
END $$;

-- ----------------------------------------------------- duplicate leads (AC7) --
INSERT INTO leads (code, student_id, property_id, source, queued_at)
VALUES ('LD-D1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000dd01', 'visit_request', now());

DO $$
BEGIN
  BEGIN
    INSERT INTO leads (code, student_id, property_id, source, queued_at)
    VALUES ('LD-D2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000dd01', 'interest', now());
    RAISE EXCEPTION 'AC7: duplicate active lead was allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Once the first lead is closed, a new active lead is allowed.
  UPDATE leads SET status = 'student_cancelled' WHERE code = 'LD-D1';
  INSERT INTO leads (code, student_id, property_id, source, queued_at)
  VALUES ('LD-D3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000dd01', 'interest', now());
END $$;

-- Allocation-state consistency: 'offered' requires a broker and a deadline.
DO $$
BEGIN
  BEGIN
    UPDATE leads SET allocation_status = 'offered', queued_at = NULL WHERE code = 'LD-D3';
    RAISE EXCEPTION 'offered lead without broker/deadline was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- ----------------------------------------------------- bed double-booking --
DO $$
BEGIN
  INSERT INTO assignments (code, lead_id, student_id, property_id, room_id, bed_id, broker_id, status,
                           rent_snapshot, deposit_snapshot, created_by)
  SELECT 'AS-1', id, student_id, property_id, '00000000-0000-0000-0000-00000000f001',
         '00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-0000000000b1', 'reserved',
         8000, 16000, '00000000-0000-0000-0000-0000000000a1'
  FROM leads WHERE code = 'LD-D3';

  BEGIN
    INSERT INTO assignments (code, lead_id, student_id, property_id, room_id, bed_id, broker_id, status,
                             rent_snapshot, deposit_snapshot, created_by)
    SELECT 'AS-2', id, student_id, property_id, '00000000-0000-0000-0000-00000000f001',
           '00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-0000000000b1', 'confirmed',
           8000, 16000, '00000000-0000-0000-0000-0000000000a1'
    FROM leads WHERE code = 'LD-D3';
    RAISE EXCEPTION 'same bed was assigned twice';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- ------------------------------------------------------ student-safe view --
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(column_name, ',') INTO cols
  FROM information_schema.columns
  WHERE table_name IN ('student_property_listings', 'student_room_availability')
    AND (column_name ~ '(owner|phone|email|address|pincode|landmark|broker_id|created_by)'
         OR column_name IN ('latitude', 'longitude'));
  ASSERT cols IS NULL, format('student views expose private columns: %s', cols);

  ASSERT (SELECT count(*) FROM student_property_listings WHERE code = 'PR-1') = 1, 'published property must be listed';
  UPDATE properties SET status = 'draft' WHERE code = 'PR-1';
  ASSERT (SELECT count(*) FROM student_property_listings WHERE code = 'PR-1') = 0, 'draft property must not be listed';
END $$;

\echo 'All schema rule tests passed.'
ROLLBACK;
