const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const DELIVERY_FEE = 29;
const FREE_DELIVERY_THRESHOLD = 499;
const PACKAGING_FEE = 8;
const state = {
  menu: [],
  cart: new Map(),
  favorites: new Set(),
  category: "All",
  search: "",
  savedOnly: false,
  fulfillment: "delivery",
  promoApplied: false,
  sort: "featured",
};

try {
  const savedCart = JSON.parse(localStorage.getItem("supper-club-cart") || "[]");
  savedCart.forEach(([id, quantity]) => {
    if (Number.isInteger(quantity) && quantity > 0) state.cart.set(id, Math.min(quantity, 25));
  });
  state.favorites = new Set(JSON.parse(localStorage.getItem("supper-club-favorites") || "[]"));
  state.fulfillment = localStorage.getItem("supper-club-fulfillment") === "pickup" ? "pickup" : "delivery";
} catch {
  localStorage.removeItem("supper-club-cart");
  localStorage.removeItem("supper-club-favorites");
}

const elements = {
  grid: document.querySelector("#menu-grid"),
  empty: document.querySelector("#empty-state"),
  search: document.querySelector("#search"),
  count: document.querySelector("#cart-count"),
  bagCount: document.querySelector("#bag-item-count"),
  items: document.querySelector("#cart-items"),
  cartEmpty: document.querySelector("#cart-empty"),
  bill: document.querySelector("#bill"),
  checkout: document.querySelector("#checkout"),
  mobileBag: document.querySelector("#mobile-bag"),
  toast: document.querySelector("#toast"),
};

function saveState() {
  try {
    localStorage.setItem("supper-club-cart", JSON.stringify([...state.cart.entries()].filter(([id]) => state.menu.some((dish) => dish.id === id))));
    localStorage.setItem("supper-club-favorites", JSON.stringify([...state.favorites]));
    localStorage.setItem("supper-club-fulfillment", state.fulfillment);
  } catch {
    // Browsing continues normally when storage is unavailable.
  }
}

const money = (amount) => currency.format(amount);
const photoUrl = (photo, width = 600) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=80`;
const cartQuantity = () => [...state.cart.values()].reduce((sum, quantity) => sum + quantity, 0);

function renderMenu() {
  const search = state.search.trim().toLowerCase();
  const visible = state.menu.filter((dish) => {
    const matchesCategory = state.category === "All" || dish.category === state.category;
    const matchesSearch = !search || `${dish.name} ${dish.description} ${dish.category}`.toLowerCase().includes(search);
    return matchesCategory && matchesSearch && (!state.savedOnly || state.favorites.has(dish.id));
  });
  const fastestMinutes = (dish) => Number.parseInt(dish.time, 10) || 999;
  if (state.sort === "rating") visible.sort((a, b) => b.rating - a.rating);
  if (state.sort === "price-low") visible.sort((a, b) => a.price - b.price);
  if (state.sort === "price-high") visible.sort((a, b) => b.price - a.price);
  if (state.sort === "fastest") visible.sort((a, b) => fastestMinutes(a) - fastestMinutes(b));

  elements.grid.innerHTML = visible.map((dish, index) => `
    <article class="dish-card" style="animation-delay:${Math.min(index * 45, 180)}ms">
      <div class="dish-image-wrap">
        <img class="dish-image" src="${photoUrl(dish.image)}" alt="${dish.name}" loading="lazy" />
        <span class="dish-badge">${dish.badge}</span>
        <button class="favorite-button ${state.favorites.has(dish.id) ? "active" : ""}" type="button" data-favorite="${dish.id}" aria-label="${state.favorites.has(dish.id) ? "Remove" : "Save"} ${dish.name}" aria-pressed="${state.favorites.has(dish.id)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>
        </button>
      </div>
      <div class="dish-content">
        <div class="dish-meta"><span>${dish.time}</span><span class="dish-rating"><span>★</span> ${dish.rating.toFixed(1)}</span></div>
        <h3 title="${dish.name}">${dish.name}</h3>
        <p class="dish-description">${dish.description}</p>
        <div class="dish-footer"><span class="dish-price">${money(dish.price)}</span><button class="add-button" type="button" data-add="${dish.id}" aria-label="Add ${dish.name} to bag">+</button></div>
      </div>
    </article>`).join("");

  elements.empty.hidden = visible.length > 0;
  elements.grid.hidden = visible.length === 0;
  document.querySelector("#results-label").textContent = state.savedOnly ? "Your saved favorites" : search || state.category !== "All" ? `${visible.length} delicious ${visible.length === 1 ? "find" : "finds"}` : "All the neighborhood favorites";
  document.querySelector("#clear-filters").hidden = !search && state.category === "All" && !state.savedOnly;
}

function cartTotals() {
  const subtotal = [...state.cart.entries()].reduce((sum, [id, quantity]) => {
    const dish = state.menu.find((item) => item.id === id);
    return sum + dish.price * quantity;
  }, 0);
  const discount = state.promoApplied ? Math.min(Math.round(subtotal * 0.1), 100) : 0;
  const fee = state.fulfillment === "delivery" && subtotal && subtotal < FREE_DELIVERY_THRESHOLD ? DELIVERY_FEE : 0;
  const packaging = subtotal ? PACKAGING_FEE : 0;
  const gst = Math.round((subtotal - discount) * 0.05);
  return { subtotal, fee, packaging, gst, discount, total: subtotal - discount + fee + packaging + gst };
}

function renderCart() {
  const quantity = cartQuantity();
  const { subtotal, fee, packaging, gst, discount, total } = cartTotals();
  elements.count.textContent = quantity;
  elements.bagCount.textContent = `(${quantity})`;
  document.querySelector("#mobile-bag-count").textContent = `${quantity} ${quantity === 1 ? "item" : "items"}`;
  document.querySelector("#mobile-bag-total").innerHTML = `${money(total)} <span aria-hidden="true">→</span>`;
  elements.checkout.disabled = quantity === 0;
  elements.cartEmpty.hidden = quantity > 0;
  elements.items.hidden = quantity === 0;
  elements.bill.hidden = quantity === 0;
  elements.items.innerHTML = [...state.cart.entries()].map(([id, count]) => {
    const dish = state.menu.find((item) => item.id === id);
    return `<div class="cart-line"><div><div class="cart-line-name">${dish.name}</div><div class="cart-line-price">${money(dish.price * count)}</div></div><div class="quantity-controls"><button type="button" data-quantity="${id}" data-change="-1" aria-label="Remove one ${dish.name}">−</button><span>${count}</span><button type="button" data-quantity="${id}" data-change="1" aria-label="Add one ${dish.name}">+</button></div></div>`;
  }).join("");
  document.querySelector("#subtotal").textContent = money(subtotal);
  document.querySelector("#delivery-fee").textContent = money(fee);
  document.querySelector("#packaging-fee").textContent = money(packaging);
  document.querySelector("#gst").textContent = money(gst);
  document.querySelector("#fee-label").textContent = state.fulfillment === "pickup" ? "Pickup" : "Delivery fee";
  document.querySelector("#discount-line").hidden = discount === 0;
  document.querySelector("#discount").textContent = `−${money(discount)}`;
  document.querySelector("#total").textContent = money(total);
  document.querySelector("#estimate-copy").innerHTML = state.fulfillment === "pickup" ? "<strong>20–25 min</strong><small>Estimated pickup</small>" : "<strong>35–45 min</strong><small>Estimated delivery</small>";
  saveState();
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2100);
}

function setCartOpen(open) {
  document.body.classList.toggle("cart-open", open);
  document.querySelector("#open-cart").setAttribute("aria-expanded", String(open));
}

document.querySelector("#categories").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip === button));
  renderMenu();
});

elements.search.addEventListener("input", () => {
  state.search = elements.search.value;
  renderMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.search.focus();
  }
  if (event.key === "Escape") setCartOpen(false);
});

elements.grid.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  const favoriteButton = event.target.closest("[data-favorite]");
  if (addButton) {
    const id = addButton.dataset.add;
    state.cart.set(id, (state.cart.get(id) || 0) + 1);
    addButton.classList.remove("bump");
    void addButton.offsetWidth;
    addButton.classList.add("bump");
    renderCart();
    showToast(`${state.menu.find((dish) => dish.id === id).name} added to your bag`);
  }
  if (favoriteButton) {
    const id = favoriteButton.dataset.favorite;
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    saveState();
    renderMenu();
  }
});

elements.items.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quantity]");
  if (!button) return;
  const id = button.dataset.quantity;
  const next = (state.cart.get(id) || 0) + Number(button.dataset.change);
  if (next <= 0) state.cart.delete(id);
  else state.cart.set(id, next);
  renderCart();
});

document.querySelectorAll("[data-fulfillment]").forEach((button) => {
  button.addEventListener("click", () => {
    state.fulfillment = button.dataset.fulfillment;
    document.querySelectorAll("[data-fulfillment]").forEach((option) => option.classList.toggle("selected", option === button));
    renderCart();
  });
});

document.querySelector("#sort-menu").addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderMenu();
});

document.querySelector("#apply-promo").addEventListener("click", () => {
  const input = document.querySelector("#promo-code");
  const message = document.querySelector("#promo-message");
  if (input.value.trim().toUpperCase() === "FIRSTBITE") {
    state.promoApplied = true;
    message.textContent = "Nice! 10% off your food, up to ₹100.";
    message.classList.remove("error");
  } else {
    state.promoApplied = false;
    message.textContent = "That code didn't quite land. Try FIRSTBITE.";
    message.classList.add("error");
  }
  renderCart();
});

document.querySelector("#promo-code").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    document.querySelector("#apply-promo").click();
  }
});

document.querySelector("#saved-filter").addEventListener("click", (event) => {
  state.savedOnly = !state.savedOnly;
  event.currentTarget.classList.toggle("active", state.savedOnly);
  renderMenu();
  document.querySelector("#menu").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#clear-filters").addEventListener("click", () => {
  state.search = "";
  state.category = "All";
  state.savedOnly = false;
  elements.search.value = "";
  document.querySelector("#saved-filter").classList.remove("active");
  document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.category === "All"));
  renderMenu();
});

document.querySelector("#open-cart").addEventListener("click", () => setCartOpen(true));
document.querySelector("#mobile-bag").addEventListener("click", () => setCartOpen(true));
document.querySelector("#close-cart").addEventListener("click", () => setCartOpen(false));
document.querySelector("#cart-backdrop").addEventListener("click", () => setCartOpen(false));

const checkoutDialog = document.querySelector("#checkout-dialog");
const orderDialog = document.querySelector("#order-dialog");
elements.checkout.addEventListener("click", () => {
  if (!state.cart.size) return;
  setCartOpen(false);
  const isPickup = state.fulfillment === "pickup";
  document.querySelector("#checkout-intro").textContent = isPickup ? "Where should we send your ready-for-pickup update?" : "Where should we bring the good stuff?";
  document.querySelector("#delivery-fields").hidden = isPickup;
  document.querySelector("#customer-address").required = !isPickup;
  document.querySelector("#customer-pincode").required = !isPickup;
  document.querySelector("#customer-address").placeholder = isPickup ? "Pickup contact address" : "12th Main Road, Indiranagar";
  document.querySelector("#form-error").textContent = "";
  checkoutDialog.showModal();
});

document.querySelector("#dialog-close").addEventListener("click", () => checkoutDialog.close());
document.querySelector("#order-close").addEventListener("click", () => orderDialog.close());
document.querySelector("#order-done").addEventListener("click", () => orderDialog.close());

document.querySelector("#checkout-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector("[type=submit]");
  const error = document.querySelector("#form-error");
  submitButton.disabled = true;
  error.textContent = "";
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.querySelector("#customer-name").value.trim(),
        address: document.querySelector("#customer-address").value.trim(),
        phone: document.querySelector("#customer-phone").value.trim(),
        pincode: document.querySelector("#customer-pincode").value.trim(),
        fulfillment: state.fulfillment,
        promo_code: state.promoApplied ? "FIRSTBITE" : "",
        items: [...state.cart.entries()].map(([id, quantity]) => ({ id, quantity })),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn't place that order. Please try again.");
    checkoutDialog.close();
    document.querySelector("#order-number").textContent = `#${result.id}`;
    document.querySelector("#order-summary").textContent = result.fulfillment === "pickup"
      ? `Pickup order for ${result.name} · ${money(result.total)}`
      : `Delivery order for ${result.name} · ${money(result.total)} · PIN ${result.pincode}`;
    document.querySelector("#order-eta").textContent = result.eta;
    orderDialog.showModal();
    state.cart.clear();
    state.promoApplied = false;
    document.querySelector("#promo-code").value = "";
    document.querySelector("#promo-message").textContent = "";
    renderCart();
    event.currentTarget.reset();
  } catch (requestError) {
    error.textContent = requestError.message;
  } finally {
    submitButton.disabled = false;
  }
});

async function initialize() {
  try {
    const response = await fetch("/api/menu");
    if (!response.ok) throw new Error("Menu unavailable");
    state.menu = await response.json();
    document.querySelectorAll("[data-fulfillment]").forEach((option) => {
      option.classList.toggle("selected", option.dataset.fulfillment === state.fulfillment);
    });
    renderMenu();
    renderCart();
  } catch {
    elements.grid.innerHTML = "<p class=\"menu-footnote\">The menu couldn't load. Refresh to try again.</p>";
  }
}

initialize();