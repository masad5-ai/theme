<?php
declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$config = [];
$configFile = __DIR__ . '/config.php';
$sampleFile = __DIR__ . '/config.sample.php';

if (file_exists($configFile)) {
    $config = require $configFile;
} elseif (file_exists($sampleFile)) {
    $config = require $sampleFile;
}

function db(): ?PDO
{
    static $pdo = null;
    global $config;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (!isset($config['db']['dsn'])) {
        return null;
    }

    try {
        $pdo = new PDO(
            $config['db']['dsn'],
            $config['db']['user'] ?? null,
            $config['db']['password'] ?? null,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
    } catch (Throwable $e) {
        // When credentials are wrong or database is not available, fail gracefully
        $pdo = null;
    }

    return $pdo;
}

function currencyRates(): array
{
    global $config;
    return $config['currency'] ?? ['base' => 'AUD', 'rates' => ['AUD' => 1.0]];
}

function shippingConfig(): array
{
    global $config;
    return $config['shipping'] ?? ['base' => 9.95, 'per_item' => 1.5, 'free_over' => 150];
}

function adminCredentials(): array
{
    global $config;
    return $config['admin'] ?? ['email' => 'admin@example.com', 'password' => 'secret'];
}
