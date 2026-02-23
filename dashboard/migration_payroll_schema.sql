CREATE TABLE IF NOT EXISTS public.payroll_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    document_type TEXT NOT NULL,
    document_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    
    -- Contract Details
    salary DECIMAL NOT NULL,
    contract_type TEXT NOT NULL DEFAULT 'termino_fijo', -- termino_fijo, termino_indefinido, obra_labor, aprendizaje
    employment_date DATE NOT NULL,
    end_date DATE,
    
    -- Payroll & Taxes (DIAN specific fields)
    worker_type_id INTEGER DEFAULT 1, -- 1=Dependiente, etc.
    sub_worker_type_id INTEGER DEFAULT 0, -- 0=No aplica
    high_risk_pension BOOLEAN DEFAULT FALSE,
    integral_salary BOOLEAN DEFAULT FALSE,
    bank_name TEXT,
    bank_account_type TEXT,
    bank_account_number TEXT,
    
    branch_id BIGINT REFERENCES public.branches(id)
);

CREATE TABLE IF NOT EXISTS public.payroll_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    employee_id UUID REFERENCES public.payroll_employees(id) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Totals
    accrued_total DECIMAL NOT NULL DEFAULT 0,
    deductions_total DECIMAL NOT NULL DEFAULT 0,
    net_total DECIMAL NOT NULL DEFAULT 0,
    
    -- Factus DIAN Tracing
    factus_id TEXT,
    factus_doc_number TEXT,
    factus_status TEXT DEFAULT 'draft', -- draft, signed, rejected
    pdf_url TEXT,
    
    payment_date DATE
);

CREATE TABLE IF NOT EXISTS public.payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.payroll_documents(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- ACCRUED (Devengo) or DEDUCTION (Deduccion)
    category TEXT NOT NULL, -- e.g., 'salary', 'transport', 'health', 'pension'
    amount DECIMAL NOT NULL,
    description TEXT
);
