# Theme PHP scaffold

This repository now includes a lightweight PHP backend you can pair with the existing **front** and **admin** HTML templates to prototype a vape e-commerce experience.

## Getting started
1. Copy the sample configuration and adjust database credentials:
   ```bash
   cp backend/config.sample.php backend/config.php
   ```
2. Update `backend/config.php` with your MySQL DSN, username, and password. If the database is unreachable, the API will automatically fall back to bundled JSON fixtures.
3. Point your web server (or `php -S localhost:8000`) at the repository root so `/backend/api.php` is accessible.

## API endpoints
- `GET /backend/api.php?action=products` — list products from MySQL or `backend/data/products.json`.
- `POST /backend/api.php?action=cart.add` — add to cart. Body: `{ "product_id": 1, "quantity": 2 }`.
- `POST /backend/api.php?action=cart.remove` — remove item from cart. Body: `{ "product_id": 1 }`.
- `GET /backend/api.php?action=cart.view&currency=USD` — view cart totals with currency conversion.
- `POST /backend/api.php?action=checkout` — place order and persist to MySQL or `backend/data/orders.json`.
- `GET /backend/api.php?action=wishlist.view` — view wishlist items; pair with `wishlist.add` / `wishlist.remove`.
- `GET /backend/api.php?action=compare.view` — view comparison list; pair with `compare.add` / `compare.remove`.
- `POST /backend/api.php?action=customer.register` — create a storefront account. Body: `{ "email": "me@example.com", "password": "secret", "name": "Customer" }`.
- `POST /backend/api.php?action=customer.login` — sign a customer in; `customer.orders` and order tracking hydrate dashboards.
- `GET /backend/api.php?action=customer.orders` — pull order history for the logged-in customer.
- `GET /backend/api.php?action=order.lookup&id=1` — fetch a specific order (used by invoices and tracking).
- `GET /backend/api.php?action=shipping.config` — expose shipping and currency settings from configuration.
- `POST /backend/api.php?action=admin.login` — validate admin credentials from config.
- `GET /backend/api.php?action=admin.orders` — list orders (requires `admin.login`).
- `GET /backend/api.php?action=admin.customers` — list customers (requires `admin.login`).

## Data model
- `backend/data/products.json` ships with sample items inspired by vices-oz.com, unclev.com.au, and vaperoo.com.au.
- `backend/data/orders.json` captures orders when MySQL is unavailable.
- Shipping and currency settings live in `backend/config.php` and include defaults for AUD, USD, NZD, and EUR.

## Integrating with templates
- The **front** folder contains storefront pages. Wire up forms and buttons to the API endpoints above (for example, using `fetch` from a script tag) to make the pages dynamic.
- The **admin** folder contains the dashboard templates. After calling `admin.login`, you can hydrate order tables with the `admin.orders` response.

### Storefront wiring provided in this repo
- `front/assets/js/storefront.js` automatically hydrates:
  - `front/index.html` via `[data-products-grid="featured"]` for live featured products.
  - `front/shop-filter.html` via `[data-products-grid="catalog"]` for a browsable catalog.
  - `front/shop-product-left.html` via `[data-product-detail]` and `?id=PRODUCT_ID` in the URL.
  - `front/shop-cart.html` via `[data-cart-table]`, `[data-cart-totals]`, and `[data-cart-count]` for removing items and recalculating totals.
  - `front/shop-checkout.html` via `[data-checkout-items]`, `[data-cart-totals]`, and `[data-checkout-form]` to place an order against the PHP API.
- Each page sets `window.STORE_API_BASE = '../backend/api.php';` before including `storefront.js`; adjust this if you host the API elsewhere.
- To attach the mini-cart count to new buttons, just add `data-cart-count` to any element and `storefront.js` will keep it in sync.

## Database schema helper
If you want to persist data immediately, you can create a simple schema:
```sql
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  brand VARCHAR(120),
  category VARCHAR(120),
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'AUD',
  stock INT DEFAULT 0,
  image VARCHAR(255),
  featured TINYINT(1) DEFAULT 0,
  tags VARCHAR(255)
);

CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(60),
  subtotal DECIMAL(10,2),
  shipping DECIMAL(10,2),
  total DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'AUD',
  items_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
