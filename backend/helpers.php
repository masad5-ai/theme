<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function readJson(string $path): array
{
    if (!file_exists($path)) {
        return [];
    }

    $json = file_get_contents($path);
    return json_decode($json, true, 512, JSON_THROW_ON_ERROR);
}

function loadProducts(): array
{
    $pdo = db();
    if ($pdo instanceof PDO) {
        try {
            $stmt = $pdo->query('SELECT id, name, description, brand, category, price, currency, stock, image, featured, tags FROM products');
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return array_map(static function (array $row): array {
                $row['tags'] = array_filter(array_map('trim', explode(',', (string)($row['tags'] ?? ''))));
                $row['featured'] = (bool)($row['featured'] ?? false);
                return $row;
            }, $rows);
        } catch (Throwable $e) {
            // fallback to JSON below
        }
    }

    return readJson(__DIR__ . '/data/products.json');
}

function saveOrder(array $order): void
{
    $pdo = db();
    if ($pdo instanceof PDO) {
        try {
            $pdo->prepare('INSERT INTO orders (customer_name, email, phone, subtotal, shipping, total, currency, items_json) VALUES (:customer_name, :email, :phone, :subtotal, :shipping, :total, :currency, :items_json)')
                ->execute([
                    ':customer_name' => $order['customer_name'],
                    ':email' => $order['email'],
                    ':phone' => $order['phone'],
                    ':subtotal' => $order['subtotal'],
                    ':shipping' => $order['shipping'],
                    ':total' => $order['total'],
                    ':currency' => $order['currency'],
                    ':items_json' => json_encode($order['items'], JSON_THROW_ON_ERROR),
                ]);
            return;
        } catch (Throwable $e) {
            // persist to JSON if DB is unavailable
        }
    }

    $path = __DIR__ . '/data/orders.json';
    $orders = readJson($path);
    $order['id'] = count($orders) + 1;
    $orders[] = $order;
    file_put_contents($path, json_encode($orders, JSON_PRETTY_PRINT));
}

function convertCurrency(float $value, string $from, string $to): float
{
    $rates = currencyRates();
    $base = $rates['base'] ?? 'AUD';
    $table = $rates['rates'] ?? ['AUD' => 1.0];

    if (!isset($table[$from]) || !isset($table[$to]) || $table[$from] <= 0) {
        return $value;
    }

    $audValue = $value / $table[$from];
    return round($audValue * $table[$to], 2);
}

function calculateShipping(float $subtotal): float
{
    $shipping = shippingConfig();
    if ($subtotal >= ($shipping['free_over'] ?? INF)) {
        return 0.0;
    }

    return ($shipping['base'] ?? 0) + ($shipping['per_item'] ?? 0) * max(1, cartItemCount());
}

function cart(): array
{
    $_SESSION['cart'] = $_SESSION['cart'] ?? [];
    return $_SESSION['cart'];
}

function saveCart(array $cart): void
{
    $_SESSION['cart'] = $cart;
}

function cartItemCount(): int
{
    return array_sum(array_column(cart(), 'quantity'));
}

function cartTotals(string $currency = 'AUD'): array
{
    $products = loadProducts();
    $lookup = [];
    foreach ($products as $product) {
        $lookup[$product['id']] = $product;
    }

    $subtotal = 0.0;
    $items = [];

    foreach (cart() as $item) {
        if (!isset($lookup[$item['product_id']])) {
            continue;
        }
        $product = $lookup[$item['product_id']];
        $price = convertCurrency((float)$product['price'], $product['currency'] ?? 'AUD', $currency);
        $lineTotal = $price * $item['quantity'];
        $subtotal += $lineTotal;
        $items[] = [
            'product' => $product,
            'quantity' => $item['quantity'],
            'price' => $price,
            'line_total' => $lineTotal,
        ];
    }

    $shipping = calculateShipping($subtotal);

    return [
        'currency' => $currency,
        'items' => $items,
        'subtotal' => round($subtotal, 2),
        'shipping' => round($shipping, 2),
        'total' => round($subtotal + $shipping, 2),
    ];
}

function requireAdmin(array $payload): bool
{
    $credentials = adminCredentials();
    return ($payload['email'] ?? '') === ($credentials['email'] ?? '')
        && ($payload['password'] ?? '') === ($credentials['password'] ?? '');
}
