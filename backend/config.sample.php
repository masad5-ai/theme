<?php
return [
    'db' => [
        'dsn' => 'mysql:host=localhost;dbname=vape_store;charset=utf8mb4',
        'user' => 'vape_user',
        'password' => 'change_me',
    ],
    'admin' => [
        'email' => 'admin@example.com',
        'password' => 'secret',
    ],
    'currency' => [
        'base' => 'AUD',
        'rates' => [
            'AUD' => 1.0,
            'USD' => 0.67,
            'NZD' => 1.09,
            'EUR' => 0.61,
        ],
    ],
    'shipping' => [
        'base' => 9.95,
        'per_item' => 1.5,
        'free_over' => 150,
    ],
];
