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
              <a aria-label="Add To Wishlist" class="action-btn" href="#"><i class="fi-rs-heart"></i></a>
              <a aria-label="Compare" class="action-btn" href="#"><i class="fi-rs-shuffle"></i></a>
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
  }

  async function renderCatalog() {
    const container = document.querySelector('[data-products-grid="catalog"]');
    if (!container) return;
    const products = await getProducts();
    container.innerHTML = products.map(productCard).join('');
    wireAddToCart(container);
  }

  function wireAddToCart(scope = document) {
    scope.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const id = parseInt(btn.getAttribute('data-add-to-cart'), 10);
        if (!id) return;
        await api('cart.add', { product_id: id, quantity: 1 });
        await renderCartSummary();
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

  async function boot() {
    await renderCartSummary();
    await renderFeatured();
    await renderCatalog();
    await renderProductDetail();
    await renderCartPage();
    await renderCheckout();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
