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

function loadUsers(): array
{
    return readJson(__DIR__ . '/data/users.json');
}

function saveUsers(array $users): void
{
    file_put_contents(__DIR__ . '/data/users.json', json_encode($users, JSON_PRETTY_PRINT));
}

function findUserByEmail(string $email): ?array
{
    foreach (loadUsers() as $user) {
        if (strcasecmp($user['email'] ?? '', $email) === 0) {
            return $user;
        }
    }

    return null;
}

function currentCustomer(): ?array
{
    $id = $_SESSION['customer_id'] ?? null;
    if ($id === null) {
        return null;
    }

    foreach (loadUsers() as $user) {
        if ((int)$user['id'] === (int)$id) {
            return $user;
        }
    }

    return null;
}

function persistCustomerSession(array $user): void
{
    $_SESSION['customer_id'] = $user['id'];
}

function writeJson(string $path, array $data): void
{
    file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT));
}

function saveOrder(array $order): array
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
                $order['id'] = (int)$pdo->lastInsertId();
                return $order;
            } catch (Throwable $e) {
                // persist to JSON if DB is unavailable
            }
        }

    $path = __DIR__ . '/data/orders.json';
    $orders = readJson($path);
    $order['id'] = count($orders) + 1;
    $orders[] = $order;
    file_put_contents($path, json_encode($orders, JSON_PRETTY_PRINT));

    return $order;
}

function allOrders(?string $email = null): array
{
    $pdo = db();
    if ($pdo instanceof PDO) {
        try {
            $sql = 'SELECT id, customer_name, email, phone, subtotal, shipping, total, currency, items_json, created_at FROM orders';
            $params = [];
            if ($email !== null && $email !== '') {
                $sql .= ' WHERE email = :email';
                $params[':email'] = $email;
            }
            $sql .= ' ORDER BY id DESC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return array_map(static function (array $row): array {
                if (isset($row['items_json'])) {
                    $row['items'] = json_decode((string)$row['items_json'], true) ?: [];
                }
                unset($row['items_json']);
                return $row;
            }, $rows);
        } catch (Throwable $e) {
            // fallback to JSON below
        }
    }

    $orders = readJson(__DIR__ . '/data/orders.json');
    if ($email !== null && $email !== '') {
        $orders = array_values(array_filter($orders, static fn ($order) => strcasecmp($order['email'] ?? '', $email) === 0));
    }
    usort($orders, static fn ($a, $b) => ($b['id'] ?? 0) <=> ($a['id'] ?? 0));
    return $orders;
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

function availableCategories(): array
{
    $categories = [];
    foreach (loadProducts() as $product) {
        $category = trim((string)($product['category'] ?? ''));
        if ($category === '') {
            continue;
        }
        $categories[$category] = ($categories[$category] ?? 0) + 1;
    }

    ksort($categories);

    return array_map(static fn ($name, $count) => ['name' => $name, 'products' => $count], array_keys($categories), $categories);
}

function availableBrands(): array
{
    $brands = [];
    foreach (loadProducts() as $product) {
        $brand = trim((string)($product['brand'] ?? ''));
        if ($brand === '') {
            continue;
        }
        $brands[$brand] = ($brands[$brand] ?? 0) + 1;
    }

    ksort($brands);

    return array_map(static fn ($name, $count) => ['name' => $name, 'products' => $count], array_keys($brands), $brands);
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

function wishlist(): array
{
    $_SESSION['wishlist'] = $_SESSION['wishlist'] ?? [];
    return $_SESSION['wishlist'];
}

function saveWishlist(array $ids): void
{
    $_SESSION['wishlist'] = array_values(array_unique(array_map('intval', $ids)));
}

function compareList(): array
{
    $_SESSION['compare'] = $_SESSION['compare'] ?? [];
    return $_SESSION['compare'];
}

function saveCompare(array $ids): void
{
    $_SESSION['compare'] = array_values(array_unique(array_map('intval', $ids)));
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

function wishlistItems(string $currency = 'AUD'): array
{
    $products = loadProducts();
    $lookup = [];
    foreach ($products as $product) {
        $lookup[$product['id']] = $product;
    }

    $items = [];
    foreach (wishlist() as $productId) {
        if (!isset($lookup[$productId])) {
            continue;
        }
        $product = $lookup[$productId];
        $price = convertCurrency((float)$product['price'], $product['currency'] ?? 'AUD', $currency);
        $items[] = [
            'product' => $product,
            'price' => $price,
        ];
    }

    return ['currency' => $currency, 'items' => $items];
}

function compareItems(string $currency = 'AUD'): array
{
    $products = loadProducts();
    $lookup = [];
    foreach ($products as $product) {
        $lookup[$product['id']] = $product;
    }

    $items = [];
    foreach (compareList() as $productId) {
        if (!isset($lookup[$productId])) {
            continue;
        }
        $product = $lookup[$productId];
        $price = convertCurrency((float)$product['price'], $product['currency'] ?? 'AUD', $currency);
        $items[] = [
            'product' => $product,
            'price' => $price,
        ];
    }

    return ['currency' => $currency, 'items' => $items];
}

function requireAdmin(array $payload): bool
{
    $credentials = adminCredentials();
    $email = $payload['email'] ?? $payload['username'] ?? '';
    return strcasecmp($email, (string)($credentials['email'] ?? '')) === 0
        && ($payload['password'] ?? '') === ($credentials['password'] ?? '');
}

function adminAuthenticated(): bool
{
    return ($_SESSION['admin_authenticated'] ?? false) === true;
}

function adminLogin(array $payload): void
{
    if (!requireAdmin($payload)) {
        http_response_code(401);
        respond(['error' => 'Invalid admin credentials']);
    }

    $_SESSION['admin_authenticated'] = true;
    respond(['ok' => true, 'admin' => ['email' => adminCredentials()['email'] ?? 'admin@example.com']]);
}

function adminOrders(): void
{
    if (!adminAuthenticated()) {
        http_response_code(401);
        respond(['error' => 'Admin login required']);
    }

    respond(['orders' => allOrders(null)]);
}

function adminCustomers(): void
{
    if (!adminAuthenticated()) {
        http_response_code(401);
        respond(['error' => 'Admin login required']);
    }

    $customers = array_map(static function (array $user): array {
        unset($user['password']);
        return $user;
    }, loadUsers());

    respond(['customers' => $customers]);
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
        respond(['error' => 'User already exists']);
    }

    $users = loadUsers();
    $nextId = count($users) > 0 ? max(array_column($users, 'id')) + 1 : 1;
    $user = [
        'id' => $nextId,
        'email' => $email,
        'name' => $name !== '' ? $name : 'Customer',
        'password' => password_hash($password, PASSWORD_BCRYPT),
        'created_at' => date('Y-m-d H:i:s'),
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

    if (!$user || !password_verify($password, (string)($user['password'] ?? ''))) {
        http_response_code(401);
        respond(['error' => 'Invalid credentials']);
    }

    persistCustomerSession($user);
    respond(['user' => ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name']]]);
}

function customerOrders(): void
{
    $user = currentCustomer();
    if (!$user) {
        http_response_code(401);
        respond(['error' => 'Login required']);
    }

    respond(['orders' => allOrders($user['email'] ?? null)]);
}

function lookupOrder(int $id): void
{
    if ($id <= 0) {
        http_response_code(404);
        respond(['error' => 'Order not found']);
    }

    $order = findOrderById($id);
    if (!$order) {
        http_response_code(404);
        respond(['error' => 'Order not found']);
    }

    respond(['order' => $order]);
}

function findOrderById(int $id): ?array
{
    foreach (allOrders(null) as $order) {
        if ((int)($order['id'] ?? 0) === $id) {
            return $order;
        }
    }

    return null;
}
