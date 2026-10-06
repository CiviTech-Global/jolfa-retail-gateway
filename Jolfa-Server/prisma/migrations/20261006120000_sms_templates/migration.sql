-- Which events send an SMS, and what they say — editable by the shop owner.
--
-- Before this, the only SMS in the system was the password-reset code, its text
-- was a string literal in the service, and there was no way to switch it off or
-- to add a notification without a deploy.
--
-- The channel split is imposed by SMS.ir, not invented here. VERIFY references
-- a template registered in their panel: it sends from a service line, arrives in
-- seconds and reaches people who have blocked advertising SMS, which is the only
-- acceptable path for a one-time code. BULK sends free text from the shop's own
-- line, which the admin can edit freely but which needs a line number and will
-- not reach anyone who has blocked advertising.

CREATE TABLE sms_templates (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    event                varchar(60) NOT NULL UNIQUE,
    enabled              boolean     NOT NULL DEFAULT true,
    channel              varchar(10) NOT NULL DEFAULT 'BULK',
    body                 text,
    provider_template_id integer,
    created_at           timestamptz(6) NOT NULL DEFAULT now(),
    updated_at           timestamptz(6) NOT NULL DEFAULT now()
);

-- Only two channels exist, and a typo in this column would otherwise surface as
-- a notification that silently never sends.
ALTER TABLE sms_templates
    ADD CONSTRAINT sms_templates_channel_check
    CHECK (channel IN ('VERIFY', 'BULK'));

-- Deliberately *not* constrained here: a VERIFY row whose provider_template_id
-- is still null, or a BULK row with an empty body, is configuration the admin
-- has not finished rather than corrupt data. The row has to be able to exist in
-- that state so the SMS settings page can list the event and offer somewhere to
-- paste the template id from SMS.ir's panel. Sendability is enforced where it
-- matters instead: notify() refuses to call SMS.ir and records the reason, and
-- the admin sees that same reason as the template's `blockedReason`.
