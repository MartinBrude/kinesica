<?php
declare(strict_types=1);

function get_initial_seed_interactions(): array
{
    return [
        [
            'id' => 'exec_1836',
            'wa_id' => '5491169289637',
            'phone_formatted' => '+54 9 11 6928-9637',
            'patient_name' => 'Olivia Di Carlo',
            'date' => '2026-10-27',
            'time' => '16:25',
            'timestamp' => '2026-10-27T19:25:44Z',
            'category' => 'cobertura_aranceles',
            'category_label' => '💳 Cobertura / OSDE & Honorarios ATM',
            'summary' => 'Derivación odontología, consulta si atienden por OSDE y arancel de ATM.',
            'messages' => [
                ['from' => 'patient', 'time' => '16:24', 'text' => "Buenas tardes, para solicitar un turno por derivacion de odontologia quisiera saber si atienden por Osde o como es su atencion. Mi nombre es Olivia Di Carlo. Aguardo respuesta, muchas gracias."],
                ['from' => 'clara', 'time' => '16:24', 'text' => "¡Hola! Te damos la bienvenida a *Kinésica* 🩺\n\nPor favor, respondé con la letra de la opción que necesitás:\n*A.* 📅 Turnos\n*B.* 📍 Ubicación\n*C.* 💳 Honorarios y cobertura (obras sociales / reintegros)\n*D.* 👕 Vestimenta\n*E.* 💬 Comunicarte con un profesional\n*F.* 🌐 English"],
                ['from' => 'patient', 'time' => '16:25', 'text' => "Como"],
                ['from' => 'clara', 'time' => '16:25', 'text' => "¡Hola! Te damos la bienvenida a *Kinésica* 🩺\n\nPor favor, respondé con la letra de la opción que necesitás:\n*A.* 📅 Turnos\n*B.* 📍 Ubicación\n*C.* 💳 Honorarios y cobertura (obras sociales / reintegros)..."],
                ['from' => 'patient', 'time' => '16:25', 'text' => "C"],
                ['from' => 'clara', 'time' => '16:25', 'text' => "💳 *Honorarios y Cobertura*\n• *Honorarios:* $65.000 para ATM (bruxismo / dolor mandibular) y $75.000 para el resto de las consultas (kinesiología general, osteopatía, RPG, etc.). Las sesiones son individuales y de 60 minutos.\n• *Medios de pago:* Se puede abonar en efectivo o transferencia bancaria.\n• *Cobertura:* Atendemos de forma particular. Al finalizar tu sesión te entregamos la factura oficial para que puedas presentarla en tu prepaga u obra social y solicitar el reintegro correspondiente según tu plan 📄."]
            ]
        ],
        [
            'id' => 'exec_1826',
            'wa_id' => '5491159783603',
            'phone_formatted' => '+54 9 11 5978-3603',
            'patient_name' => '',
            'date' => '2026-10-27',
            'time' => '14:35',
            'timestamp' => '2026-10-27T17:35:32Z',
            'category' => 'aranceles',
            'category_label' => '💰 Honorarios y Consulta de Turnos',
            'summary' => 'Consultó por turnos agendados y luego preguntó precios y cobertura.',
            'messages' => [
                ['from' => 'patient', 'time' => '14:23', 'text' => "hola buenas"],
                ['from' => 'clara', 'time' => '14:23', 'text' => "¡Hola! Te damos la bienvenida a *Kinésica* 🩺 (Opciones A-F)"],
                ['from' => 'patient', 'time' => '14:24', 'text' => "a"],
                ['from' => 'clara', 'time' => '14:24', 'text' => "📅 *Gestión de Turnos - Kinésica*\n\nPor favor elegí una opción respondiendo *1* o *2*:\n*1.* 📅 Agendar un nuevo turno\n*2.* 🔍 Consultar o cancelar mis turnos agendados"],
                ['from' => 'patient', 'time' => '14:24', 'text' => "2"],
                ['from' => 'clara', 'time' => '14:24', 'text' => "Con este número de WhatsApp no encontramos turnos agendados. Si agendaste con otro teléfono, respondé directamente con tu DNI o comunicate con el consultorio."],
                ['from' => 'patient', 'time' => '14:35', 'text' => "no tengo turnos agendados disculpa quería saber el precio"],
                ['from' => 'clara', 'time' => '14:35', 'text' => "¡Hola! Te damos la bienvenida a *Kinésica* 🩺 (Menú principal)"],
                ['from' => 'patient', 'time' => '14:35', 'text' => "c"],
                ['from' => 'clara', 'time' => '14:35', 'text' => "💳 *Honorarios y Cobertura*\n• *Honorarios:* $65.000 para ATM y $75.000 para kinesiología general. Particulares con factura para reintegro."]
            ]
        ],
        [
            'id' => 'exec_1807',
            'wa_id' => '5491168816000',
            'phone_formatted' => '+54 9 11 6881-6000',
            'patient_name' => '',
            'date' => '2026-10-27',
            'time' => '10:19',
            'timestamp' => '2026-10-27T13:19:47Z',
            'category' => 'cobertura_obrasocial',
            'category_label' => '🏛️ Cobertura Poder Judicial / OSDE',
            'summary' => 'Preguntó si atienden por Obra Social del Poder Judicial o por OSDE.',
            'messages' => [
                ['from' => 'patient', 'time' => '10:17', 'text' => "Hola !!!\nAtienden por Obra Social del Poder Judicial o por OSDE?"],
                ['from' => 'clara', 'time' => '10:17', 'text' => "¡Hola! Te damos la bienvenida a *Kinésica* 🩺 (Menú A-F)"],
                ['from' => 'patient', 'time' => '10:18', 'text' => "C"],
                ['from' => 'clara', 'time' => '10:18', 'text' => "💳 *Honorarios y Cobertura*\n• *Honorarios:* $65.000 para ATM / $75.000 resto.\n• *Cobertura:* Atendemos de forma particular. Al finalizar tu sesión te entregamos la factura oficial para solicitar el reintegro correspondiente según tu plan 📄."],
                ['from' => 'patient', 'time' => '10:19', 'text' => "Graciassss"]
            ]
        ],
        [
            'id' => 'exec_1790',
            'wa_id' => '34658444935',
            'phone_formatted' => '+34 658 44 49 35',
            'patient_name' => 'Prueba Administración (España)',
            'date' => '2026-10-27',
            'time' => '06:26',
            'timestamp' => '2026-10-27T09:26:28Z',
            'category' => 'prueba_admin',
            'category_label' => '🧪 Prueba Admin / Bilingüe',
            'summary' => 'Prueba de saludo internacional en inglés, cambio a español, comando de reset y opción E (Profesionales).',
            'messages' => [
                ['from' => 'patient', 'time' => '06:25', 'text' => "hola"],
                ['from' => 'clara', 'time' => '06:25', 'text' => "Hello! Welcome to *Kinésica* 🩺 (English menu)"],
                ['from' => 'patient', 'time' => '06:25', 'text' => "Español"],
                ['from' => 'clara', 'time' => '06:25', 'text' => "¡Hola! Te damos la bienvenida a *Kinésica* 🩺"],
                ['from' => 'patient', 'time' => '06:25', 'text' => "Hola Clara, buenos días"],
                ['from' => 'clara', 'time' => '06:25', 'text' => "🔄 Memoria reiniciada desde cero."],
                ['from' => 'patient', 'time' => '06:26', 'text' => "E"],
                ['from' => 'clara', 'time' => '06:26', 'text' => "💬 *Contacto con un Profesional*\n1. Norberto Brude\n2. María Gulin\n3. Indistinto"],
                ['from' => 'patient', 'time' => '06:26', 'text' => "3"],
                ['from' => 'clara', 'time' => '06:26', 'text' => "¡Perfecto! Ya le transmitimos tu consulta a nuestro equipo de kinesiólogos."]
            ]
        ],
        [
            'id' => 'exec_1769',
            'wa_id' => '5492236807252',
            'phone_formatted' => '+54 9 223 680-7252',
            'patient_name' => 'Prueba Menú y Derivación',
            'date' => '2026-10-26',
            'time' => '20:34',
            'timestamp' => '2026-10-26T23:34:50Z',
            'category' => 'prueba_admin',
            'category_label' => '🧪 Prueba Derivación',
            'summary' => 'Prueba de navegación del menú y derivación de consulta a profesionales (Opción E → 3).',
            'messages' => [
                ['from' => 'patient', 'time' => '20:32', 'text' => "Menú"],
                ['from' => 'patient', 'time' => '20:32', 'text' => "E"],
                ['from' => 'patient', 'time' => '20:32', 'text' => "3"],
                ['from' => 'clara', 'time' => '20:32', 'text' => "¡Perfecto! Ya le transmitimos tu consulta a nuestro equipo de kinesiólogos. Te estarán contactando a la brevedad."]
            ]
        ]
    ];
}
