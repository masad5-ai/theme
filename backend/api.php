<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/helpers.php';

$action = $_GET['action'] ?? 'ping';
$payload = json_decode(file_get_contents('php://input') ?: '[]', true);

try {
    switch ($action) {
        case 'ping':
            respond(['ok' => true, 'message' => 'Vape backend ready']);
            break;
        case 'products':
            respond(['products' => loadProducts()]);
            break;
        case 'cart.add':
            addToCart((int)($payload['product_id'] ?? 0), (int)($payload['quantity'] ?? 1));
            break;
        case 'cart.remove':
            removeFromCart((int)($payload['product_id'] ?? 0));
            break;
        case 'cart.view':
            $currency = $_GET['currency'] ?? $payload['currency'] ?? 'AUD';
            respond(cartTotals($currency));
            break;
        case 'checkout':
            checkout($payload);
            break;
        case 'admin.login':
            adminLogin($payload);
            break;
        case 'admin.orders':
            adminOrders();
            break;
        default:
            http_response_code(404);
            respond(['error' => 'Unknown action']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    respond(['error' => 'Server error', 'detail' => $e->getMessage()]);
}

function addToCart(int $productId, int $quantity): void
{
    $products = loadProducts();
    foreach ($products as $product) {
        if ($product['id'] === $productId) {
            $cart = cart();
            $cart[$productId] = [
                'product_id' => $productId,
                'quantity' => ($cart[$productId]['quantity'] ?? 0) + max(1, $quantity),
            ];
            saveCart($cart);
            respond(cartTotals());
        }
    }

    http_response_code(422);
    respond(['error' => 'Product not found']);
}

function removeFromCart(int $productId): void
{
    $cart = cart();
    unset($cart[$productId]);
    saveCart($cart);
    respond(cartTotals());
}

function checkout(array $payload): void
{
    $totals = cartTotals($payload['currency'] ?? 'AUD');
    if (empty($totals['items'])) {
        http_response_code(400);
        respond(['error' => 'Cart is empty']);
    }

    $order = [
        'customer_name' => $payload['customer_name'] ?? 'Guest',
        'email' => $payload['email'] ?? '',
        'phone' => $payload['phone'] ?? '',
        'currency' => $totals['currency'],
        'items' => $totals['items'],
        'subtotal' => $totals['subtotal'],
        'shipping' => $totals['shipping'],
        'total' => $totals['total'],
    ];

    saveOrder($order);
    saveCart([]);

    respond(['order' => $order]);
}

function adminLogin(array $payload): void
{
    if (requireAdmin($payload)) {
        $_SESSION['admin'] = true;
        respond(['ok' => true]);
    }

    http_response_code(401);
    respond(['error' => 'Invalid credentials']);
}

function adminOrders(): void
{
    if (!($_SESSION['admin'] ?? false)) {
        http_response_code(401);
        respond(['error' => 'Unauthorized']);
    }

    $pdo = db();
    if ($pdo instanceof PDO) {
        try {
            $stmt = $pdo->query('SELECT id, customer_name, email, phone, subtotal, shipping, total, currency, created_at FROM orders ORDER BY id DESC');
            respond(['orders' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            return;
        } catch (Throwable $e) {
            // fallback to JSON below
        }
    }

    $orders = readJson(__DIR__ . '/data/orders.json');
    respond(['orders' => $orders]);
}

function respond(array $data): void
{
    echo json_encode($data, JSON_PRETTY_PRINT);
    exit;
}
