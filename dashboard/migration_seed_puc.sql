-- =================================================================
-- SEMILLA: PLAN ÚNICO DE CUENTAS (PUC) COMERCIAL ESTÁNDAR
-- Descripción: Carga inicial de cuentas para el funcionamiento base.
-- =================================================================

INSERT INTO public.accounting_accounts (code, name, nature, is_movement) VALUES
-- CLASE 1: ACTIVO
('1', 'ACTIVO', 'debit', false),
('11', 'DISPONIBLE', 'debit', false),
('1105', 'CAJA', 'debit', false),
('110505', 'CAJA GENERAL', 'debit', true),
('110510', 'CAJAS MENORES', 'debit', true),
('1110', 'BANCOS', 'debit', false),
('111005', 'MONEDA NACIONAL', 'debit', true),
('1120', 'CUENTAS DE AHORRO', 'debit', false),
('112005', 'BANCOS Y CORPORACIONES', 'debit', true),

('13', 'DEUDORES', 'debit', false),
('1305', 'CLIENTES', 'debit', false),
('130505', 'NACIONALES', 'debit', true),
('1355', 'ANTICIPO DE IMPUESTOS', 'debit', false),
('135515', 'RETENCIÓN EN LA FUENTE', 'debit', true),
('135517', 'IMPUESTO A LAS VENTAS RETENIDO', 'debit', true),
('135518', 'IMPUESTO DE INDUSTRIA Y COMERCIO RETENIDO', 'debit', true),

('14', 'INVENTARIOS', 'debit', false),
('1435', 'MERCANCÍAS NO FABRICADAS POR LA EMPRESA', 'debit', true),
('1445', 'ENVASES Y EMPAQUES', 'debit', true),

('15', 'PROPIEDAD PLANTA Y EQUIPO', 'debit', false),
('1524', 'EQUIPO DE OFICINA', 'debit', true),
('1528', 'EQUIPO DE COMPUTACIÓN Y COMUNICACIÓN', 'debit', true),
('1540', 'FLOTA Y EQUIPO DE TRANSPORTE', 'debit', true),

-- CLASE 2: PASIVO
('2', 'PASIVO', 'credit', false),
('21', 'OBLIGACIONES FINANCIERAS', 'credit', false),
('2105', 'BANCOS NACIONALES', 'credit', true),

('22', 'PROVEEDORES', 'credit', false),
('2205', 'NACIONALES', 'credit', true),

('23', 'CUENTAS POR PAGAR', 'credit', false),
('2335', 'COSTOS Y GASTOS POR PAGAR', 'credit', true),
('2365', 'RETENCIÓN EN LA FUENTE', 'credit', false),
('236505', 'SALARIOS Y PAGOS LABORALES', 'credit', true),
('236515', 'HONORARIOS', 'credit', true),
('236525', 'SERVICIOS', 'credit', true),
('236540', 'COMPRAS', 'credit', true),
('2367', 'IMPUESTO A LAS VENTAS RETENIDO', 'credit', true),
('2368', 'IMPUESTO DE INDUSTRIA Y COMERCIO RETENIDO', 'credit', true),

('24', 'IMPUESTOS, GRAVAMENES Y TASAS', 'credit', false),
('2408', 'IMPUESTO SOBRE LAS VENTAS POR PAGAR (IVA)', 'credit', false),
('240801', 'IVA GENERADO EN VENTAS', 'credit', true),
('240802', 'IVA DESCONTABLE COMPRAS', 'debit', true), -- Ojo: naturaleza debito para descontar

('25', 'OBLIGACIONES LABORALES', 'credit', false),
('2505', 'SALARIOS POR PAGAR', 'credit', true),
('2510', 'CESANTÍAS CONSOLIDADAS', 'credit', true),
('2515', 'INTERESES SOBRE CESANTÍAS', 'credit', true),
('2520', 'PRIMA DE SERVICIOS', 'credit', true),
('2525', 'VACACIONES CONSOLIDADAS', 'credit', true),

-- CLASE 3: PATRIMONIO
('3', 'PATRIMONIO', 'credit', false),
('31', 'CAPITAL SOCIAL', 'credit', false),
('3115', 'APORTES SOCIALES', 'credit', true),
('36', 'RESULTADOS DEL EJERCICIO', 'credit', false),
('3605', 'UTILIDAD DEL EJERCICIO', 'credit', true),
('3610', 'PÉRDIDA DEL EJERCICIO', 'debit', true),

-- CLASE 4: INGRESOS
('4', 'INGRESOS', 'credit', false),
('41', 'OPERACIONALES', 'credit', false),
('4135', 'COMERCIO AL POR MAYOR Y AL POR MENOR', 'credit', true),
('4145', 'TRANSPORTE, ALMACENAMIENTO Y COMUNICACIONES', 'credit', true),
('4155', 'ACTIVIDADES INMOBILIARIAS', 'credit', true),
('4175', 'SERVICIOS SOCIALES Y DE SALUD', 'credit', true), -- Para consultas médicas
('42', 'NO OPERACIONALES', 'credit', false),
('4210', 'FINANCIEROS', 'credit', true),

-- CLASE 5: GASTOS
('5', 'GASTOS', 'debit', false),
('51', 'OPERACIONALES DE ADMINISTRACIÓN', 'debit', false),
('5105', 'GASTOS DE PERSONAL', 'debit', false),
('510506', 'SUELDOS', 'debit', true),
('510515', 'HORAS EXTRAS Y RECARGOS', 'debit', true),
('510527', 'AUXILIO DE TRANSPORTE', 'debit', true),
('5110', 'HONORARIOS', 'debit', true),
('5115', 'IMPUESTOS', 'debit', true),
('5120', 'ARRENDAMIENTOS', 'debit', true),
('5135', 'SERVICIOS', 'debit', true),
('5145', 'MANTENIMIENTO Y REPARACIONES', 'debit', true),
('5150', 'ADECUACIÓN E INSTALACIÓN', 'debit', true),
('5195', 'DIVERSOS', 'debit', true),

('52', 'OPERACIONALES DE VENTAS', 'debit', false),
('5205', 'GASTOS DE PERSONAL VENTAS', 'debit', true),
('5235', 'SERVICIOS VENTAS', 'debit', true),

('53', 'NO OPERACIONALES', 'debit', false),
('5305', 'FINANCIEROS', 'debit', true),

-- CLASE 6: COSTOS DE VENTAS
('6', 'COSTOS DE VENTAS', 'debit', false),
('61', 'COSTO DE VENTAS Y DE PRESTACIÓN DE SERVICIOS', 'debit', false),
('6135', 'COMERCIO AL POR MAYOR Y AL POR MENOR', 'debit', true),
('6145', 'TRANSPORTE, ALMACENAMIENTO Y COMUNICACIONES', 'debit', true),
('6155', 'ACTIVIDADES INMOBILIARIAS', 'debit', true),
('6175', 'SERVICIOS DE SALUD', 'debit', true)

ON CONFLICT (code) DO NOTHING;
