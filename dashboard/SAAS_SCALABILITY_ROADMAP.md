# Roadmap de Escalabilidad SaaS

Para transformar este sistema en un producto SaaS (Software as a Service) vendible a múltiples clientes (Restaurantes, Hoteles), es necesario implementar los siguientes cambios estructurales:

## 1. Arquitectura Multi-Tenant (Aislamiento de Datos)
Actualmente, el sistema asume un solo dueño con múltiples sedes (`branches`). Para venderlo, necesitamos un nivel superior: **La Organización**.

### Cambios en Base de Datos:
1.  **Nueva tabla `organizations` (o `companies`):**
    *   `id` (UUID)
    *   `name` (Nombre del Negocio)
    *   `plan` (Free, Pro, Enterprise)
    *   `status` (Active, Suspended)
2.  **Migración de Tablas Existentes:**
    *   Añadir columna `organization_id` a TODAS las tablas críticas: `profiles`, `branches`, `products`, `orders`, `rooms`, `bookings`, etc.
3.  **Seguridad (RLS - Row Level Security):**
    *   Actualizar las políticas RLS para que *siempre* filtren por `organization_id`.
    *   Ejemplo: `create policy "Tenant Isolation" on products using (organization_id = auth.jwt() ->> 'org_id')`.

## 2. Autenticación y Onboarding Real
El método actual de creación de usuarios (`generateUUID`) crea perfiles "fantasma" que no pueden iniciar sesión.

### Solución Recomendada:
1.  **Edge Functions para Gestión de Usuarios:**
    *   Crear una función `create-user` en Supabase Functions.
    *   Al llamar "Registrar Personal" en el panel, esta función usa la API Admin de Supabase para crear el usuario real en `auth.users`, enviarle un email de invitación o contraseña temporal.
2.  **Flujo de Registro (Self-Service):**
    *   Página de Landing donde el dueño del restaurante se registra (`Sign Up`).
    *   Esto crea automáticamente su `organization` y lo hace `superadmin`.

## 3. Sistema de Roles y Permisos (RBAC) Escalable
Los roles actuales están "harcodeados" (`admin`, `gerente`). Un SaaS necesita roles dinámicos o más granulares.

### Mejoras:
*   Tabla `roles` y `role_permissions` para que cada empresa pueda definir "Encargado de Cocina" con permisos específicos, sin depender del código.

## 4. Facturación y Límites
Si vas a venderlo, necesitas cobrar.
*   Integración con Stripe/Wompi para suscripciones.
*   Límites por plan (Ej: Plan Free = Max 1 Sede, 5 Empleados).

---

# Acciones Inmediatas (Realizadas hoy)
Se ha creado un script de migración inicial `migration_saas_init.sql` que prepara la estructura básica para Multi-Tenancy sin romper la funcionalidad actual.
