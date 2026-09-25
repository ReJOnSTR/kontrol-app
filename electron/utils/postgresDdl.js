const postgresDdlSql = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role VARCHAR(50) DEFAULT 'user',
    must_change_password INT DEFAULT 0,
    employee_id INT,
    status VARCHAR(50) DEFAULT 'active',
    role_id INT,
    is_active INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    tax_number VARCHAR(100),
    tax_office VARCHAR(100),
    sgk_no VARCHAR(100),
    address TEXT,
    phone VARCHAR(100),
    signature_path TEXT,
    stamp_path TEXT,
    plan VARCHAR(50) DEFAULT 'PRO',
    status VARCHAR(50) DEFAULT 'active',
    expires_at TIMESTAMP,
    max_vehicles INT DEFAULT 50,
    max_employees INT DEFAULT 50,
    max_users INT DEFAULT 10,
    storage_limit_mb INT DEFAULT 1024,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(100),
    email VARCHAR(255),
    address TEXT,
    tax_number VARCHAR(100),
    tax_office VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    plate VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    year INT,
    color VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    km INT DEFAULT 0,
    image TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    tc_no VARCHAR(50),
    phone VARCHAR(100),
    email VARCHAR(255),
    position VARCHAR(100),
    department VARCHAR(100),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    salary DOUBLE PRECISION DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    image TEXT,
    signature_path TEXT,
    is_archived INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    past_used_leaves INT DEFAULT 0,
    birth_date TIMESTAMP,
    devir_izin_bakiyesi INT DEFAULT 0,
    devir_maas_bakiyesi DOUBLE PRECISION DEFAULT 0,
    devir_tarihi TIMESTAMP,
    iban VARCHAR(100),
    off_days VARCHAR(50) DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 1,
    assigned_to VARCHAR(255),
    department VARCHAR(100),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
    related_type VARCHAR(100),
    related_id INT,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(100),
    doc_type VARCHAR(100),
    category VARCHAR(100),
    folder VARCHAR(100),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS employee_assignments (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    serial_number VARCHAR(255),
    quantity INT DEFAULT 1,
    assign_date TIMESTAMP,
    return_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS employee_attendance (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS employee_documents (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(100),
    category VARCHAR(100),
    folder VARCHAR(100),
    issue_date TIMESTAMP,
    start_date TIMESTAMP,
    expiry_date TIMESTAMP,
    is_archived INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_movements (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount DOUBLE PRECISION DEFAULT 0,
    date TIMESTAMP NOT NULL,
    description TEXT,
    is_paid INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50) DEFAULT 'cash'
);

CREATE TABLE IF NOT EXISTS employee_salary_history (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION DEFAULT 0,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    type VARCHAR(50) DEFAULT 'initial',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspections (
    id SERIAL PRIMARY KEY,
    vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    inspection_date TIMESTAMP NOT NULL,
    next_inspection TIMESTAMP,
    result VARCHAR(100),
    cost DOUBLE PRECISION DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50) DEFAULT 'traffic',
    file_path TEXT,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS insurances (
    id SERIAL PRIMARY KEY,
    vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    company VARCHAR(255) NOT NULL,
    policy_no VARCHAR(100),
    type VARCHAR(100) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    premium DOUBLE PRECISION DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leaves (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'annual',
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    days DOUBLE PRECISION DEFAULT 1,
    hours DOUBLE PRECISION,
    status VARCHAR(50) DEFAULT 'approved',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS maintenances (
    id SERIAL PRIMARY KEY,
    vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    date TIMESTAMP NOT NULL,
    cost DOUBLE PRECISION DEFAULT 0,
    next_km INT,
    next_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meal_settings (
    id SERIAL PRIMARY KEY,
    company_id INT UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    price_per_person DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meal_tickets (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL,
    person_count INT DEFAULT 1,
    price_per_person DOUBLE PRECISION DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meal_price_history (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    old_price DOUBLE PRECISION DEFAULT 0,
    new_price DOUBLE PRECISION DEFAULT 0,
    change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS overtimes (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL,
    hours DOUBLE PRECISION DEFAULT 0,
    rate DOUBLE PRECISION DEFAULT 1.5,
    amount DOUBLE PRECISION DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    method VARCHAR(50) DEFAULT 'CASH',
    amount DOUBLE PRECISION NOT NULL,
    category VARCHAR(100) DEFAULT 'Diğer',
    description TEXT,
    frequency VARCHAR(50) DEFAULT 'MONTHLY',
    next_run_date TIMESTAMP NOT NULL,
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS salaries (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period VARCHAR(50) NOT NULL,
    base_salary DOUBLE PRECISION DEFAULT 0,
    bonus DOUBLE PRECISION DEFAULT 0,
    deduction DOUBLE PRECISION DEFAULT 0,
    net_salary DOUBLE PRECISION DEFAULT 0,
    payment_date TIMESTAMP,
    salary_month VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50) DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INT PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    service_name VARCHAR(255),
    description TEXT,
    date TIMESTAMP NOT NULL,
    km INT,
    cost DOUBLE PRECISION DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    amount DOUBLE PRECISION DEFAULT 0,
    description TEXT,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    method VARCHAR(50) DEFAULT 'CASH',
    check_number VARCHAR(100),
    check_due_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'COMPLETED',
    currency VARCHAR(20) DEFAULT 'TRY',
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS works (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
    employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    customer VARCHAR(255),
    title VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    price DOUBLE PRECISION DEFAULT 0,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    work_start_time VARCHAR(20) DEFAULT '08:00',
    work_end_time VARCHAR(20) DEFAULT '17:00',
    is_archived INT DEFAULT 0,
    pazar_multiplier DOUBLE PRECISION DEFAULT 1.5,
    mesai_multiplier DOUBLE PRECISION DEFAULT 1.5
);

CREATE TABLE IF NOT EXISTS work_items (
    id SERIAL PRIMARY KEY,
    work_id INT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL,
    receipt_no VARCHAR(100),
    vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
    employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
    custom_vehicle VARCHAR(255),
    custom_employee VARCHAR(255),
    start_time VARCHAR(20),
    end_time VARCHAR(20),
    hours DOUBLE PRECISION DEFAULT 0,
    overtime_hours DOUBLE PRECISION DEFAULT 0,
    unit_price DOUBLE PRECISION DEFAULT 0,
    travel_price DOUBLE PRECISION DEFAULT 0,
    total_price DOUBLE PRECISION DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_types (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_categories (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    target_type VARCHAR(50) DEFAULT 'employee',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_folders (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    related_type VARCHAR(50),
    related_id INT,
    is_archived INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_types (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public_holidays (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL,
    can_read INT DEFAULT 0,
    can_create INT DEFAULT 0,
    can_update INT DEFAULT 0,
    can_delete INT DEFAULT 0,
    can_approve INT DEFAULT 0,
    scope VARCHAR(50) DEFAULT 'OWN'
);

CREATE TABLE IF NOT EXISTS user_company_access (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicles VARCHAR(50) DEFAULT 'crud',
    employees VARCHAR(50) DEFAULT 'crud',
    finance VARCHAR(50) DEFAULT 'crud',
    works VARCHAR(50) DEFAULT 'crud',
    settings VARCHAR(50) DEFAULT 'none',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    request_data TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    current_step INT DEFAULT 1,
    total_steps INT DEFAULT 1,
    document_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_approvals (
    id SERIAL PRIMARY KEY,
    request_id INT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    approver_id INT REFERENCES users(id) ON DELETE SET NULL,
    step INT DEFAULT 1,
    status VARCHAR(50) NOT NULL,
    comment TEXT,
    action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_settings (
    company_id INTEGER PRIMARY KEY,
    settings_json TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY,
    preferences_json TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Self-healing Column Upgrades for Existing PostgreSQL Tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS allow_login INT DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS signature_path TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS iban VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS off_days VARCHAR(50) DEFAULT '0';

ALTER TABLE documents ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;

ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS related_type VARCHAR(100);
ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS related_id INT;

ALTER TABLE public_holidays ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE works ALTER COLUMN title DROP NOT NULL;
DROP TABLE IF EXISTS arvento_history CASCADE;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'PRO';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS max_vehicles INT DEFAULT 50;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS max_employees INT DEFAULT 50;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS max_users INT DEFAULT 10;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS storage_limit_mb INT DEFAULT 1024;

-- Row Level Security (RLS) & Policies
DO $$
DECLARE
    tbl text;
    all_tables text[] := ARRAY[
        'email_templates',
        'user_notification_settings',
        'company_settings',
        'system_announcements',
        'company_notification_settings',
        'email_settings',
        'audit_logs',
        'user_preferences'
    ];
BEGIN
    FOREACH tbl IN ARRAY all_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS allow_all_access ON public.%I;', tbl);
            EXECUTE format('CREATE POLICY allow_all_access ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl);
        END IF;
    END LOOP;
END $$;

-- Safe Cross-Sync Triggers between public.users and auth.users with Recursion Guard
CREATE OR REPLACE FUNCTION handle_deleted_user()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN OLD;
    END IF;
    IF OLD.email IS NOT NULL THEN
        DELETE FROM auth.identities WHERE provider_id = LOWER(OLD.email) OR identity_data->>'email' = LOWER(OLD.email);
        DELETE FROM auth.users WHERE LOWER(email) = LOWER(OLD.email);
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_deleted_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN OLD;
    END IF;
    IF OLD.email IS NOT NULL THEN
        DELETE FROM public.users WHERE LOWER(email) = LOWER(OLD.email);
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_public_user_deleted ON public.users;
CREATE TRIGGER on_public_user_deleted
AFTER DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION handle_deleted_user();

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_deleted_auth_user();

-- Automatic Synchronization Trigger from public.users to auth.users (INSERT & UPDATE)
CREATE OR REPLACE FUNCTION sync_public_user_to_auth()
RETURNS TRIGGER AS $$
DECLARE
    auth_uid uuid;
    comp_id bigint;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.email IS NULL OR NEW.email = '' THEN
        RETURN NEW;
    END IF;

    IF NEW.role = 'superadmin' THEN
        comp_id := NULL;
    ELSE
        IF NEW.employee_id IS NOT NULL THEN
            SELECT company_id INTO comp_id FROM public.employees WHERE id = NEW.employee_id;
        END IF;
        IF comp_id IS NULL THEN
            comp_id := 15;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        SELECT id INTO auth_uid FROM auth.users WHERE LOWER(email) = LOWER(NEW.email);
        
        IF auth_uid IS NOT NULL THEN
            UPDATE auth.users
            SET 
                encrypted_password = NEW.password_hash,
                raw_user_meta_data = jsonb_build_object(
                    'role', NEW.role,
                    'username', NEW.username,
                    'full_name', COALESCE(NEW.full_name, NEW.username),
                    'company_id', comp_id,
                    'employee_id', NEW.employee_id,
                    'email_verified', true
                ),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = auth_uid;
        ELSE
            INSERT INTO auth.users (
                instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                confirmation_token, email_change, email_change_token_new, recovery_token
            ) VALUES (
                '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
                LOWER(NEW.email), NEW.password_hash, CURRENT_TIMESTAMP,
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object(
                    'role', NEW.role,
                    'username', NEW.username,
                    'full_name', COALESCE(NEW.full_name, NEW.username),
                    'company_id', comp_id,
                    'employee_id', NEW.employee_id,
                    'email_verified', true
                ),
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                '', '', '', ''
            ) RETURNING id INTO auth_uid;

            INSERT INTO auth.identities (
                id, user_id, identity_data, provider, provider_id,
                created_at, updated_at
            ) VALUES (
                gen_random_uuid(), auth_uid,
                jsonb_build_object('sub', auth_uid::text, 'email', LOWER(NEW.email)),
                'email', LOWER(NEW.email),
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        SELECT id INTO auth_uid FROM auth.users WHERE LOWER(email) = LOWER(OLD.email);
        IF auth_uid IS NULL THEN
            SELECT id INTO auth_uid FROM auth.users WHERE LOWER(email) = LOWER(NEW.email);
        END IF;

        IF auth_uid IS NOT NULL THEN
            UPDATE auth.users
            SET 
                email = LOWER(NEW.email),
                encrypted_password = NEW.password_hash,
                raw_user_meta_data = jsonb_build_object(
                    'role', NEW.role,
                    'username', NEW.username,
                    'full_name', COALESCE(NEW.full_name, NEW.username),
                    'company_id', comp_id,
                    'employee_id', NEW.employee_id,
                    'email_verified', true
                ),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = auth_uid;

            UPDATE auth.identities
            SET 
                provider_id = LOWER(NEW.email),
                identity_data = jsonb_build_object('sub', auth_uid::text, 'email', LOWER(NEW.email)),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = auth_uid;
        ELSE
            INSERT INTO auth.users (
                instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                confirmation_token, email_change, email_change_token_new, recovery_token
            ) VALUES (
                '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
                LOWER(NEW.email), NEW.password_hash, CURRENT_TIMESTAMP,
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object(
                    'role', NEW.role,
                    'username', NEW.username,
                    'full_name', COALESCE(NEW.full_name, NEW.username),
                    'company_id', comp_id,
                    'employee_id', NEW.employee_id,
                    'email_verified', true
                ),
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                '', '', '', ''
            ) RETURNING id INTO auth_uid;

            INSERT INTO auth.identities (
                id, user_id, identity_data, provider, provider_id,
                created_at, updated_at
            ) VALUES (
                gen_random_uuid(), auth_uid,
                jsonb_build_object('sub', auth_uid::text, 'email', LOWER(NEW.email)),
                'email', LOWER(NEW.email),
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
        END IF;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_public_user_to_auth warning: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_public_user_synced_to_auth ON public.users;
CREATE TRIGGER on_public_user_synced_to_auth
AFTER INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION sync_public_user_to_auth();

CREATE OR REPLACE FUNCTION sync_vehicle_km_from_service()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.vehicle_id IS NOT NULL AND NEW.km IS NOT NULL AND NEW.km > 0 THEN
        UPDATE public.vehicles
        SET km = NEW.km
        WHERE id = NEW.vehicle_id AND (km IS NULL OR km < NEW.km);
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_vehicle_km_from_service warning: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_vehicle_km_service ON public.services;
CREATE TRIGGER trg_sync_vehicle_km_service
AFTER INSERT OR UPDATE OF km ON public.services
FOR EACH ROW EXECUTE FUNCTION sync_vehicle_km_from_service();

CREATE OR REPLACE FUNCTION prune_old_audit_logs(retention_days INT DEFAULT 180)
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.audit_logs
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

module.exports = { postgresDdlSql };


