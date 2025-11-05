// Fallback rates for full offline support
const FALLBACK_RATES = {
  USD: 13000, // 1 USD = 13000 UZS
  RUB: 140    // 1 RUB = 140 UZS
};

let liveRates = { ...FALLBACK_RATES };
let usingFallback = true;

const amountEl = document.getElementById('amount');
const currencyEl = document.getElementById('currency');
const convertBtn = document.getElementById('convertBtn');
const resultEl = document.getElementById('result');
const statusEl = document.getElementById('status');

function fetchWithTimeout(url, options = {}, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Request timed out')), timeout);
    fetch(url, options)
      .then(res => {
        clearTimeout(id);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(id);
        reject(err);
      });
  });
}

async function loadRates() {
  // Try cache first (for offline repeated usage)
  const cached = localStorage.getItem('liveRates');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed.USD === 'number' && typeof parsed.RUB === 'number') {
        liveRates = parsed;
        usingFallback = false;
        statusEl.textContent = 'Keshlangan kurslar yuklandi (oxirgi onlayn).';
      }
    } catch (_) {
      // ignore cache parse errors
    }
  }

  // Attempt live fetch from USD base (compute RUB via cross-rate)
  try {
    const res = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', {}, 4000);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();

    if (data && data.result === 'success' && data.rates && data.rates.UZS && data.rates.RUB) {
      const usdToUzs = data.rates.UZS;    // UZS per 1 USD
      const usdToRub = data.rates.RUB;    // RUB per 1 USD
      const rubToUzs = usdToUzs / usdToRub; // UZS per 1 RUB

      liveRates = {
        USD: usdToUzs,
        RUB: rubToUzs
      };
      usingFallback = false;

      // Cache for offline reuse
      localStorage.setItem('liveRates', JSON.stringify(liveRates));

      statusEl.textContent = 'Live kurslar yuklandi ✅';
    } else {
      throw new Error('API schema unexpected');
    }
  } catch (err) {
    // If we already had cache, keep it; otherwise fallback constants
    if (!cached) {
      liveRates = { ...FALLBACK_RATES };
      usingFallback = true;
      statusEl.textContent = 'API mavjud emas. Fallback kurslar ishlatilmoqda (offline).';
    } else {
      // We have cache but live failed
      usingFallback = false;
      statusEl.textContent = 'Live olish muvaffaqiyatsiz, keshlangan kurslar ishlatilmoqda.';
    }
  }

  // Show online/offline hint
  if (!navigator.onLine) {
    statusEl.textContent += ' | Offline rejim.';
  }
}

function formatUZS(value) {
  try {
    return value.toLocaleString('uz-UZ') + ' so‘m';
  } catch {
    return value.toLocaleString() + ' so‘m';
  }
}

function convert() {
  const raw = amountEl.value.trim();
  const amount = Number(raw);

  if (!raw || Number.isNaN(amount)) {
    resultEl.textContent = 'Iltimos, to‘g‘ri miqdor kiriting.';
    return;
  }
  if (amount < 0) {
    resultEl.textContent = 'Miqdor manfiy bo‘lishi mumkin emas.';
    return;
  }

  const currency = currencyEl.value;
  const rate = (usingFallback ? FALLBACK_RATES[currency] : liveRates[currency]) ?? FALLBACK_RATES[currency];

  const uzs = amount * rate;
  resultEl.textContent = `${amount} ${currency} ≈ ${formatUZS(Math.round(uzs))}`;
}

document.addEventListener('DOMContentLoaded', () => {
  loadRates();

  convertBtn.addEventListener('click', convert);
  amountEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') convert();
  });
});