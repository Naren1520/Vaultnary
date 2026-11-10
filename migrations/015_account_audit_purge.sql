CREATE OR REPLACE FUNCTION public.purge_account_audit_events(p_user_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    DELETE FROM public.audit_events
    WHERE actor_id = p_user_id OR resource_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.purge_account_audit_events(UUID) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vaultnary_app') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.purge_account_audit_events(UUID) TO vaultnary_app';
    END IF;
END
$$;
