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
- `POST /backend/api.php?action=admin.login` — validate admin credentials from config.
- `GET /backend/api.php?action=admin.orders` — list orders (requires `admin.login`).

## Data model
- `backend/data/products.json` ships with sample items inspired by vices-oz.com, unclev.com.au, and vaperoo.com.au.
- `backend/data/orders.json` captures orders when MySQL is unavailable.
- Shipping and currency settings live in `backend/config.php` and include defaults for AUD, USD, NZD, and EUR.

## Integrating with templates
- The **front** folder contains storefront pages. Wire up forms and buttons to the API endpoints above (for example, using `fetch` from a script tag) to make the pages dynamic.
- The **admin** folder contains the dashboard templates. After calling `admin.login`, you can hydrate order tables with the `admin.orders` response.

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
