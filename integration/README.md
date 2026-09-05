# Integración con la base biométrica institucional

Esta versión no contiene simulador. El objetivo es leer registros reales desde la base o software del lector y transferirlos al backend del sistema.

## Arquitectura

```text
Lector institucional
        ↓
Base de datos o software del fabricante
        ↓
Servicio de sincronización autorizado
        ↓
POST /api/attendance/biometric
        ↓
Sistema de asistencia + Socket.IO
```

## Endpoint receptor

```text
POST http://SERVIDOR:3000/api/attendance/biometric
```

Encabezados:

```text
Content-Type: application/json
x-device-key: <DEVICE_SHARED_KEY>
```

Cuerpo esperado:

```json
{
  "eventId": "ID-UNICO-DEL-REGISTRO",
  "deviceId": "LECTOR-ENTRADA-01",
  "biometricId": "1001",
  "eventType": "ENTRY",
  "dateTime": "2026-06-18T13:47:00-06:00",
  "method": "FINGERPRINT"
}
```

## Mapeo requerido

| Campo del sistema | Campo de la base institucional |
|---|---|
| `eventId` | ID único de la marcación |
| `biometricId` | ID de usuario/empleado del lector |
| `dateTime` | Fecha y hora de marcación |
| `eventType` | Entrada o salida |
| `deviceId` | Identificador del lector |

El campo `teachers.biometric_id` debe coincidir con el identificador guardado por el lector.

## Seguridad

- Utilizar un usuario de base de datos de solo lectura.
- No modificar las tablas del fabricante.
- Guardar credenciales únicamente en `.env`.
- Evitar procesar dos veces el mismo `eventId`.
- Usar HTTPS y claves individuales en producción.

Cuando se conozca el motor y la estructura real de la base, debe implementarse el adaptador específico de sincronización.
