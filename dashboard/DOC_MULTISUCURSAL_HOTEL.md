# Arquitectura de Módulo Hotelero Multi-Sucursal

Este documento detalla la lógica y cambios necesarios para implementar soporte multi-sucursal (sedes en distintas ciudades) y una estructura jerárquica de Pisos/Casas en el sistema de gestión hotelera.

## 1. Modelo de Datos (Base de Datos)

Para soportar múltiples sedes, introducimos una nueva entidad `branches` (sucursales) y relacionamos las entidades existentes (`rooms`, `floors`) a ella.

### Nueva Tabla: `branches`
Representa una sede física (Hotel en Bogotá, Hotel en Medellín, Casa Playera, etc.).
- `id`: PK (Identity)
- `name`: Nombre de la sede (ej. "Sede Centro", "Cabaña 1")
- `city`: Ciudad
- `address`: Dirección (Opcional)
- `phone`: Teléfono de contacto (Opcional)

### Modificaciones en `floors`
Cada piso pertenece a una sucursal específica.
- `branch_id`: FK a `branches`. (Nullable inicialmente para migración, luego Required).
- *Lógica*: Un "Piso 1" en la Sede A es distinto al "Piso 1" en la Sede B.

### Modificaciones en `rooms`
Cada habitación debe pertenecer a una sucursal.
- `branch_id`: FK a `branches`.
- *Relación*: `rooms` -> `branch_id`.
- *Validación*: La habitación debe estar en un `floor` que pertenezca a la misma `branch_id` (se controla por lógica de negocio/UI).

## 2. Lógica de Negocio y Flujo

### Selección de Sucursal (Contexto Global)
- Al iniciar la aplicación (o el módulo de hoteles), el usuario debe tener una "Sucursal Activa".
- Si solo existe una sucursal, se selecciona automáticamente.
- Si hay varias, se muestra un selector (Dropdown) en la cabecera.

### Gestión de Pisos/Casas
- Al crear un piso (en `FloorManagerModal`), este se asociará automáticamente a la `branch_id` activa.
- Esto permite que la Sede A tenga 10 pisos y la Sede B solo 2 pisos.

### Gestión de Habitaciones
- Al crear una habitación, se asigna a la `branch_id` activa.
- El selector de pisos solo mostrará los pisos pertenecientes a esa sucursal.

### Visualización y Reservas
- **Tablero**: Solo muestra habitaciones de la sucursal activa.
- **Calendario**: Filtra reservas basadas en las habitaciones de la sucursal activa.
- **Buscador**: Puede buscar huéspedes globalmente, pero la disponibilidad se verifica localmente por sucursal.

## 3. Plan de Implementación

1.  **Migración SQL**:
    - Crear tabla `branches`.
    - Insertar una "Sede Principal" por defecto.
    - Agregar columna `branch_id` a `floors` y `rooms`.
    - Actualizar todos los registros existentes para que pertenezcan a la "Sede Principal".
2.  **Backend/API (Supabase)**:
    - Las consultas en `HotelManagement.jsx` deben incluir `.eq('branch_id', currentBranchId)`.
3.  **Frontend**:
    - Componente `BranchSelector` para cambiar de sede.
    - Actualizar `RoomModal` y `FloorManagerModal` para usar `branch_id`.

## 4. Estructura Jerárquica "Casas" vs "Pisos"
El sistema tratará "Casas" y "Pisos" como una abstracción similar en la tabla `floors`, diferenciados por el nombre.
- Ejemplo Sede "Resort Campestre":
  - Floor 1 -> Nombre: "Cabaña El Lago"
  - Floor 2 -> Nombre: "Torre Principal - Piso 1"
Esto flexibiliza el uso sin complicar el esquema de base de datos.
