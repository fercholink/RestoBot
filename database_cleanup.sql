-- ============================================================
--   RESTOBOT — SCRIPT DE LIMPIEZA DE BASE DE DATOS
--   Proyecto: BS Comunicaciones / Hotel & Restaurante
--   Fecha: 2026-02-23
--   
--   ⚠️  EJECUTAR EN SUPABASE → SQL EDITOR
--   ⚠️  LEE BIEN CADA OPCIÓN ANTES DE EJECUTAR
-- ============================================================


-- ============================================================
-- 📌 OPCIÓN 1 — LIMPIEZA OPERATIVA (MÁS SEGURA ✅)
-- Borra solo datos transaccionales del día/turno actual
-- CONSERVA: usuarios, productos, menú, mesas, habitaciones,
--            roles, sedes, configuración del sistema
-- BORRA: pedidos, items, turnos, cargos a habitación,
--        asientos contables
-- ============================================================

-- Descomenta el bloque que necesites y ejecútalo

/*
-- 1A. Solo pedidos y turnos (más común para resetear el día)
TRUNCATE TABLE
    room_charges,
    order_items,
    orders,
    shifts
RESTART IDENTITY CASCADE;
*/


-- ============================================================
-- 📌 OPCIÓN 2 — LIMPIEZA DE RESERVAS HOTEL
-- Borra solo datos de reservas y cargos de habitación
-- CONSERVA: habitaciones, clientes, configuración
-- BORRA: reservas, cargos, channel_bookings
-- ============================================================

/*
TRUNCATE TABLE
    room_charges,
    channel_bookings,
    bookings
RESTART IDENTITY CASCADE;
*/


-- ============================================================
-- 📌 OPCIÓN 3 — LIMPIEZA CONTABLE
-- Borra solo asientos, entradas y apuntes contables
-- CONSERVA: plan de cuentas (accounts)
-- BORRA: journal_entries, journal_lines, expenses, payroll
-- ============================================================

/*
TRUNCATE TABLE
    payroll,
    expenses,
    journal_lines,
    journal_entries
RESTART IDENTITY CASCADE;
*/


-- ============================================================
-- 📌 OPCIÓN 4 — RESET COMPLETO (⚠️ PELIGROSO — SOLO DEV/TEST)
-- Borra TODO excepto usuarios y perfiles de auth
-- CONSERVA: profiles, branches (sedes), roles
-- BORRA: pedidos, reservas, contabilidad, productos, turnos
-- ============================================================

/*
TRUNCATE TABLE
    room_charges,
    channel_bookings,
    bookings,
    payroll,
    expenses,
    journal_lines,
    journal_entries,
    order_items,
    orders,
    shifts,
    products,
    rooms,
    customers
RESTART IDENTITY CASCADE;
*/


-- ============================================================
-- 📌 OPCIÓN 5 — RESET TOTAL (☠️ EXTREMO — PUNTO DE NO RETORNO)
-- Borra absolutamente todo, incluyendo usuarios y configuración
-- Útil solo para reiniciar el proyecto desde cero
-- Después deberás volver a crear usuarios, sedes y menú
-- ============================================================

/*
TRUNCATE TABLE
    room_charges,
    channel_bookings,
    bookings,
    payroll,
    expenses,
    journal_lines,
    journal_entries,  
    order_items,
    orders,
    shifts,
    products,
    rooms,
    customers,
    profiles,
    branches,
    roles
RESTART IDENTITY CASCADE;
*/


-- ============================================================
-- 📊 CONSULTAS DE VERIFICACIÓN (para ver cuántos datos hay)
-- Ejecuta esto ANTES para saber qué vas a borrar
-- ============================================================

SELECT 'orders'           AS tabla, COUNT(*) AS registros FROM orders
UNION ALL
SELECT 'order_items'      AS tabla, COUNT(*) AS registros FROM order_items
UNION ALL
SELECT 'shifts'           AS tabla, COUNT(*) AS registros FROM shifts
UNION ALL
SELECT 'bookings'         AS tabla, COUNT(*) AS registros FROM bookings
UNION ALL
SELECT 'room_charges'     AS tabla, COUNT(*) AS registros FROM room_charges
UNION ALL
SELECT 'products'         AS tabla, COUNT(*) AS registros FROM products
UNION ALL
SELECT 'rooms'            AS tabla, COUNT(*) AS registros FROM rooms
UNION ALL
SELECT 'profiles'         AS tabla, COUNT(*) AS registros FROM profiles
UNION ALL
SELECT 'branches'         AS tabla, COUNT(*) AS registros FROM branches
UNION ALL
SELECT 'customers'        AS tabla, COUNT(*) AS registros FROM customers
UNION ALL
SELECT 'journal_entries'  AS tabla, COUNT(*) AS registros FROM journal_entries
ORDER BY registros DESC;
