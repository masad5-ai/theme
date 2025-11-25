/**
 * Minimal fetch helpers to connect the static templates to the PHP API.
 * Include this script in your HTML and call `Storefront.renderFeatured()`
 * to populate a container with ID `featured-products`.
 */
const Storefront = (() => {
  const apiBase = '/backend/api.php';

  async function request(action, body) {
    const method = body ? 'POST' : 'GET';
    const url = method === 'GET' ? `${apiBase}?action=${action}` : `${apiBase}?action=${action}`;
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }

  async function renderFeatured() {
    const container = document.getElementById('featured-products');
    if (!container) return;

    const data = await request('products');
    const products = (data.products || []).filter(p => p.featured);
    container.innerHTML = products.map(product => `
      <div class="col-md-4">
        <div class="card h-100">
          <img src="/${product.image}" class="card-img-top" alt="${product.name}">
          <div class="card-body">
            <h5 class="card-title">${product.name}</h5>
            <p class="card-text">${product.description}</p>
            <div class="d-flex justify-content-between align-items-center">
              <span class="fw-bold">${product.price} ${product.currency || 'AUD'}</span>
              <button class="btn btn-sm btn-primary" data-product="${product.id}">Add to cart</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('button[data-product]').forEach(button => {
      button.addEventListener('click', async () => {
        await addToCart(parseInt(button.dataset.product, 10));
      });
    });
  }

  async function addToCart(productId, quantity = 1) {
    await request('cart.add', { product_id: productId, quantity });
  }

  return { renderFeatured, addToCart };
})();

window.Storefront = Storefront;
