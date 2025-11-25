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
        case 'categories':
            respond(['categories' => availableCategories()]);
            break;
        case 'brands':
            respond(['brands' => availableBrands()]);
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
        case 'wishlist.add':
            addToWishlist((int)($payload['product_id'] ?? 0));
            break;
        case 'wishlist.remove':
            removeFromWishlist((int)($payload['product_id'] ?? 0));
            break;
        case 'wishlist.view':
            respond(wishlistItems($_GET['currency'] ?? $payload['currency'] ?? 'AUD'));
            break;
        case 'compare.add':
            addToCompare((int)($payload['product_id'] ?? 0));
            break;
        case 'compare.remove':
            removeFromCompare((int)($payload['product_id'] ?? 0));
            break;
        case 'compare.view':
            respond(compareItems($_GET['currency'] ?? $payload['currency'] ?? 'AUD'));
            break;
        case 'checkout':
            checkout($payload);
            break;
        case 'shipping.config':
            respond(['shipping' => shippingConfig(), 'currency' => currencyRates()]);
            break;
        case 'customer.register':
            customerRegister($payload);
            break;
        case 'customer.login':
            customerLogin($payload);
            break;
        case 'customer.logout':
            unset($_SESSION['customer_id']);
            respond(['ok' => true]);
            break;
        case 'customer.me':
            $user = currentCustomer();
            respond(['user' => $user]);
            break;
        case 'customer.orders':
            customerOrders();
            break;
        case 'order.lookup':
            lookupOrder((int)($payload['id'] ?? ($_GET['id'] ?? 0)));
            break;
        case 'order.last':
            $lastId = (int)($_SESSION['last_order_id'] ?? 0);
            lookupOrder($lastId);
            break;
        case 'admin.login':
            adminLogin($payload);
            break;
        case 'admin.orders':
            adminOrders();
            break;
        case 'admin.customers':
            adminCustomers();
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

    $order = saveOrder($order);
    saveCart([]);

    $_SESSION['last_order_id'] = $order['id'] ?? null;

    respond(['order' => $order]);
}

function addToWishlist(int $productId): void
{
    if ($productId <= 0) {
        http_response_code(422);
        respond(['error' => 'Invalid product']);
    }

    $items = wishlist();
    $items[] = $productId;
    saveWishlist($items);
    respond(wishlistItems());
}

function removeFromWishlist(int $productId): void
{
    $items = array_filter(wishlist(), static fn ($id) => (int)$id !== $productId);
    saveWishlist($items);
    respond(wishlistItems());
}

function addToCompare(int $productId): void
{
    if ($productId <= 0) {
        http_response_code(422);
        respond(['error' => 'Invalid product']);
    }

    $items = compareList();
    $items[] = $productId;
    saveCompare($items);
    respond(compareItems());
}

function removeFromCompare(int $productId): void
{
    $items = array_filter(compareList(), static fn ($id) => (int)$id !== $productId);
    saveCompare($items);
    respond(compareItems());
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

    respond(['orders' => allOrders(null)]);
}

function adminCustomers(): void
{
    if (!($_SESSION['admin'] ?? false)) {
        http_response_code(401);
        respond(['error' => 'Unauthorized']);
    }

    respond(['customers' => loadUsers()]);
}

function customerRegister(array $payload): void
{
    $email = trim((string)($payload['email'] ?? ''));
    $name = trim((string)($payload['name'] ?? ''));
    $password = (string)($payload['password'] ?? '');

    if ($email === '' || $password === '') {
        http_response_code(422);
        respond(['error' => 'Email and password required']);
    }

    if (findUserByEmail($email)) {
        http_response_code(409);
        respond(['error' => 'Account already exists']);
    }

    $users = loadUsers();
    $nextId = count($users) + 1;
    $user = [
        'id' => $nextId,
        'email' => $email,
        'name' => $name ?: $email,
        'password' => password_hash($password, PASSWORD_DEFAULT),
    ];
    $users[] = $user;
    saveUsers($users);
    persistCustomerSession($user);
    respond(['user' => ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name']]]);
}

function customerLogin(array $payload): void
{
    $email = trim((string)($payload['email'] ?? ''));
    $password = (string)($payload['password'] ?? '');
    $user = findUserByEmail($email);

    if ($user && password_verify($password, $user['password'] ?? '')) {
        persistCustomerSession($user);
        respond(['user' => ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name']]]);
    }

    http_response_code(401);
    respond(['error' => 'Invalid credentials']);
}

function customerOrders(): void
{
    $user = currentCustomer();
    $email = $user['email'] ?? ($_GET['email'] ?? '');
    $orders = $email ? allOrders($email) : [];
    respond(['orders' => $orders]);
}

function lookupOrder(int $id): void
{
    $order = $id > 0 ? findOrderById($id) : null;
    if (!$order) {
        http_response_code(404);
        respond(['error' => 'Order not found']);
    }

    respond(['order' => $order]);
}

function respond(array $data): void
{
    echo json_encode($data, JSON_PRETTY_PRINT);
    exit;
}
