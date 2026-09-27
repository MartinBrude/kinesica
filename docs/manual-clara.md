# 🌿 Manual de Clara: La Asistente y Secretaria Virtual de Kinésica
### Guía práctica y operativa del consultorio

> **¿Qué es este documento?**  
> Una explicación simple y clara de cómo funciona **Clara**, cómo atiende a los pacientes que escriben al WhatsApp del consultorio, cómo se organiza con la agenda de Google Calendar y cómo los profesionales del equipo pueden pedirle cosas directamente desde su propio celular.  
> 
> 🔗 **Enlace permanente en GitHub:** [https://github.com/MartinBrude/kinesica/blob/main/docs/manual-clara.md](https://github.com/MartinBrude/kinesica/blob/main/docs/manual-clara.md)  
> 🧪 **Guía Oficial de Pruebas y Casos de Uso:** [Ver Guía de Pruebas](guia-pruebas.md) ([Enlace en GitHub](https://github.com/MartinBrude/kinesica/blob/main/docs/guia-pruebas.md))  
> *(Este enlace se actualiza automáticamente con cada mejora del sistema).*

---

## 👩‍💼 1. ¿Quién es Clara y cuál es su trabajo?

**Clara** es la secretaria de recepción virtual de **Kinésica** (Palermo, CABA). Está conectada al WhatsApp del consultorio las **24 horas del día, los 7 días de la semana**.

### Sus responsabilidades principales:
1. **Atender al instante:** Da una primera respuesta educada y profesional en segundos, evitando que los pacientes queden esperando o se vayan a otro consultorio.
2. **Entender texto y audios de voz:** Si un paciente prefiere mandar un mensaje de voz contando su dolencia en lugar de escribir, Clara escucha el audio de forma invisible, comprende el problema y le responde por escrito con total naturalidad.
3. **Coordinar la agenda:** Ofrece horarios disponibles de lunes a viernes y anota automáticamente los turnos y llamadas en el Google Calendar (`consultorio`).
4. **Cuidar el tiempo de los profesionales:** Filtra preguntas repetitivas (dónde queda, horarios, cómo se abona, reintegros) y solo le avisa a Norberto al celular cuando hay un turno nuevo, un cambio o una consulta médica puntual.

---

## 🩺 2. ¿Cómo habla y cómo atiende a los pacientes?

Clara fue configurada con el estilo de una **secretaria médica real de Buenos Aires**: educada, cálida, ubicada, sobria y ejecutiva. Habla de "vos", escribe mensajes cortitos (2 a 3 oraciones para no cansar al que lee) y usa emojis con mucha moderación (🌿, 🩺, 🙌).

### Sus "Reglas de Oro":

* **Empatía ante el dolor:** Si alguien escribe diciendo *"me caí de la bici y me duele mucho la rodilla"* o *"tengo una contractura insoportable"*, Clara no le tira los turnos en seco. Primero valida su situación con calidez (*"Qué macana el golpe, para eso te va a venir muy bien la evaluación previa..."*) y luego propone los pasos a seguir.
* **Quiénes atienden:** Clara sabe que los profesionales del consultorio son el **Lic. Norberto Brude** y la **Lic. María Gulín**, pero **solo los nombra si el paciente pregunta expresamente** (*"¿Quién me va a atender?"*). No repite los nombres si no viene al caso.
* **Precios y aranceles (Cero números por chat):** Clara **nunca** da valores numéricos ni presupuestos por mensaje. Explica que el valor exacto de la sesión lo informa directamente el kinesiólogo durante la llamada previa de orientación de 15 minutos, según lo que cada persona necesite tratar.
* **Obras sociales y prepagas:** Si el paciente pregunta si atienden por OSDE, Swiss Medical, etc., Clara aclara amablemente que se atiende de forma particular para brindar sesiones exclusivas y personalizadas, y que al finalizar se entrega factura oficial para tramitar el reintegro. Si el paciente no pregunta sobre prepagas, Clara no lo menciona.
* **Dirección exacta del consultorio:** Solo informa la dirección (`Charcas 3889, Piso 5º, Dpto B, Palermo`) una vez que el turno presencial está confirmado o si el paciente la pide directamente, recordando llevar estudios previos si los tienen (sin pedirles que lleguen con anticipación).
* **Fines de semana y feriados cerrados:** Atiende consultas las 24 horas, pero **solo otorga turnos de lunes a viernes hábiles**. Sábados, domingos y feriados nacionales de Argentina el consultorio permanece cerrado y Clara jamás ofrece ni agenda en esos días.
* **Sentido común de traslado (turnos para hoy):** Si un paciente escribe pidiendo turno para "hoy", Clara nunca le ofrece un horario que ocurra dentro de los próximos 90 a 120 minutos, para darle tiempo razonable de viajar y llegar tranquilo a Palermo.
* **Privacidad estricta:** Clara jamás revela nombres ni horarios de otros pacientes. Si alguien pregunta *"¿a qué hora tiene turno mi marido?"* o *"¿quién está a las 16 hs?"*, Clara responde con firmeza profesional que por confidencialidad médica no puede brindar datos de terceros.

---

## 📅 3. ¿Cómo se conecta con la Agenda de Google Calendar?

Clara lee y escribe en tiempo real en el calendario **`consultorio`** de Norberto:

```mermaid
flowchart LR
    A["Paciente escribe por WhatsApp"] --> B["Clara (Secretaria IA)"]
    B --> C["Google Calendar ('consultorio')"]
    B --> D["Aviso a Norberto (+54 11 6156-4311)"]
```

### Tipos de citas que agenda:
1. **Llamadas telefónicas de orientación previa (15 minutos):**  
   Aparecen en el calendario como: `📞 [LLAMADA 15m] Nombre Paciente`  
   Sirven para que el kinesiólogo converse brevemente con el paciente antes de que asista al consultorio.
2. **Turnos presenciales en consultorio (1 hora / 60 minutos):**  
   Aparecen en el calendario como: `🩺 [TURNO] Nombre Paciente`  
   Si es para un hijo o menor de edad, Clara registra: `🩺 [TURNO - MENOR] Nombre Menor (Familiar: Nombre)` y recuerda que deben venir acompañados por un adulto.
3. **Datos de contacto en cada cita:**  
   Al tocar cualquier evento en Google Calendar, en la descripción siempre figura el teléfono con el enlace de WhatsApp listo para tocar y escribirle al paciente.

### Cambios y cancelaciones:
* **Si el paciente pide cambiar de horario:** Clara busca su turno anterior en Google Calendar y lo mueve al nuevo horario acordado (no crea duplicados).
* **Si el paciente cancela:** Clara lo elimina de la agenda, liberando el espacio para otra persona.

---

## 🔔 4. ¿Qué notificaciones le llegan a Norberto a su celular?

Para no llenarle el WhatsApp de mensajes innecesarios, **Clara no le avisa a Norberto cuando un paciente solo hace preguntas informativas**.

**Solo le envía una alerta automática cuando hay algo importante que requiere atención:**

1. 📌 **Nuevo turno o llamada confirmada:**  
   > *📌 NUEVO TURNO / LLAMADA EN KINÉSICA*  
   > • *Paciente:* Lucas Méndez  
   > • *WhatsApp:* wa.me/54911...  
   > • *Mensaje:* "Quería un turno para este jueves a las 16 hs"  
   > • *Respuesta de Clara:* "Te esperamos este jueves a las 16:00 hs..."
2. 🔄 **Turno reprogramado:**  
   Avisa si un paciente movió su cita a otro día u horario.
3. 🚨 **Cancelación urgente del mismo día:**  
   Si alguien avisa a último momento que no puede ir a su turno de hoy, Clara dispara una alerta prioritaria avisando que **se liberó un hueco para hoy** e indica si hay alguien en lista de espera disponible para ocuparlo.
4. ⚠️ **Consultas especiales o derivaciones:**  
   Si un paciente plantea un caso médico complejo, un pedido legal o pide hablar con un responsable humano, Clara le dice al paciente que Norberto se contactará con él y le pasa el mensaje completo a Norberto.

*(En todos los avisos, Norberto puede presionar directamente el enlace azul `wa.me/...` para escribirle o llamarlo con un solo toque).*

---

## 👑 5. El "Modo Administrador": ¿Cómo le hablan los profesionales a Clara?

Clara reconoce automáticamente los celulares del equipo profesional:
* Celular de Norberto: `+54 11 6156-4311`
* Celulares de María: `11 2853-1224` y `+54 9 2236 80-7252`

Cuando alguno de los dos le escribe a Clara, ella los saluda por su nombre (*"Hola Norberto..."* o *"Hola María..."*) y se pone a su disposición con comandos muy sencillos:

### 📋 A. Ver los turnos del día
* **Qué escribirle:** `"agenda hoy"`, `"turnos de hoy"`, `"¿quién viene hoy?"` o `"agenda mañana"`.
* **Qué hace Clara:** Abre Google Calendar y les manda la lista ordenada de pacientes, con horarios, tipo de sesión y teléfonos.

### 🚫 B. Bloquear un horario para no atender
* **Qué escribirle:** `"bloquear jueves de 16 a 18"`, `"bloqueame mañana de 14 a 15:30"` o `"el martes a la mañana no atiendo"`.
* **Qué hace Clara:** Crea en Google Calendar un evento llamado `🚫 [BLOQUEADO] Horario no disponible`. A partir de ese momento, si un paciente pide turno en ese horario, Clara le dirá que está ocupado y ofrecerá otros huecos.

### 🏖️ C. Vacaciones o receso del consultorio
* **Qué escribirle:** `"vacaciones del 15 al 25 de octubre, cerrá la agenda"`.
* **Qué hace Clara:** Marca en el calendario `🏖️ [VACACIONES CONSULTORIO - CERRADO]` cubriendo todos esos días. Si un paciente escribe en ese período pidiendo turno, Clara le explica con amabilidad que el consultorio se encuentra en receso y le ofrece agendar un turno para cuando regresen.

### ⏸️ D. Atender el chat personalmente (Pausar a Clara)
* **Qué escribirle:** `"pausar bot"`, `"lo atiendo yo"` o `"silencio"`.
* **Qué hace Clara:** Responde *"Entendido [Norberto/María], pausado. Te dejo la conversación a vos 🙌"* y deja de intervenir en la conversación para que puedan chatear directamente.

*(Las acciones que piden Norberto o María no generan auto-alertas molestas).*

---

## ⏳ 6. Lista de Espera Inteligente (Smart Waitlist)

¿Qué pasa cuando un paciente quiere turno para un día que ya está completo?
1. Clara le explica que los horarios de ese día ya están cubiertos y le ofrece:  
   *"Si querés, te anoto en lista de espera y si se libera un hueco te aviso primero 🙌"*.
2. Si el paciente dice que sí, Clara lo anota en Google Calendar como `⏳ [LISTA DE ESPERA] Nombre Paciente` y le avisa a Norberto.
3. Si más adelante otro paciente cancela su turno de ese día, Clara le avisa a Norberto:  
   > *🚨 CANCELACIÓN URGENTE DE HOY EN KINÉSICA*  
   > • *Se liberó un hueco a las 16 hs.*  
   > • 💡 *PACIENTE EN LISTA DE ESPERA DISPONIBLE:* Lucas Méndez (wa.me/54911...).  
   > *¡Podés tocar su enlace para avisarle del lugar liberado!*

---

## 🧪 7. ¿Cómo probar a Clara desde el celular?

Para probar el funcionamiento como si fueras un paciente nuevo:

1. Abrí el chat de WhatsApp con el número de prueba de Clara.
2. Escribí el comando:  
   `/restart`
3. **Qué pasará:** Clara borrará la memoria de la conversación anterior y te saludará presentándose por primera vez:  
   *"Hola, buen día. Soy Clara de Kinésica. ¿En qué te puedo ayudar? 🩺"*
4. A partir de ahí podés probar pedirle un turno, preguntarle por prepagas, mandarle un audio de voz o pedirle cambiar la hora para ver cómo reacciona.

> 📋 **¿Querés probar escenarios específicos o reportar observaciones?**  
> En la [**Guía Oficial de Pruebas y Reporte de Feedback**](guia-pruebas.md) ([Enlace en GitHub](https://github.com/MartinBrude/kinesica/blob/main/docs/guia-pruebas.md)) tenés más de 30 casos de prueba preparados (consultas de prepagas, urgencias, audios confusos, lista de espera, etc.) y una ficha simple para reportar cualquier comentario o sugerencia.

---

## 📌 8. "Machete" rápido de comandos para los profesionales

Guardá esta tablita a mano para usar con Clara en el chat:

| Qué querés hacer | Qué tenés que escribirle a Clara |
|---|---|
| **Ver la agenda de hoy** | `"agenda hoy"` o `"turnos de hoy"` |
| **Ver la agenda de mañana o de otro día** | `"agenda mañana"` o `"agenda del viernes"` |
| **Cerrar un hueco específico** | `"bloquear jueves de 16 a 18"` |
| **Cerrar por vacaciones** | `"vacaciones del 15 al 25 de octubre"` |
| **Hablar vos con un paciente sin que Clara responda** | `"pausar bot"` o `"lo atiendo yo"` |
| **Empezar una prueba de cero como paciente** | `/restart` |

---

*Cualquier sugerencia, ajuste de palabras o cambio en las reglas de atención que se quiera hacer, se puede ajustar en cuestión de minutos.*
