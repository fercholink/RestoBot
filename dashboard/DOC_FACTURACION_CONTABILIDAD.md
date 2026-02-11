# Documentación de Facturación y Contabilidad - RestoBot

## 1. Visión General
Este módulo gestiona la facturación legal y el control contable multi-sede para operaciones de Hotelería y Restaurante, cumpliendo con los requisitos de la DIAN (Colombia) para documentos equivalentes POS y Facturación Electrónica.

## 2. Estructura de Datos Actualizada

### 2.1 Sucursales (`branches`)
Cada sede operativa tiene su propia configuración fiscal independiente.
- **Nit**: Identificación tributaria.
- **Resolución DIAN**: Número de autorización de facturación.
- **Prefijo**: Ej. `POS-N` (Norte), `POS-S` (Sur).
- **Rango**: Del 1 al 10000.
- **Fecha Resolución**: Vigencia.

### 2.2 Perfiles de Usuario (`profiles`)
El personal está vinculado a una sede específica (`branch_id`). Esto asegura que cada venta generada quede registrada en la contabilidad de la sede correcta.

### 2.3 Pedidos y Ventas (`orders`)
Cada pedido almacena:
- `branch_id`: Sede emisora.
- `shift_id`: Turno de caja responsable.
- `user_id`: Cajero/Mesero responsable.
- `payment_method`: Trazabilidad del dinero (Efectivo vs Bancos).

## 3. Flujo de Facturación (POS)

1. **Apertura de Caja**:
   - El cajero inicia turno en su sede asignada.
   - Se valida que la resolución de facturación esté vigente (Próxima mejora).

2. **Generación de Pedido**:
   - Al confirmar el pago, el sistema asigna el pedido a la sede del usuario.
   - **Pendiente**: Implementar generación de consecutivo fiscal (Ej. POS-N-1025) separado del ID interno del pedido.

3. **Impresión de Tirilla**:
   - El componente `TicketPrinter` lee dinámicamente los datos de la sede (`order.branch`) para imprimir el encabezado legal correcto (NIT, Dirección, Resolución).

## 4. Arquitectura para Contabilidad

### 4.1 Cierres de Caja (Z)
El módulo `ShiftManagement` ya agrupa los pedidos por `shift_id`. Para contabilidad:
- Se deben sumarizar los totales por `payment_method`.
- Se debe discriminar el IVA e Impoconsumo (basado en `tax_data` de los productos).

### 4.2 Integración Electrónica (Futuro)
Para emitir Factura Electrónica:
1. Se tomarán los datos del cliente (`customer_name`, `customer_document`, `email`).
2. Se enviará el JSON del pedido a un proveedor tecnológico (Ej. Factus, Siigo) mediante API.
3. El proveedor retornará el CUFE y el QR, que se guardarán en la tabla `orders` (columnas `electronic_invoice_cufe`, `electronic_invoice_qr`).

## 5. Recomendaciones de Implementación Inmediata

1. **Consecutivos Fiscales**:
   - Crear una función en base de datos `next_invoice_number(branch_id)` que incremente el contador según el prefijo de la sede.
   - No usar el `orders.id` como número de factura, ya que es global y no cumple con la secuencia por resolución.

2. **Reportes Contables**:
   - Crear vista `daily_sales_report` que agrupe ventas por: Sede > Fecha > Medio de Pago.
   - Exportar a Excel/CSV para el contador.

3. **Retenciones e Impuestos**:
   - Asegurar que cada producto tenga su `tax_rate` (IVA 19%, IPO 8%, Exento).
   - Discriminar estos valores en el ticket final.

---
**Estado Actual**: La infraestructura base (Tablas, Relaciones y UI de Gestión) ha sido implementada. El siguiente paso técnico es activar el trigger de consecutivos fiscales.
