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

-- ------------------------------------------------------- brokerage quote --
-- Assignment AS-1: property PR-1 (area North Campus, type pg), rent 8000.
DO $$
DECLARE asg uuid; adm uuid := '00000000-0000-0000-0000-0000000000a1';
        q record; n int; pol_specific uuid;
BEGIN
  SELECT id INTO asg FROM assignments WHERE code = 'AS-1';

  ASSERT NOT EXISTS (SELECT 1 FROM brokerage_quote(asg)), 'no policy -> nothing charged';

  -- Global policy: student pays 1 month's rent.
  INSERT INTO brokerage_policies (name, payer_mode, student_calc_type, student_value, created_by)
  VALUES ('Default', 'student', 'months_of_rent', 1, adm);
  SELECT count(*) INTO n FROM brokerage_quote(asg);
  SELECT * INTO q FROM brokerage_quote(asg) WHERE party = 'student';
  ASSERT n = 1 AND q.amount = 8000 AND q.source = 'policy', 'global policy: student pays 1 month';

  -- Same priority, more specific (area + type): both pay, calculated independently.
  INSERT INTO brokerage_policies (name, area_id, property_type, payer_mode,
                                  student_calc_type, student_value, owner_calc_type, owner_value, created_by)
  VALUES ('North PGs', '00000000-0000-0000-0000-00000000aa01', 'pg', 'both',
          'percent_of_monthly_rent', 50, 'flat', 2500, adm)
  RETURNING id INTO pol_specific;
  SELECT * INTO q FROM brokerage_quote(asg) WHERE party = 'student';
  ASSERT q.amount = 4000 AND q.policy_id = pol_specific, 'specific policy wins: student 50% of rent';
  SELECT * INTO q FROM brokerage_quote(asg) WHERE party = 'owner';
  ASSERT q.amount = 2500, 'specific policy: owner flat 2500';

  -- Higher priority beats specificity.
  INSERT INTO brokerage_policies (name, priority, payer_mode, owner_calc_type, owner_value, created_by)
  VALUES ('Promo', 10, 'owner', 'flat', 1000, adm);
  SELECT count(*) INTO n FROM brokerage_quote(asg);
  SELECT * INTO q FROM brokerage_quote(asg);
  ASSERT n = 1 AND q.party = 'owner' AND q.amount = 1000, 'higher priority policy wins';
  UPDATE brokerage_policies SET is_active = FALSE, deactivated_at = now() WHERE name = 'Promo';

  -- Property-level override: student not charged at this property.
  INSERT INTO brokerage_overrides (level, property_id, party, calc_type, reason, created_by)
  VALUES ('property', '00000000-0000-0000-0000-00000000dd01', 'student', 'not_charged', 'Owner-paid property', adm);
  SELECT count(*) INTO n FROM brokerage_quote(asg);
  ASSERT n = 1 AND NOT EXISTS (SELECT 1 FROM brokerage_quote(asg) WHERE party = 'student'),
         'property override removes the student charge';

  -- Assignment-level override beats property-level override.
  INSERT INTO brokerage_overrides (level, assignment_id, party, calc_type, value, reason, created_by)
  VALUES ('assignment', asg, 'student', 'flat', 3000, 'Negotiated discount', adm);
  SELECT * INTO q FROM brokerage_quote(asg) WHERE party = 'student';
  ASSERT q.amount = 3000 AND q.source = 'assignment_override', 'assignment override wins';

  -- Revoking the assignment override falls back to the property override.
  UPDATE brokerage_overrides SET revoked_at = now(), revoked_by = adm, revoke_reason = 'Entered by mistake'
  WHERE level = 'assignment';
  ASSERT NOT EXISTS (SELECT 1 FROM brokerage_quote(asg) WHERE party = 'student'), 'revoked override no longer applies';

  -- Overrides need a reason; one active override per party and level.
  BEGIN
    INSERT INTO brokerage_overrides (level, assignment_id, party, calc_type, value, reason, created_by)
    VALUES ('assignment', asg, 'owner', 'flat', 1, ' ', adm);
    RAISE EXCEPTION 'override without reason was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO brokerage_overrides (level, property_id, party, calc_type, reason, created_by)
    VALUES ('property', '00000000-0000-0000-0000-00000000dd01', 'student', 'not_charged', 'again', adm);
    RAISE EXCEPTION 'two active overrides for one party were allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Policy validation.
  BEGIN
    INSERT INTO brokerage_policies (name, payer_mode, student_calc_type, student_value, created_by)
    VALUES ('Bad', 'both', 'flat', 100, adm);
    RAISE EXCEPTION 'payer both without owner calculation was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO brokerage_policies (name, payer_mode, student_calc_type, student_value, created_by)
    VALUES ('Bad', 'student', 'percent_of_monthly_rent', 120, adm);
    RAISE EXCEPTION 'percentage above 100 was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO brokerage_policies (name, payer_mode, owner_calc_type, owner_value, created_by)
    VALUES ('Bad', 'owner', 'months_of_rent', 0.5, adm);
    RAISE EXCEPTION 'less than one month of rent was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- ------------------------------------------- brokerage records and credit --
DO $$
DECLARE asg uuid; adm uuid := '00000000-0000-0000-0000-0000000000a1';
        b1 uuid := '00000000-0000-0000-0000-0000000000b1'; b2 uuid := '00000000-0000-0000-0000-0000000000b2';
        brk uuid; pol uuid;
BEGIN
  SELECT id INTO asg FROM assignments WHERE code = 'AS-1';
  SELECT id INTO pol FROM brokerage_policies WHERE name = 'North PGs';

  INSERT INTO brokerages (assignment_id, party, source, policy_id, calc_snapshot, amount, credited_broker_id)
  VALUES (asg, 'owner', 'policy', pol, '{}', 2500, b1) RETURNING id INTO brk;

  BEGIN
    UPDATE brokerages SET status = 'waived' WHERE id = brk;
    RAISE EXCEPTION 'waiver without reason was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE brokerages SET status = 'paid', paid_amount = 1000 WHERE id = brk;
    RAISE EXCEPTION 'paid status with balance outstanding was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE brokerages SET paid_amount = 1000, refunded_amount = 1500 WHERE id = brk;
    RAISE EXCEPTION 'refund above paid amount was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Initial credit is recorded by the system; a later change needs an authorizer.
  INSERT INTO brokerage_credit_changes (brokerage_id, new_broker_id, reason)
  VALUES (brk, b1, 'Broker on confirmed assignment');
  BEGIN
    INSERT INTO brokerage_credit_changes (brokerage_id, previous_broker_id, new_broker_id, reason)
    VALUES (brk, b1, b2, 'move');
    RAISE EXCEPTION 'unauthorized credit change was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Reassigning the lead does not change brokerage credit.
  UPDATE leads SET broker_id = b2, allocation_status = 'accepted', queued_at = NULL WHERE code = 'LD-D3';
  ASSERT (SELECT credited_broker_id FROM brokerages WHERE id = brk) = b1, 'lead reassignment changed credit';

  -- MVP: no online payment collection.
  BEGIN
    INSERT INTO payments (brokerage_id, amount, method, reference, received_at, receipt_number, recorded_by)
    VALUES (brk, 100, 'online_gateway', 'x', now(), 'RC-T1', adm);
    RAISE EXCEPTION 'online gateway payment was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO payments (brokerage_id, amount, method, received_at, receipt_number, recorded_by)
    VALUES (brk, 100, 'upi', now(), 'RC-T2', adm);
    RAISE EXCEPTION 'UPI payment without reference was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
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
