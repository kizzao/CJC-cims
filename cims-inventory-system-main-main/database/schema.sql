-- School Clinic Inventory Management System
-- Database Schema for PostgreSQL

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and role management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
   role VARCHAR(20) CHECK (role IN ('NURSE', 'ADMIN', 'HEAD_NURSE', 'VIEWER', 'STUDENT_ASSISTANT')) DEFAULT 'NURSE',
    license_number VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories for organizing inventory (Medicine, Equipment, Supplies, etc.)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color_code VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50) DEFAULT 'box',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main inventory items table
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    sku VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    brand_name VARCHAR(255),
    description TEXT,
    
    -- Clinical information (especially for medicines)
    dosage_info TEXT,
    usage_instructions TEXT,
    indications TEXT,
    contraindications TEXT,
    side_effects TEXT,
    storage_conditions VARCHAR(100) DEFAULT 'Room temperature',
    
    -- Inventory tracking
    unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'pieces',
    current_quantity INTEGER NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
    minimum_threshold INTEGER DEFAULT 10,
    reorder_point INTEGER DEFAULT 20,
    
    -- Expiration tracking (critical for medicines)
    expiration_date DATE,
    batch_number VARCHAR(100),
    date_received DATE DEFAULT CURRENT_DATE,
    
    -- Supplier and metadata
    supplier_info JSONB,
    location VARCHAR(100),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transaction log for audit trail (IMMUTABLE - never delete, only append)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES inventory_items(id),
    transaction_type VARCHAR(20) CHECK (transaction_type IN ('IN', 'OUT', 'ADJUSTMENT', 'EXPIRED', 'DAMAGED', 'RETURNED')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    
    -- Context information
    reason TEXT NOT NULL,
    notes TEXT,
    student_id VARCHAR(50),
    student_name VARCHAR(100),
    student_grade VARCHAR(20),
    administered_by UUID REFERENCES users(id),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_items_category ON inventory_items(category_id);
CREATE INDEX idx_items_name ON inventory_items USING gin(to_tsvector('english', name || ' ' || COALESCE(generic_name, '')));
CREATE INDEX idx_items_expiration ON inventory_items(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX idx_items_stock_alert ON inventory_items(current_quantity, minimum_threshold) WHERE current_quantity <= minimum_threshold;
CREATE INDEX idx_transactions_item ON transactions(item_id);
CREATE INDEX idx_transactions_date ON transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);

-- Views for common queries
CREATE VIEW low_stock_alerts AS
SELECT 
    i.*,
    c.name as category_name,
    c.color_code,
    c.icon,
    (i.minimum_threshold - i.current_quantity) as shortage_amount
FROM inventory_items i
JOIN categories c ON i.category_id = c.id
WHERE i.current_quantity <= i.minimum_threshold 
    AND i.is_active = true
ORDER BY (i.current_quantity::float / NULLIF(i.minimum_threshold, 0)) ASC;

CREATE VIEW expiring_soon AS
SELECT 
    i.*,
    c.name as category_name,
    c.color_code,
    (i.expiration_date - CURRENT_DATE) as days_until_expiry,
    CASE 
        WHEN i.expiration_date <= CURRENT_DATE THEN 'EXPIRED'
        WHEN i.expiration_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'CRITICAL'
        WHEN i.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'WARNING'
        ELSE 'GOOD'
    END as expiry_status
FROM inventory_items i
JOIN categories c ON i.category_id = c.id
WHERE i.expiration_date IS NOT NULL 
    AND i.expiration_date <= CURRENT_DATE + INTERVAL '90 days'
    AND i.current_quantity > 0
    AND i.is_active = true
ORDER BY i.expiration_date;

CREATE VIEW inventory_status AS
SELECT 
    i.*,
    c.name as category_name,
    c.color_code,
    c.icon,
    CASE 
        WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN 'EXPIRED'
        WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
        WHEN i.current_quantity = 0 THEN 'OUT_OF_STOCK'
        WHEN i.current_quantity <= i.minimum_threshold THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END as status,
    CASE 
        WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN 4
        WHEN i.current_quantity = 0 THEN 3
        WHEN i.current_quantity <= i.minimum_threshold THEN 2
        WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1
        ELSE 0
    END as priority_level
FROM inventory_items i
JOIN categories c ON i.category_id = c.id
WHERE i.is_active = true;

-- Trigger function to prevent negative stock
CREATE OR REPLACE FUNCTION prevent_negative_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_quantity < 0 THEN
        RAISE EXCEPTION 'Insufficient stock. Cannot reduce below 0 for item: %', NEW.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_negative_stock
    BEFORE UPDATE OF current_quantity ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION prevent_negative_stock();

-- Trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories
INSERT INTO categories (name, description, color_code, icon) VALUES
('Medicine', 'Prescription and over-the-counter medications', '#EF4444', 'pill'),
('First Aid', 'Bandages, antiseptics, and emergency supplies', '#F59E0B', 'first-aid'),
('Equipment', 'Medical devices and diagnostic tools', '#3B82F6', 'stethoscope'),
('Supplies', 'General clinic supplies and consumables', '#10B981', 'box'),
('Vaccines', 'Immunization and vaccine supplies', '#8B5CF6', 'syringe');

-- Insert default admin user (password: admin123 - change in production!)
-- Password hash is bcrypt for 'admin123'
INSERT INTO users (username, email, password_hash, full_name, role, is_active) VALUES
('admin', 'admin@school.edu', '$2a$10$WiC1dU9h41ewcO5PAAcpd.JGiWPHom58lpAt5lvKFdkfIsoONP7GW', 'System Administrator', 'ADMIN', true),
('nurse1', 'nurse@school.edu', '$2a$10$WiC1dU9h41ewcO5PAAcpd.JGiWPHom58lpAt5lvKFdkfIsoONP7GW', 'Head Nurse', 'HEAD_NURSE', true);