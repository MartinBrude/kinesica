<?php
return [
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'u696348908_atm',
        'user' => 'u696348908_atm',
        'pass' => 'CAMBIAR',
    ],
    'install_token' => 'CAMBIAR',
    'webhook_secret' => 'CAMBIAR',
    // Interacciones WhatsApp: n8n debe enviar X-Kinesica-Bot-Secret = webhook_secret.
    // Solo durante rotación: allow_legacy_bot_secret => true + legacy_bot_secret (valor viejo, NO en git).
    'allow_legacy_bot_secret' => false,
    'legacy_bot_secret' => '',
    // Reconciliador (importa desde n8n lo que el push no entregó). Sin defaults.
    // 'n8n_url' => 'https://n8n.ejemplo.com',
    // 'n8n_user' => '',
    // 'n8n_password' => '',
    // 'n8n_workflow_id' => '',
    'mail_from' => 'no-reply@kinesica.com.ar',
    'admin_url' => 'https://www.kinesica.com.ar/admin/',
    // Token permanente Meta WhatsApp Cloud API (mismo que n8n / Apps Script).
    // También se puede inyectar por env: WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID.
    'whatsapp_token' => '',
    'whatsapp_phone_number_id' => '1340013275870491',
    // Fallback del simulador si no hay token local: webhook n8n (clara-demo-alert).
    'n8n_demo_alert_url' => 'https://n8n.kinesica.com.ar/webhook/clara-demo-alert',
    'user_emails' => [
        'martin' => 'martin.brude@gmail.com',
        'norberto' => 'norberto1712@gmail.com',
        'maria' => 'manosmagicas7116@gmail.com',
        'facundo' => 'facu86@gmail.com',
    ],
    'users' => [
        'martin' => ['name' => 'Martin', 'password' => 'CAMBIAR', 'totp' => 'CAMBIAR'],
        'norberto' => ['name' => 'Norberto', 'password' => 'CAMBIAR', 'totp' => 'CAMBIAR'],
        'maria' => ['name' => 'María', 'password' => 'CAMBIAR', 'totp' => 'CAMBIAR'],
        'facundo' => ['name' => 'Facundo Vivardo', 'password' => 'CAMBIAR', 'totp' => 'CAMBIAR'],
    ],
];
