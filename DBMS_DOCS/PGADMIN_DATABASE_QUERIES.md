# PostgreSQL Queries for pgAdmin

Use this guide in pgAdmin's **Query Tool** after connecting to the Vaultnary
database. The queries inspect the live database; results depend on the database
you connect to and the permissions of your database role.

> **Sensitive data:** The full-table export near the end includes all columns,
> including password/session hashes, encrypted vault payloads and key material,
> recovery data, email contents, and personal information. Run it only against a
> database you are authorized to inspect. Prefer a local development database;
> protect and delete exported files securely. For a database backup, use
> pgAdmin's **Backup** feature instead of exporting rows to CSV.

## 1. List public tables

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

This includes application tables and `_sqlx_migrations` if present.

## 2. List columns for public tables

```sql
SELECT
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.columns AS c
JOIN information_schema.tables AS t
  ON t.table_schema = c.table_schema
 AND t.table_name = c.table_name
WHERE c.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position;
```

## 3. List triggers

```sql
SELECT
    event_object_table AS table_name,
    trigger_name,
    event_manipulation AS event,
    action_timing AS timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name, event_manipulation;
```

## 4. Check for the audit purge function

```sql
SELECT
    routine_schema,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'purge_account_audit_events';
```

## 5. Generate a SELECT statement for every public table

Run this query, then copy and execute the generated statements if you want
separate, normal table-shaped result grids. Inspect sensitive columns before
exporting or sharing the results.

```sql
SELECT format('SELECT * FROM %I.%I;', table_schema, table_name) AS query
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

## 6. Export every public table as JSON rows in one result

Run the complete script in one pgAdmin Query Tool session. It temporarily
collects every row from every public base table, then returns one result grid
with a `table_name` and a JSON `row_data` value per row. Use the Query Tool's
**Download/Save results** control to save the result if needed. Large databases
can produce very large results.

```sql
CREATE TEMP TABLE vaultnary_pgadmin_export (
    table_name TEXT NOT NULL,
    row_data   JSONB NOT NULL
);

DO $$
DECLARE
    source_table RECORD;
BEGIN
    FOR source_table IN
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        EXECUTE format(
            'INSERT INTO pg_temp.vaultnary_pgadmin_export (table_name, row_data)
             SELECT %L, to_jsonb(source_row)
             FROM %I.%I AS source_row',
            source_table.table_name,
            source_table.table_schema,
            source_table.table_name
        );
    END LOOP;
END;
$$;

SELECT table_name, row_data
FROM pg_temp.vaultnary_pgadmin_export
ORDER BY table_name;
```

The export is read-only with respect to application tables; it creates and drops
only a temporary table in the current database session. The temporary table is
removed when the session closes. A table your role cannot read will cause the
export to fail with a permission error; row-level security may also limit which
rows are returned.

## 7. Examples for `vault_items`

These are optional examples. Replace the UUID literals with real IDs from your
own database. The insert requires an existing vault ID. Update and delete use
the credential's primary key so they affect at most one row.

### Insert one demo credential

```sql
INSERT INTO vault_items (vault_id, name, credential_type)
VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, -- replace with an existing vault ID
    'Demo Credential',
    'custom'
)
RETURNING id, vault_id, name, credential_type;
```

### Delete one credential by ID

```sql
DELETE FROM vault_items
WHERE id = '00000000-0000-0000-0000-000000000000'::uuid -- replace with its ID
RETURNING id, vault_id, name, credential_type;
```

### Update one credential by ID

```sql
UPDATE vault_items
SET name = 'Updated Credential'
WHERE id = '00000000-0000-0000-0000-000000000000'::uuid -- replace with its ID
RETURNING id, vault_id, name, credential_type;
```

### Search names within one vault

```sql
SELECT id, vault_id, name, credential_type, tags
FROM vault_items
WHERE vault_id = '00000000-0000-0000-0000-000000000000'::uuid -- replace with vault ID
  AND name ILIKE '%email%'
ORDER BY name;
```

### List credential metadata within one vault

```sql
SELECT id, vault_id, name, credential_type, tags, created_at
FROM vault_items
WHERE vault_id = '00000000-0000-0000-0000-000000000000'::uuid -- replace with vault ID
ORDER BY created_at, name;
```

`credential_type = 'custom'` is allowed by the schema. `vault_items` may also
contain `encrypted_payload` and notes; these examples intentionally omit them.
See [`database_queries.sql`](./database_queries.sql) for additional
read-only, application-specific queries and
[`DBMS_SCHEMA_GUIDE.md`](./DBMS_SCHEMA_GUIDE.md) for the schema reference.
