# Arquitectura Contable y Fiscal (Normativa DIAN Colombia) - RestoBot

Este documento detalla los módulos y especificaciones técnicas necesarias para que el sistema RestoBot cumpla con las normativas fiscales y contables de la Dirección de Impuestos y Aduanas Nacionales (DIAN) en Colombia.

## 1. Módulo de Facturación y Documentos Fiscales
*Objetivo: Emisión y transmisión electrónica de comprobantes de venta.*

* **Documento Equivalente Electrónico (POS Electrónico):**
  * Emisión de tiquetes de caja con generación de código QR y CUDE (Código Único de Documento Equivalente).
  * Reporte electrónico obligatorio a la DIAN de todas las transacciones POS.
* **Facturación Electrónica de Venta (FEV):**
  * Emisión de XML bajo el estándar UBL 2.1.
  * Transmisión en tiempo real al proveedor tecnológico (ej. Factus, Siigo) para validación previa de la DIAN.
  * Recepción y almacenamiento de CUFE (Código Único de Facturación Electrónica).
* **Notas Crédito y Débito Electrónicas:**
  * Emisión de notas para ajustes, descuentos o anulaciones (devoluciones), enlazadas obligatoriamente al CUFE/CUDE del documento original.

## 2. Módulo de Gestión de Resoluciones (Consecutivos)
*Objetivo: Control estricto de la numeración autorizada por la DIAN para cada sucursal (`branch`).*

* **Control de Vigencia y Rangos:**
  * Almacenamiento de múltiples resoluciones por sede (Prefijo, Número de Resolución, Fecha de Inicio, Fecha de Fin, Rango Inicial, Rango Final).
  * Alertas en el sistema por vencimiento de fecha o proximidad al límite superior del rango de numeración.
* **Asignación Transaccional:**
  * Generación automática del consecutivo fiscal (Ej: `POS-N-1025`) al confirmar la venta en caja, separado del ID interno del pedido en la base de datos.
  * Garantizar la secuencialidad sin saltos, validando por transacción atómica.

## 3. Módulo de Impuestos y Retenciones
*Objetivo: Correcta liquidación y discriminación de cargas tributarias.*

* **Configuración de Tarifas (Catálogo de Productos):**
  * **IVA (Impuesto sobre las Ventas):** Exento (0%), Gravado (5%, 19%).
  * **INC (Impuesto Nacional al Consumo):** Gravado (8%) aplicable a alimentos y bebidas (Restaurante).
* **Discriminación en Tiquetes y Reportes:**
  * Los tiquetes (PDF/Tirilla) deben mostrar claramente la base gravable y el valor total de cada impuesto cobrado.
  * Las **propinas** deben registrarse como un valor no constitutivo de ingreso ni base gravable para impuestos.
* **Retenciones en la Fuente (RTEFTE, RTEICA, RTEIVA):**
  * Posibilidad de aplicar retenciones en las ventas a clientes catalogados como Grandes Contribuyentes o Autorretenedores.

## 4. Módulo de Tesorería, Cajas y Recaudos
*Objetivo: Control del efectivo y conciliación de medios de pago.*

* **Gestión de Turnos (`shifts`):**
  * Apertura y cierre de caja obligatorios por usuario/sede.
  * Registro de base inicial (sencillo) y arqueo final (conteo de billetes/monedas).
* **Trazabilidad de Medios de Pago:**
  * Registro detallado de cómo se recaudó el dinero: Efectivo, Tarjeta Crédito/Débito, Transferencias (Nequi, Daviplata, PSE), Pasarelas de pago, o Múltiples medios (Pago mixto).
  * Reporte "Z" diario (Cierre) desglosado por medio de pago y tipos de impuestos recaudados.

## 5. Módulo de Terceros (Clientes, Proveedores y Empleados)
*Objetivo: Identificación fiscal de los actores comerciales.*

* **Datos Fiscales Obligatorios:**
  * Tipo de Persona (Natural o Jurídica).
  * Tipo de Documento de Identidad (NIT, CC, CE, Pasaporte).
  * Responsabilidades Fiscales RUT (Régimen Común/Responsable de IVA, RST, Gran Contribuyente, Autorretenedor).
  * Correo electrónico válido (Obligatorio para recepción de FEV).

## 6. Módulo Central (Libro Diario y Plan de Cuentas PUC)
*Objetivo: Registrar todas las operaciones económicas usando partida doble.*

* **Catálogo de Cuentas (Integración NIIF/PUC):**
  * Uso de códigos estructurados (Clase, Grupo, Cuenta, Subcuenta) para Activos, Pasivos, Patrimonio, Ingresos y Gastos.
* **Comprobantes Contables:**
  * Diferenciación por tipos de comprobante: Ingreso, Egreso, Diario, Nómina.
  * Soporte adjunto (`attachment_url`) para auditorías.
* **Integración Automatizada (IA/n8n):**
  * Uso de funciones atómicas (`create_accounting_entry_v1`) para insertar asientos provenientes de fuentes externas (WhatsApp, Correo) de forma segura y validada.

## 7. Módulo de Compras y Documento Soporte
*Objetivo: Soportar deducciones de impuestos y gastos de la empresa.*

* **Documento Soporte a No Obligados Electrónico:**
  * Emisión electrónica a proveedores informales, campesinos o regímenes especiales que no están obligados a facturar. Transmisión a la DIAN.
* **Recepción de Facturas Electrónicas (RADIAN) (Fase Futura):**
  * Integración para dar "Acuse de Recibo", "Recibo del Bien o Servicio" y "Aceptación Expresa", requeridos para que el gasto sea deducible fiscalmente.

---

### Siguientes Pasos (Roadmap Técnico Sugerido)

1. **Fase 1: Preparación Interna POS y Resoluciones**
   - Implementar tabla `branch_resolutions` y función de Autoincremental para consecutivos.
   - Modificar la impresión de tickets para incluir resolución y desglose exacto de IVA/INC.
2. **Fase 2: Conexión Electrónica DIAN**
   - Integración API con Proveedor Tecnológico (PT) para enviar el JSON de las ventas y recuperar el CUFE.
3. **Fase 3: Contabilización Central**
   - Automatizar la generación de asientos contables (`accounting_entries`) al realizar los cierres de caja diarios (Z) y recepción de facturas de compra.
