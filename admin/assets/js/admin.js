(function () {
  const apiBase = window.ADMIN_API_BASE || '../backend/api.php';

  async function api(action, body) {
    const method = body ? 'POST' : 'GET';
    const response = await fetch(`${apiBase}?action=${action}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    return response.json();
  }

  async function ensureLogin(credentials) {
    if (!credentials || !credentials.username || !credentials.password) return false;
    const result = await api('admin.login', credentials);
    return !result.error;
  }

  function bindLoginForm() {
    const form = document.querySelector('[data-admin-login]');
    if (!form || form.dataset.bound) return;
    const status = document.querySelector('[data-admin-login-status]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const ok = await ensureLogin({ username: data.username, password: data.password });
      if (ok) {
        if (status) {
          status.textContent = 'Logged in';
          status.classList.remove('text-danger');
        }
        window.location.href = form.dataset.redirect || 'index.html';
      } else if (status) {
        status.textContent = 'Invalid credentials';
        status.classList.add('text-danger');
      }
    });
    form.dataset.bound = 'true';
  }

  function money(value, currency = 'AUD') {
    return `${currency} ${Number(value || 0).toFixed(2)}`;
  }

  async function renderProducts() {
    const listTargets = document.querySelectorAll('[data-admin-products]');
    if (!listTargets.length) return;
    const data = await api('products');
    const products = data.products || [];

    listTargets.forEach((target) => {
      const asCards = target.dataset.layout === 'cards';
      if (asCards) {
        target.innerHTML = products
          .map(
            (product) => `
              <div class="col">
                <div class="card card-product-grid">
                  <a href="#" class="img-wrap"><img src="${product.image}" alt="${product.name}" /></a>
                  <div class="info-wrap">
                    <a class="title" href="#">${product.name}</a>
                    <div class="price">${money(product.price, product.currency)}</div>
                    <div class="text-muted small">${product.brand || ''}</div>
                  </div>
                </div>
              </div>`
          )
          .join('');
      } else {
        target.innerHTML = products
          .map(
            (product) => `
            <article class="itemlist">
              <div class="row align-items-center">
                <div class="col col-check flex-grow-0">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${product.id}" />
                  </div>
                </div>
                <div class="col-lg-4 col-sm-4 col-8 flex-grow-1 col-name">
                  <a class="itemside" href="#">
                    <div class="left">
                      <img src="${product.image}" class="img-sm img-thumbnail" alt="${product.name}" />
                    </div>
                    <div class="info">
                      <h6 class="mb-0">${product.name}</h6>
                    </div>
                  </a>
                </div>
                <div class="col-lg-2 col-sm-2 col-4 col-price"><span>${money(product.price, product.currency)}</span></div>
                <div class="col-lg-2 col-sm-2 col-4 col-status">
                  <span class="badge rounded-pill alert-${product.stock > 0 ? 'success' : 'danger'}">${product.stock > 0 ? 'In stock' : 'Out'}</span>
                </div>
                <div class="col-lg-1 col-sm-2 col-4 col-date"><span>${product.category || ''}</span></div>
                <div class="col-lg-2 col-sm-2 col-4 col-action text-end">
                  <a href="#" class="btn btn-sm font-sm rounded btn-brand"> <i class="material-icons md-edit"></i> Edit </a>
                </div>
              </div>
            </article>`
          )
          .join('');
      }
    });

    const counters = document.querySelectorAll('[data-admin-count="products"]');
    counters.forEach((el) => (el.textContent = products.length.toString()));
  }

  async function renderOrders() {
    const orderTables = document.querySelectorAll('[data-admin-orders]');
    if (!orderTables.length) return;
    const result = await api('admin.orders');
    if (result.error) {
      orderTables.forEach((tbl) => {
        tbl.innerHTML = `<tr><td colspan="8" class="text-center text-danger">${result.error}</td></tr>`;
      });
      return;
    }
    const orders = result.orders || [];
    orderTables.forEach((tbody) => {
      tbody.innerHTML = orders
        .map(
          (order) => `
            <tr>
              <td>${order.id || ''}</td>
              <td>${order.customer_name || ''}</td>
              <td>${order.email || ''}</td>
              <td>${order.phone || ''}</td>
              <td>${money(order.subtotal, order.currency)}</td>
              <td>${money(order.shipping, order.currency)}</td>
              <td><b>${money(order.total, order.currency)}</b></td>
              <td>${order.created_at || ''}</td>
            </tr>`
        )
        .join('');
    });

    const counters = document.querySelectorAll('[data-admin-count="orders"]');
    counters.forEach((el) => (el.textContent = orders.length.toString()));
  }

  async function renderCategories() {
    const targets = document.querySelectorAll('[data-admin-categories]');
    if (!targets.length) return;
    const data = await api('categories');
    const categories = data.categories || [];
    targets.forEach((tbody) => {
      tbody.innerHTML = categories
        .map(
          (cat, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${cat.name}</td>
              <td>${cat.products}</td>
              <td>${new Date().toISOString().split('T')[0]}</td>
            </tr>`
        )
        .join('');
    });
  }

  async function renderBrands() {
    const targets = document.querySelectorAll('[data-admin-brands]');
    if (!targets.length) return;
    const data = await api('brands');
    const brands = data.brands || [];
    targets.forEach((tbody) => {
      tbody.innerHTML = brands
        .map(
          (brand, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${brand.name}</td>
              <td>${brand.products}</td>
            </tr>`
        )
        .join('');
    });
  }

  async function renderCustomers() {
    const targets = document.querySelectorAll('[data-admin-customers]');
    if (!targets.length) return;
    const data = await api('admin.customers');
    if (data.error) {
      targets.forEach((tbody) => (tbody.innerHTML = `<tr><td colspan="4" class="text-danger">${data.error}</td></tr>`));
      return;
    }
    const customers = data.customers || [];
    targets.forEach((tbody) => {
      tbody.innerHTML = customers
        .map(
          (customer) => `
            <tr>
              <td>${customer.id}</td>
              <td>${customer.name || ''}</td>
              <td>${customer.email}</td>
              <td>${customer.created_at || ''}</td>
            </tr>`
        )
        .join('');
    });
  }

  async function renderDashboard() {
    await renderProducts();
    await renderOrders();
    await renderCategories();
    await renderBrands();
    await renderCustomers();
  }

  async function boot() {
    bindLoginForm();
    await renderDashboard();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
