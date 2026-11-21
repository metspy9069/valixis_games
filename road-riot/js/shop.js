// road-riot/js/shop.js – Supercar Shop UI & Persistence Logic
import { loadJSON } from './utils/loadJSON.js';

class Shop {
  constructor() {
    this.modal = null;
    this.carListEl = null;
    this.creditsEl = null;
    this.closeBtn = null;
    this.carsData = [];

    // Initialize or load credits (give generous starter credits if empty so user can buy right away)
    const storedCredits = localStorage.getItem('credits');
    if (storedCredits === null) {
      this.credits = 4500;
      localStorage.setItem('credits', this.credits.toString());
    } else {
      this.credits = parseInt(storedCredits, 10) || 0;
    }

    // Initialize owned cars list
    const storedOwned = localStorage.getItem('ownedCars');
    if (storedOwned === null) {
      this.ownedCars = ['car001']; // Starter car unlocked
      localStorage.setItem('ownedCars', JSON.stringify(this.ownedCars));
    } else {
      try {
        this.ownedCars = JSON.parse(storedOwned);
      } catch (e) {
        this.ownedCars = ['car001'];
      }
    }

    // Auto-init if DOM is already loaded
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.init());
      } else {
        this.init();
      }
    }
  }

  async init() {
    // If standalone page (e.g., shop.html)
    const existingList = document.querySelector('#car-list');
    if (existingList) {
      this.carListEl = existingList;
      this.creditsEl = document.querySelector('#shop-credits-display');
      this.closeBtn = document.querySelector('#close-shop');
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = './index.html';
          }
        });
      }
      this.updateCreditsDisplay();
      await this.loadAndRenderCars();
      return;
    }

    // If running inside main game (road-riot/index.html), build modal wrapper
    if (!this.modal && typeof document !== 'undefined') {
      this.modal = document.createElement('div');
      this.modal.id = 'road-riot-shop-modal';
      this.modal.className = 'shop-modal-wrapper';
      this.modal.style.display = 'none';

      this.modal.innerHTML = `
        <div class="shop-container">
          <header class="shop-header">
            <div class="shop-title-group">
              <h1>SUPERCAR SHOP</h1>
              <div class="shop-subtitle">Official Highway Motors Showroom</div>
            </div>
            <div class="shop-credits-badge">
              <span>CREDITS:</span>
              <span id="shop-credits-display">${this.credits.toLocaleString()}</span>
            </div>
          </header>
          <div id="car-list" class="car-list"></div>
          <footer class="shop-footer">
            <span style="font-family:'JetBrains Mono',monospace; font-size:0.75rem; color:#94a3b8;">
              Purchased cars are permanently saved in your highway garage.
            </span>
            <button id="close-shop" class="close-btn">&larr; BACK TO GAME</button>
          </footer>
        </div>
      `;

      document.body.appendChild(this.modal);
      this.carListEl = this.modal.querySelector('#car-list');
      this.creditsEl = this.modal.querySelector('#shop-credits-display');
      this.closeBtn = this.modal.querySelector('#close-shop');
      this.closeBtn?.addEventListener('click', () => this.hide());

      // Close when clicking outside container
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.hide();
      });

      await this.loadAndRenderCars();
    }
  }

  async loadAndRenderCars() {
    try {
      const data = await loadJSON('./data/cars.json');
      this.carsData = Array.isArray(data) ? data : (data.cars || []);
      this.renderCars();
    } catch (err) {
      console.warn('Shop: relative ./data/cars.json fetch failed, trying fallback path...', err);
      try {
        const fallback = await loadJSON('../data/cars.json');
        this.carsData = Array.isArray(fallback) ? fallback : (fallback.cars || []);
        this.renderCars();
      } catch (err2) {
        console.error('Failed to load cars.json', err2);
      }
    }
  }

  updateCreditsDisplay() {
    if (this.creditsEl) {
      this.creditsEl.textContent = this.credits.toLocaleString();
    }
  }

  renderCars() {
    if (!this.carListEl) return;
    this.carListEl.innerHTML = '';

    this.carsData.forEach(car => {
      const isOwned = this.ownedCars.includes(car.id);
      const card = document.createElement('div');
      card.className = `car-card ${isOwned ? 'owned' : ''}`;

      card.innerHTML = `
        <div class="car-card-header">
          <div class="car-badge-tier">${car.tier || 'SUPERCAR'}</div>
          <h3 class="car-card-title">${car.name}</h3>
        </div>
        <div class="car-specs-grid">
          <div class="spec-item">TOP SPEED:</div>
          <div class="spec-val">${car.baseSpeed} KM/H</div>
          <div class="spec-item">ACCEL:</div>
          <div class="spec-val">${car.acceleration || '8.5'} / 10</div>
          <div class="spec-item">HANDLING:</div>
          <div class="spec-val">${car.handling || '8.0'} / 10</div>
        </div>
        <div class="car-card-price">
          ${isOwned ? '<span style="color:#00ff88; font-weight:900;">OWNED &bull; UNLOCKED</span>' : `${car.price.toLocaleString()} <span>CR</span>`}
        </div>
        <button class="shop-action-btn ${isOwned ? 'btn-owned' : 'btn-buy'}" ${isOwned ? 'disabled' : ''}>
          ${isOwned ? '&#10003; IN GARAGE' : 'BUY VEHICLE'}
        </button>
      `;

      const btn = card.querySelector('.shop-action-btn');
      if (!isOwned) {
        btn.addEventListener('click', () => this.purchase(car));
      }

      this.carListEl.appendChild(card);
    });
  }

  purchase(car) {
    if (this.credits >= car.price) {
      this.credits -= car.price;
      this.ownedCars.push(car.id);
      localStorage.setItem('credits', this.credits.toString());
      localStorage.setItem('ownedCars', JSON.stringify(this.ownedCars));

      this.updateCreditsDisplay();
      this.renderCars();
      this.showToast(`PURCHASE COMPLETE: ${car.name.toUpperCase()} UNLOCKED!`);

      // Play audio cue if game audio is available
      if (window.audio && typeof window.audio.play === 'function') {
        window.audio.play('fever');
      }
    } else {
      const needed = car.price - this.credits;
      this.showToast(`INSUFFICIENT CREDITS! NEED ${needed.toLocaleString()} MORE CR`);
    }
  }

  showToast(message) {
    const existing = document.querySelector('.shop-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'shop-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 2800);
  }

  show() {
    if (!this.modal) {
      this.init().then(() => {
        if (this.modal) this.modal.style.display = 'flex';
      });
    } else {
      this.updateCreditsDisplay();
      this.renderCars();
      this.modal.style.display = 'flex';
    }
  }

  hide() {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }
}

export const shop = new Shop();
if (typeof window !== 'undefined') {
  window.shop = shop;
}
