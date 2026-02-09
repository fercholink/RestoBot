-- TABLAS PARA EL MÓDULO HOTELERO

-- 1. Tabla de Habitaciones
CREATE TABLE IF NOT EXISTS rooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    number TEXT NOT NULL UNIQUE, -- Ej: "101", "205"
    type TEXT NOT NULL,          -- Ej: "Sencilla", "Doble", "Suite"
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'disponible', -- 'disponible', 'ocupada', 'sucia', 'mantenimiento'
    features JSONB DEFAULT '{}', -- Ej: {"wifi": true, "ac": true, "beds": 2},
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Huéspedes
CREATE TABLE IF NOT EXISTS guests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    full_name TEXT NOT NULL,
    document_id TEXT UNIQUE,     -- Cédula/Pasaporte
    phone TEXT,
    email TEXT,
    preferences TEXT,            -- Ej: "Alérgico a las nueces", "Piso bajo"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Reservas
CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'reservada', -- 'reservada', 'checkin', 'checkout', 'cancelada'
    total_price NUMERIC(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de Cargos a la Habitación (Integración con Restaurante)
CREATE TABLE IF NOT EXISTS room_charges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    description TEXT NOT NULL,   -- Ej: "Consumo Restaurante", "Lavandería"
    amount NUMERIC(10, 2) NOT NULL,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL, -- Link opcional a pedidos del restaurante
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permisos (RLS) - Simple: Permitir todo a usuarios autenticados por ahora
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON rooms FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON guests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON bookings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON room_charges FOR ALL USING (auth.role() = 'authenticated');

-- Datos Semilla (Seed Data) - Habitaciones de Ejemplo
INSERT INTO rooms (number, type, base_price, status) VALUES 
('101', 'Sencilla', 50000, 'disponible'),
('102', 'Sencilla', 50000, 'disponible'),
('201', 'Doble', 80000, 'disponible'),
('202', 'Doble', 80000, 'disponible'),
('301', 'Suite', 150000, 'disponible')
ON CONFLICT (number) DO NOTHING;
