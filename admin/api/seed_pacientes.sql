-- Datos Iniciales de Pacientes y Contactos - Kinésica
-- Para importar en MySQL (Hostinger)

INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, motivo_consulta, origen)
VALUES
('5491144556677', 'Mariana', 'González Cadahia', 'Mariana González Cadahia', 'Mariana', NULL, 'indistinto', 'Reeducación Postural Global (RPG) / Columna', 'whatsapp'),
('5491155667788', 'Constancia', 'Tiboni', 'Constancia Tiboni', 'Constancia', NULL, 'indistinto', 'Evaluación postural y dolor cervical', 'whatsapp'),
('5491133445566', 'Alejandro', 'Wainschenker', 'Alejandro Wainschenker', 'Alejandro', NULL, 'indistinto', 'Rehabilitación motora', 'whatsapp'),
('5491177889900', 'Graciela', 'Sribman', 'Graciela Sribman', 'Graciela', NULL, 'indistinto', 'RPG y terapias manuales', 'whatsapp'),
('5491122334455', 'Aarón', 'Coello', 'Aarón Coello', 'Aarón', NULL, 'norberto', 'Dolor de espalda / Traumatología', 'whatsapp'),
('5491166778899', 'Belen', 'Orbe', 'Belen Orbe', 'Belen', NULL, 'indistinto', 'Reeducación postural', 'whatsapp'),
('5491188990011', 'Nélida', 'Di Rienzo', 'Nélida Di Rienzo', 'Nélida', NULL, 'indistinto', 'Dolor articular y movilidad', 'whatsapp'),
('5491111223344', 'Leonor', 'Koszkin', 'Leonor Koszkin', 'Leonor', NULL, 'indistinto', 'Cervicalgia y tensión escapular', 'whatsapp'),
('5491199001122', 'Viviana', 'Dalamon', 'Viviana Dalamon', 'Viviana', NULL, 'maria', 'Rehabilitación de hombro', 'whatsapp'),
('5491133221100', 'Sofía', 'Finocchio Gonzalez', 'Sofía Finocchio Gonzalez', 'Sofía', NULL, 'norberto', 'ATM y contractura cervical', 'whatsapp'),
('5491188776655', 'Lucas', 'Méndez', 'Lucas Méndez', 'Lucas', '38123456', 'norberto', 'Lumbalgia aguda y postura', 'whatsapp')
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre),
    apellido = VALUES(apellido),
    nombre_completo = VALUES(nombre_completo),
    nombre_pila = VALUES(nombre_pila),
    motivo_consulta = VALUES(motivo_consulta);
