(function () {
  const apiBase = window.STORE_API_BASE || '../backend/api.php';
  let productsCache = null;
  const currencySymbols = { AUD: '$', USD: '$', EUR: '€' };

  async function api(action, body) {
    const method = body ? 'POST' : 'GET';
    const url = method === 'GET' ? `${apiBase}?action=${action}` : `${apiBase}?action=${action}`;
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }

  async function getProducts() {
    if (productsCache) return productsCache;
    const data = await api('products');
    productsCache = data.products || [];
    return productsCache;
  }

  function money(value, currency = 'AUD') {
    const symbol = currencySymbols[currency] || currency;
    return `${symbol}${Number(value || 0).toFixed(2)}`;
  }

  function productCard(product) {
    const tags = (product.tags || []).map((tag) => `<span class="badge bg-light text-dark me-1">${tag}</span>`).join('');
    return `
      <div class="col-lg-1-5 col-md-4 col-12 col-sm-6" data-product-id="${product.id}">
        <div class="product-cart-wrap mb-30">
          <div class="product-img-action-wrap">
            <div class="product-img product-img-zoom">
              <a href="shop-product-left.html?id=${product.id}">
                <img class="default-img" src="${product.image}" alt="${product.name}" />
              </a>
            </div>
            <div class="product-action-1">
              <a aria-label="Add To Wishlist" class="action-btn" href="#" data-add-to-wishlist="${product.id}"><i class="fi-rs-heart"></i></a>
              <a aria-label="Compare" class="action-btn" href="#" data-add-to-compare="${product.id}"><i class="fi-rs-shuffle"></i></a>
              <a aria-label="Quick view" class="action-btn" href="shop-product-left.html?id=${product.id}"><i class="fi-rs-eye"></i></a>
            </div>
            <div class="product-badges product-badges-position product-badges-mrg">
              ${product.featured ? '<span class="hot">Featured</span>' : ''}
            </div>
          </div>
          <div class="product-content-wrap">
            <div class="product-category"><a href="#">${product.category || ''}</a></div>
            <h2><a href="shop-product-left.html?id=${product.id}">${product.name}</a></h2>
            <div class="product-card-bottom">
              <div class="product-price"><span>${money(product.price, product.currency)}</span></div>
              <div class="add-cart"><a class="add" href="#" data-add-to-cart="${product.id}"><i class="fi-rs-shopping-cart mr-5"></i>Add</a></div>
            </div>
            <div class="mt-2 text-muted small">${product.description || ''}</div>
            <div>${tags}</div>
          </div>
        </div>
      </div>
    `;
  }

  async function renderFeatured() {
    const container = document.querySelector('[data-products-grid="featured"]');
    if (!container) return;
    const products = await getProducts();
    const featured = products.filter((p) => p.featured);
    container.innerHTML = featured.map(productCard).join('');
    wireAddToCart(container);
    wireWishAndCompare(container);
  }

  async function renderCatalog() {
    const container = document.querySelector('[data-products-grid="catalog"]');
    if (!container) return;
    const products = await getProducts();
    container.innerHTML = products.map(productCard).join('');
    wireAddToCart(container);
    wireWishAndCompare(container);
  }

  function wireAddToCart(scope = document) {
    scope.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const id = parseInt(btn.getAttribute('data-add-to-cart'), 10);
        if (!id) return;
        await api('cart.add', { product_id: id, quantity: 1 });
        const summary = await renderCartSummary();
        await renderMiniCart(summary);
      });
    });
  }

  function wireWishAndCompare(scope = document) {
    scope.querySelectorAll('[data-add-to-wishlist]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const id = parseInt(btn.getAttribute('data-add-to-wishlist'), 10);
        if (!id) return;
        await api('wishlist.add', { product_id: id });
        await renderWishlist();
      });
    });

    scope.querySelectorAll('[data-add-to-compare]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const id = parseInt(btn.getAttribute('data-add-to-compare'), 10);
        if (!id) return;
        await api('compare.add', { product_id: id });
        await renderCompare();
      });
    });
  }

  async function renderProductDetail() {
    const detail = document.querySelector('[data-product-detail]');
    if (!detail) return;
    const id = parseInt(new URLSearchParams(window.location.search).get('id') || '0', 10);
    const products = await getProducts();
    const product = products.find((p) => p.id === id) || products[0];
    if (!product) return;

    const title = detail.querySelector('[data-product-title]');
    const price = detail.querySelector('[data-product-price]');
    const description = detail.querySelector('[data-product-description]');
    const image = detail.querySelector('[data-product-image]');
    const addBtn = detail.querySelector('[data-add-to-cart]');

    if (title) title.textContent = product.name;
    if (price) price.textContent = money(product.price, product.currency);
    if (description) description.textContent = product.description;
    if (image) image.setAttribute('src', product.image);
    if (addBtn) addBtn.setAttribute('data-add-to-cart', product.id);

    wireAddToCart(detail);
    wireWishAndCompare(detail);
  }

  async function renderCartSummary() {
    const badges = document.querySelectorAll('[data-cart-count]');
    const data = await api('cart.view');
    const count = (data.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
    badges.forEach((badge) => {
      badge.textContent = count;
    });
    return data;
  }

  async function renderMiniCart(summary) {
    const containers = document.querySelectorAll('[data-cart-dropdown]');
    if (!containers.length) return;
    const data = summary || (await api('cart.view'));

    containers.forEach((container) => {
      const list = (data.items || [])
        .map(
          (item) => `
            <li>
              <div class="shopping-cart-img">
                <a href="shop-product-left.html?id=${item.product.id}"><img alt="${item.product.name}" src="${item.product.image}" /></a>
              </div>
              <div class="shopping-cart-title">
                <h4><a href="shop-product-left.html?id=${item.product.id}">${item.product.name}</a></h4>
                <h3><span>${item.quantity} × </span>${money(item.price, data.currency)}</h3>
              </div>
              <div class="shopping-cart-delete">
                <a href="#" data-remove-from-cart="${item.product.id}"><i class="fi-rs-cross-small"></i></a>
              </div>
            </li>`
        )
        .join('');

      container.querySelector('ul')?.remove();
      const listEl = document.createElement('ul');
      listEl.innerHTML = list || '<li class="text-center text-muted py-3">Cart is empty</li>';
      container.prepend(listEl);

      const footer = container.querySelector('.shopping-cart-footer');
      if (footer) {
        const subtotal = footer.querySelector('.cart-total > li span:last-child');
        if (subtotal) subtotal.textContent = money(data.subtotal, data.currency);
      }

      wireAddToCart(container);
      container.querySelectorAll('[data-remove-from-cart]').forEach((link) => {
        link.addEventListener('click', async (event) => {
          event.preventDefault();
          const id = parseInt(link.getAttribute('data-remove-from-cart'), 10);
          await api('cart.remove', { product_id: id });
          const latest = await renderCartSummary();
          await renderMiniCart(latest);
          renderCartPage();
        });
      });
    });
  }

  async function renderCartPage() {
    const table = document.querySelector('[data-cart-table]');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const totals = document.querySelector('[data-cart-totals]');
    const summary = await api('cart.view');

    if (!summary.items || summary.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5">Your cart is empty.</td></tr>';
    } else {
      tbody.innerHTML = summary.items
        .map(
          (item) => `
          <tr>
            <td class="custome-checkbox pl-30"></td>
            <td class="image product-thumbnail"><img src="${item.product.image}" alt="${item.product.name}"></td>
            <td class="product-des product-name">
              <h6 class="mb-5"><a class="product-name mb-10 text-heading" href="shop-product-left.html?id=${item.product.id}">${item.product.name}</a></h6>
              <div class="text-muted small">${item.product.brand || ''}</div>
            </td>
            <td class="price" data-title="Price"><h4 class="text-body">${money(item.price, summary.currency)}</h4></td>
            <td class="text-center detail-info" data-title="Stock">${item.quantity}</td>
            <td class="price" data-title="Price"><h4 class="text-brand">${money(item.line_total, summary.currency)}</h4></td>
            <td class="action text-center" data-title="Remove"><a href="#" class="text-body" data-remove-from-cart="${item.product.id}"><i class="fi-rs-trash"></i></a></td>
          </tr>`
        )
        .join('');
    }

    if (totals) {
      totals.querySelector('[data-subtotal]').textContent = money(summary.subtotal, summary.currency);
      totals.querySelector('[data-shipping]').textContent = money(summary.shipping, summary.currency);
      totals.querySelector('[data-total]').textContent = money(summary.total, summary.currency);
    }

    await renderMiniCart(summary);

    const clear = document.querySelector('[data-clear-cart]');
    if (clear) {
      clear.addEventListener('click', async (event) => {
        event.preventDefault();
        const items = summary.items || [];
        for (const item of items) {
          await api('cart.remove', { product_id: item.product.id });
        }
        renderCartPage();
        renderCartSummary();
      });
    }

    table.querySelectorAll('[data-remove-from-cart]').forEach((link) => {
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        const id = parseInt(link.getAttribute('data-remove-from-cart'), 10);
        await api('cart.remove', { product_id: id });
        renderCartPage();
        renderCartSummary();
      });
    });
  }

  async function renderWishlist() {
    const table = document.querySelector('[data-wishlist-table]');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const data = await api('wishlist.view');

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No items saved to wishlist yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.items
      .map(
        (item) => `
        <tr>
          <td class="product-des product-name">
            <h6 class="mb-5"><a class="product-name mb-10 text-heading" href="shop-product-left.html?id=${item.product.id}">${item.product.name}</a></h6>
            <div class="text-muted small">${item.product.brand || ''}</div>
          </td>
          <td class="price" data-title="Price"><h4 class="text-body">${money(item.price, data.currency)}</h4></td>
          <td class="text-center" data-title="Stock">${item.product.stock > 0 ? 'In stock' : 'Out of stock'}</td>
          <td class="text-right" data-title="Action">
            <div class="d-flex justify-content-end gap-2">
              <a aria-label="Add to cart" class="action-btn small" href="#" data-add-to-cart="${item.product.id}"><i class="fi-rs-shopping-bag-add"></i></a>
              <a aria-label="Remove" class="action-btn small text-danger" href="#" data-remove-wishlist="${item.product.id}"><i class="fi-rs-trash"></i></a>
            </div>
          </td>
        </tr>`
      )
      .join('');

    wireAddToCart(table);
    tbody.querySelectorAll('[data-remove-wishlist]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const id = parseInt(btn.getAttribute('data-remove-wishlist'), 10);
        await api('wishlist.remove', { product_id: id });
        await renderWishlist();
      });
    });
  }

  async function renderCompare() {
    const table = document.querySelector('[data-compare-table]');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const data = await api('compare.view');

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No items to compare.</td></tr>';
      return;
    }

    tbody.innerHTML = data.items
      .map(
        (item) => `
        <tr>
          <td><img src="${item.product.image}" width="80" alt="${item.product.name}"></td>
          <td>
            <h6 class="mb-5"><a class="product-name mb-10 text-heading" href="shop-product-left.html?id=${item.product.id}">${item.product.name}</a></h6>
            <div class="text-muted small">${item.product.category || ''}</div>
          </td>
          <td>${money(item.price, data.currency)}</td>
          <td>${item.product.stock > 0 ? 'In stock' : 'Out of stock'}</td>
          <td class="text-right">
            <div class="d-flex justify-content-end gap-2">
              <a aria-label="Add to cart" class="action-btn small" href="#" data-add-to-cart="${item.product.id}"><i class="fi-rs-shopping-bag-add"></i></a>
              <a aria-label="Remove" class="action-btn small text-danger" href="#" data-remove-compare="${item.product.id}"><i class="fi-rs-cross-small"></i></a>
            </div>
          </td>
        </tr>`
      )
      .join('');

    wireAddToCart(table);
    tbody.querySelectorAll('[data-remove-compare]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const id = parseInt(btn.getAttribute('data-remove-compare'), 10);
        await api('compare.remove', { product_id: id });
        await renderCompare();
      });
    });
  }

  async function renderAccount() {
    const nameTarget = document.querySelector('[data-customer-name]');
    const ordersTable = document.querySelector('[data-customer-orders]');
    const loginForm = document.querySelector('[data-customer-login]');
    const registerForm = document.querySelector('[data-customer-register]');
    const status = document.querySelector('[data-auth-status]');
    const trackForm = document.querySelector('[data-order-track]');
    const userResult = await api('customer.me');
    const user = userResult.user;

    if (nameTarget) {
      nameTarget.textContent = user?.name || 'Guest';
    }

    if (ordersTable) {
      const tbody = ordersTable.querySelector('tbody');
      const result = await api('customer.orders');
      const orders = result.orders || [];
      if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No orders yet.</td></tr>';
      } else {
        tbody.innerHTML = orders
          .map(
            (order) => `
              <tr>
                <td>#${order.id || ''}</td>
                <td>${order.created_at || ''}</td>
                <td>${order.status || 'Completed'}</td>
                <td>${money(order.total, order.currency)} for ${order.items?.length || ''} item(s)</td>
                <td><a href="shop-invoice.html" class="btn-small d-block" data-open-invoice="${order.id || ''}">View</a></td>
              </tr>`
          )
          .join('');
      }
    }

    function bindAuth(form, action) {
      if (!form || form.dataset.bound) return;
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const response = await api(action, data);
        if (response.error && status) {
          status.textContent = response.error;
          status.classList.add('text-danger');
        } else if (status) {
          status.textContent = 'Saved';
          status.classList.remove('text-danger');
          await renderAccount();
        }
      });
      form.dataset.bound = 'true';
    }

    bindAuth(loginForm, 'customer.login');
    bindAuth(registerForm, 'customer.register');

    if (trackForm && !trackForm.dataset.bound) {
      const trackResult = trackForm.querySelector('[data-track-result]');
      trackForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(trackForm).entries());
        const id = parseInt(data['order-id'] || '0', 10);
        if (!id) return;
        const response = await api('order.lookup', { id });
        if (response.error) {
          trackResult.textContent = response.error;
          trackResult.classList.add('text-danger');
        } else if (response.order) {
          trackResult.textContent = `Order #${response.order.id} for ${response.order.customer_name} totals ${money(response.order.total, response.order.currency)}`;
          trackResult.classList.remove('text-danger');
        }
      });
      trackForm.dataset.bound = 'true';
    }
  }

  async function renderCheckout() {
    const form = document.querySelector('[data-checkout-form]');
    if (!form) return;
    const totalsBox = document.querySelector('[data-cart-totals]');
    const status = document.querySelector('[data-checkout-status]');
    const itemsBody = document.querySelector('[data-checkout-items]');
    const summary = await api('cart.view');

    if (itemsBody) {
      if (!summary.items || summary.items.length === 0) {
        itemsBody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">Your order will appear here once you add products to the cart.</td></tr>';
      } else {
        itemsBody.innerHTML = summary.items
          .map(
            (item) => `
            <tr>
              <td class="image product-thumbnail"><img src="${item.product.image}" alt="${item.product.name}"></td>
              <td>
                <h6 class="w-160 mb-5"><a href="shop-product-left.html?id=${item.product.id}" class="text-heading">${item.product.name}</a></h6>
                <div class="text-muted small">${item.product.brand || ''}</div>
              </td>
              <td>
                <h6 class="text-muted pl-20 pr-20">x ${item.quantity}</h6>
              </td>
              <td>
                <h4 class="text-brand">${money(item.line_total, summary.currency)}</h4>
              </td>
            </tr>`
          )
          .join('');
      }
    }

    if (totalsBox) {
      totalsBox.querySelector('[data-subtotal]').textContent = money(summary.subtotal, summary.currency);
      totalsBox.querySelector('[data-shipping]').textContent = money(summary.shipping, summary.currency);
      totalsBox.querySelector('[data-total]').textContent = money(summary.total, summary.currency);
    }

    if (!form.dataset.bound) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        data.customer_name = data.customer_name || [data.fname, data.lname].filter(Boolean).join(' ').trim();
        data.customer_name = data.customer_name || 'Guest';
        data.email = data.email || '';
        data.phone = data.phone || '';
        const result = await api('checkout', data);
        if (result.error) {
          if (status) {
            status.textContent = result.error;
            status.classList.add('text-danger');
          }
        } else if (result.order) {
          if (status) {
            status.textContent = `Order placed! Total ${money(result.order.total, result.order.currency)}`;
            status.classList.remove('text-danger');
          }
          await renderCartSummary();
          await renderCheckout();
        }
      });
      form.dataset.bound = 'true';
    }
  }

  async function renderInvoice() {
    const itemsTable = document.querySelector('[data-invoice-items]');
    if (!itemsTable) return;
    const dateEl = document.querySelector('[data-invoice-date]');
    const numberEl = document.querySelector('[data-invoice-number]');
    const customerEl = document.querySelector('[data-invoice-customer]');
    const contactEl = document.querySelector('[data-invoice-contact]');
    const dueEl = document.querySelector('[data-invoice-due]');
    const paymentEl = document.querySelector('[data-invoice-payment]');
    const subtotalEl = document.querySelector('[data-invoice-subtotal]');
    const shippingEl = document.querySelector('[data-invoice-shipping]');
    const totalEl = document.querySelector('[data-invoice-total]');

    const params = new URLSearchParams(window.location.search);
    const explicitId = parseInt(params.get('id') || '0', 10);
    const response = explicitId ? await api('order.lookup', { id: explicitId }) : await api('order.last');

    if (!response || response.error || !response.order) {
      itemsTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No order available.</td></tr>';
      return;
    }

    const order = response.order;
    if (dateEl) dateEl.textContent = order.created_at || new Date().toLocaleDateString();
    if (numberEl) numberEl.textContent = `#${order.id || 'N/A'}`;
    if (customerEl) customerEl.innerHTML = `<strong>${order.customer_name || 'Customer'}</strong><br />${order.email || ''}<br />${order.phone || ''}`;
    if (contactEl) contactEl.innerHTML = `<strong>${order.email || ''}</strong>`;
    if (dueEl) dueEl.textContent = order.created_at || 'Upon receipt';
    if (paymentEl) paymentEl.textContent = order.payment || 'Online';

    const items = order.items || [];
    itemsTable.innerHTML =
      items
        .map(
          (item) => `
          <tr>
            <td>
              <div class="item-desc-1">
                <span>${item.product.name}</span>
                <small>${item.product.brand || ''}</small>
              </div>
            </td>
            <td class="text-center">${money(item.price, order.currency)}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">${money(item.line_total, order.currency)}</td>
          </tr>`
        )
        .join('') || '<tr><td colspan="4" class="text-center py-4 text-muted">No items</td></tr>';

    if (subtotalEl) subtotalEl.textContent = money(order.subtotal, order.currency);
    if (shippingEl) shippingEl.textContent = money(order.shipping, order.currency);
    if (totalEl) totalEl.textContent = money(order.total, order.currency);
  }

  async function boot() {
    const summary = await renderCartSummary();
    await renderMiniCart(summary);
    await renderFeatured();
    await renderCatalog();
    await renderProductDetail();
    await renderCartPage();
    await renderCheckout();
    await renderWishlist();
    await renderCompare();
    await renderAccount();
    await renderInvoice();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
