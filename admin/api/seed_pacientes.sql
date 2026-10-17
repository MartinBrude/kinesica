-- Datos Iniciales de Pacientes y Contactos - Kinésica
-- Para importar en MySQL (Hostinger)

INSERT INTO pacientes (telefono, nombre_completo, nombre_pila, dni, profesional_habitual, motivo_consulta, fecha_primera_sesion, total_sesiones, origen)
VALUES
('5491144556677', 'Mariana González Cadahia', 'Mariana', NULL, 'indistinto', 'Reeducación Postural Global (RPG) / Columna', '2026-09-30 10:00', 3, 'whatsapp'),
('5491155667788', 'Constancia Tiboni', 'Constancia', NULL, 'indistinto', 'Evaluación postural y dolor cervical', '2026-09-29 16:00', 2, 'whatsapp'),
('5491133445566', 'Alejandro Wainschenker', 'Alejandro', NULL, 'indistinto', 'Rehabilitación motora', '2026-09-29 18:00', 1, 'whatsapp'),
('5491177889900', 'Graciela Sribman', 'Graciela', NULL, 'indistinto', 'RPG y terapias manuales', '2026-10-02 13:00', 2, 'whatsapp'),
('5491122334455', 'Aarón Coello', 'Aarón', NULL, 'norberto', 'Dolor de espalda / Traumatología', '2026-09-30 11:00', 1, 'whatsapp'),
('5491166778899', 'Belen Orbe', 'Belen', NULL, 'indistinto', 'Reeducación postural', '2026-10-01 18:00', 1, 'whatsapp'),
('5491188990011', 'Nélida Di Rienzo', 'Nélida', NULL, 'indistinto', 'Dolor articular y movilidad', '2026-10-01 15:00', 2, 'whatsapp'),
('5491111223344', 'Leonor Koszkin', 'Leonor', NULL, 'indistinto', 'Cervicalgia y tensión escapular', '2026-09-30 12:00', 1, 'whatsapp'),
('5491199001122', 'Viviana Dalamon', 'Viviana', NULL, 'maria', 'Rehabilitación de hombro', '2026-10-02 09:00', 2, 'whatsapp'),
('5491133221100', 'Sofía Finocchio Gonzalez', 'Sofía', NULL, 'norberto', 'ATM y contractura cervical', '2026-09-30 08:45', 2, 'whatsapp')
ON DUPLICATE KEY UPDATE
    nombre_completo = VALUES(nombre_completo),
    nombre_pila = VALUES(nombre_pila),
    motivo_consulta = VALUES(motivo_consulta);
