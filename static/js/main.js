// ============================================================================
// LOANGU ARD AI — Frontend JavaScript
// ============================================================================
// THIS FILE HANDLES:
//   1. Animated particle background
//   2. Multi-step form navigation + validation
//   3. New customer toggle behavior
//   4. DTI calculator helper
//   5. Credit score visual indicator
//   6. Sending data to the Flask API and receiving predictions
//   7. Rendering results: gauge, radar chart, bar chart, factor cards
//
// KEY CONCEPT — HOW FRONTEND TALKS TO BACKEND:
//   We use the Fetch API — a modern browser built-in for HTTP requests.
//   fetch('/predict', { method: 'POST', body: JSON.stringify(data) })
//   This sends form data to our Flask /predict endpoint and receives JSON back.
// ============================================================================

// ── CURRENT FORM STATE ────────────────────────────────────────────────────
let currentStep = 1;
let radarChart = null;
let importanceChart = null;
let gaugeAnimFrame = null;

// ═════════════════════════════════════════════════════════════════════════
// CURRENCY SELECTOR
// ============================================================================
// Currency configuration: symbol, code, and display format
const currencyConfig = {
  USD: { symbol: '$', code: 'USD', label: 'USD ($)' },
  EUR: { symbol: '€', code: 'EUR', label: 'EUR (€)' },
  GBP: { symbol: '£', code: 'GBP', label: 'GBP (£)' },
  INR: { symbol: '₹', code: 'INR', label: 'INR (₹)' },
  JPY: { symbol: '¥', code: 'JPY', label: 'JPY (¥)' },
  AUD: { symbol: 'A$', code: 'AUD', label: 'AUD (A$)' }
};

let selectedCurrency = 'USD';

/**
 * Update all monetary labels and placeholders to reflect the selected currency
 */
function updateCurrencyLabels() {
  const currency = currencyConfig[selectedCurrency];
  const { symbol, code } = currency;

  // Update form field labels (Annual Income and Loan Amount)
  const updateLabel = (fieldId, baseLabel) => {
    const field = document.getElementById(fieldId);
    if (!field) return;

    // Find the parent form-group and locate the label
    const formGroup = field.closest('.form-group');
    if (formGroup) {
      const label = formGroup.querySelector('label');
      if (label) {
        label.innerHTML = `${baseLabel} (${code}) <span class="required">*</span>`;
      }
    }
  };

  updateLabel('annual_income', 'Annual Income');
  updateLabel('loan_amount', 'Loan Amount');

  // Update placeholders
  const placeholders = {
    'annual_income': `e.g. 65000 ${code}`,
    'loan_amount': `e.g. 15000 ${code}`,
    'monthly_debt': `Monthly Debt (${code})`,
    'monthly_income': `Monthly Income (${code})`
  };

  Object.entries(placeholders).forEach(([fieldId, placeholderText]) => {
    const field = document.getElementById(fieldId);
    if (field) field.placeholder = placeholderText;
  });

  // Update loan amount hint
  const loanAmountField = document.getElementById('loan_amount');
  if (loanAmountField) {
    const formGroup = loanAmountField.closest('.form-group');
    if (formGroup) {
      const hint = formGroup.querySelector('.field-hint');
      if (hint) {
        hint.textContent = `In ${code}`;
      }
    }
  }
}

/**
 * Initialize currency from localStorage and set up event listener
 */
(function initCurrency() {
  // Get saved currency or default to USD
  selectedCurrency = localStorage.getItem('selectedCurrency') || 'USD';

  const currencySelect = document.getElementById('currency-select');
  if (currencySelect) {
    currencySelect.value = selectedCurrency;

    // Update labels on page load
    updateCurrencyLabels();

    // Listen for currency changes
    currencySelect.addEventListener('change', (e) => {
      selectedCurrency = e.target.value;
      localStorage.setItem('selectedCurrency', selectedCurrency);
      updateCurrencyLabels();
    });
  }
})();

// ═════════════════════════════════════════════════════════════════════════
// 1. PARTICLE BACKGROUND
// =============================================================================
// CONCEPT: Canvas API lets us draw 2D graphics programmatically.
// We create floating "particles" (small dots) that drift around the screen,
// giving the background a dynamic, high-tech feel.
// ============================================================================
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');

  let particles = [];
  const PARTICLE_COUNT = 60;

  // Resize canvas to fill the window
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Create a single particle with random properties
  function createParticle() {
    return {
      x:    Math.random() * canvas.width,
      y:    Math.random() * canvas.height,
      vx:   (Math.random() - 0.5) * 0.4,   // velocity X
      vy:   (Math.random() - 0.5) * 0.4,   // velocity Y
      r:    Math.random() * 2 + 0.5,        // radius
      alpha: Math.random() * 0.4 + 0.1      // opacity
    };
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(createParticle());

  // Draw a single frame: move particles + draw lines between close ones
  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around screen edges (toroidal topology)
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width)  p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      // Draw particle dot — gold tint for bank theme
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201, 168, 76, ${p.alpha})`;
      ctx.fill();

      // Draw connecting lines between nearby particles (creates "web" effect)
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dist = Math.hypot(p.x - q.x, p.y - q.y);
        if (dist < 120) {
          // Opacity fades as distance increases
          const lineAlpha = (1 - dist / 120) * 0.12;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(30, 86, 200, ${lineAlpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(drawFrame);  // Loop at ~60fps
  }

  drawFrame();
})();


// ═════════════════════════════════════════════════════════════════════════
// 2. MULTI-STEP FORM NAVIGATION
// ============================================================================
// We show one step at a time. The progress bar updates to show which step
// the user is on. Before advancing, we validate required fields in the current step.
// ============================================================================

/**
 * Navigate to a specific form step.
 * @param {number} step - Target step number (1, 2, or 3)
 */
function nextStep(step) {
  // Validate current step before advancing
  if (step > currentStep && !validateStep(currentStep)) return;

  // Hide current step
  document.getElementById(`step-${currentStep}`).classList.remove('active');
  document.querySelector(`.progress-step[data-step="${currentStep}"]`).classList.remove('active');
  if (step > currentStep) {
    document.querySelector(`.progress-step[data-step="${currentStep}"]`).classList.add('done');
  }

  currentStep = step;

  // Show new step
  document.getElementById(`step-${currentStep}`).classList.add('active');
  document.querySelector(`.progress-step[data-step="${currentStep}"]`).classList.add('active');
  if (step < 3) {
    document.querySelector(`.progress-step[data-step="${step + 1}"]`)?.classList.remove('done');
  }

  // Scroll to form
  document.getElementById('assess').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Validate required fields in the current step.
 * Shows error styling on missing/invalid fields.
 * @param {number} step
 * @returns {boolean} true if valid, false if not
 */
function validateStep(step) {
  const stepEl = document.getElementById(`step-${step}`);
  const required = stepEl.querySelectorAll('[required]');
  let valid = true;

  required.forEach(field => {
    // Remove previous error state
    field.classList.remove('error');
    const old = field.parentElement.querySelector('.error-msg');
    if (old) old.remove();

    if (!field.value.trim()) {
      field.classList.add('error');
      const msg = document.createElement('span');
      msg.className = 'error-msg';
      msg.textContent = 'This field is required';
      field.parentElement.after(msg);
      valid = false;
    }
  });

  if (!valid) {
    // Shake the form card for visual feedback
    const card = stepEl.querySelector('.form-card');
    card.style.animation = 'none';
    setTimeout(() => { card.style.animation = ''; }, 10);
  }

  return valid;
}


// ═════════════════════════════════════════════════════════════════════════
// 3. NEW CUSTOMER TOGGLE
// ============================================================================
// When "is_new_customer" is checked:
//   - Show the cold-start notice
//   - Remove "required" from credit history fields (they become optional)
//   - Grey out the credit fields to indicate they're being estimated
// ============================================================================
const newCustomerToggle = document.getElementById('is_new_customer');
const newCustomerNotice = document.getElementById('new-customer-notice');
const toggleCard        = document.getElementById('new-customer-toggle-card');
const creditFields      = ['credit_score', 'num_delinquencies', 'credit_history_years',
                           'num_open_accounts', 'num_inquiries'];
const requiredSpans     = ['cs-required', 'delinq-req', 'ch-req', 'oa-req', 'inq-req'];

newCustomerToggle.addEventListener('change', function () {
  const isNew = this.checked;

  // Show/hide the cold-start notice
  newCustomerNotice.style.display = isNew ? 'flex' : 'none';
  toggleCard.classList.toggle('is-new', isNew);

  // Update the optional badge text
  document.getElementById('credit-optional-badge').textContent = isNew ? '(Optional — using cold-start defaults)' : '';

  // Toggle required attribute and visual state on credit fields
  creditFields.forEach((id, i) => {
    const field = document.getElementById(id);
    const reqSpan = document.getElementById(requiredSpans[i]);
    if (isNew) {
      field.removeAttribute('required');
      field.style.opacity = '0.5';
      if (reqSpan) reqSpan.style.display = 'none';
    } else {
      field.setAttribute('required', '');
      field.style.opacity = '1';
      if (reqSpan) reqSpan.style.display = '';
    }
  });
});


// ═════════════════════════════════════════════════════════════════════════
// 4. DTI CALCULATOR HELPER
// ============================================================================
// DTI = (Total Monthly Debt Payments / Gross Monthly Income) × 100
// Example: $600 debt / $3000 income = 20% DTI
// This is a convenience tool — the DTI field can also be filled manually.
// ============================================================================
function calculateDTI() {
  const debt   = parseFloat(document.getElementById('monthly_debt').value);
  const income = parseFloat(document.getElementById('monthly_income').value);

  if (!debt || !income || income === 0) {
    alert('Please enter both monthly debt and monthly income values.');
    return;
  }

  const dti = (debt / income) * 100;
  document.getElementById('dti_ratio').value = dti.toFixed(1);

  // Flash green to confirm
  const dtiInput = document.getElementById('dti_ratio');
  dtiInput.style.borderColor = 'var(--risk-low)';
  setTimeout(() => { dtiInput.style.borderColor = ''; }, 1500);
}


// ═════════════════════════════════════════════════════════════════════════
// 5. CREDIT SCORE VISUAL INDICATOR
// ============================================================================
// As the user types a credit score, we update a color-gradient bar with a
// moving marker to show WHERE on the FICO scale their score falls.
// This makes an abstract number tangible and educational.
// ============================================================================
document.getElementById('credit_score').addEventListener('input', function () {
  const score = parseInt(this.value);
  if (isNaN(score) || score < 300 || score > 850) return;

  // Map score (300-850) to percentage (0-100%)
  const pct = ((score - 300) / (850 - 300)) * 100;
  document.getElementById('cs-marker').style.left = `${pct}%`;

  // Color the marker based on score range
  let color;
  if      (score >= 800) color = '#4cc9f0';
  else if (score >= 740) color = '#06d6a0';
  else if (score >= 670) color = '#ffd60a';
  else if (score >= 580) color = '#fb8500';
  else                   color = '#ef233c';

  document.getElementById('cs-marker').style.borderColor = color;
});


// ═════════════════════════════════════════════════════════════════════════
// 6. FORM SUBMISSION → API CALL → DISPLAY RESULTS
// ============================================================================
// When the user submits the form:
//   1. Collect all field values into a JavaScript object
//   2. POST it to /predict (our Flask endpoint) as JSON
//   3. Receive the prediction response
//   4. Render the results section with animations
// ============================================================================
document.getElementById('loan-form').addEventListener('submit', async function (e) {
  e.preventDefault();  // Prevent default browser form submission (page reload)

  // Final validation of all steps
  if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
    return;
  }

  const isNew = document.getElementById('is_new_customer').checked;

  // Strict collection: NO defaults. If a required field is empty, we already caught it.
  // This prevents accidental predictions with incomplete data.
  const payload = {
    applicant_name:         document.getElementById('applicant_name').value,
    applicant_email:        document.getElementById('applicant_email').value,
    is_new_customer:        isNew,
    annual_income:          parseFloat(document.getElementById('annual_income').value),
    employment_length:      parseFloat(document.getElementById('employment_length').value),
    home_ownership:         parseInt(document.getElementById('home_ownership').value),
    loan_amount:            parseFloat(document.getElementById('loan_amount').value),
    dti_ratio:              parseFloat(document.getElementById('dti_ratio').value),
    loan_purpose:           parseInt(document.getElementById('loan_purpose').value),
    credit_score:           parseFloat(document.getElementById('credit_score').value),
    num_delinquencies:      parseInt(document.getElementById('num_delinquencies').value),
    credit_history_years:   parseFloat(document.getElementById('credit_history_years').value),
    num_open_accounts:      parseInt(document.getElementById('num_open_accounts').value),
    num_inquiries:          parseInt(document.getElementById('num_inquiries').value),
  };

  // Show loading state on submit button
  const submitBtn = document.getElementById('submit-btn');
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;

  try {
    // ── FETCH API CALL ───────────────────────────────────────────────────
    // fetch() is asynchronous — we use async/await to wait for the response.
    // The 'await' keyword pauses execution here until Flask responds.
    const response = await fetch('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)   // Convert JS object → JSON string
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    // Parse the JSON response back into a JavaScript object
    const result = await response.json();

    if (result.error) throw new Error(result.error);

    // Show the results
    displayResults(result, document.getElementById('applicant_name').value);

  } catch (err) {
    alert(`Error: ${err.message}\nMake sure the Flask server is running.`);
    console.error(err);
  } finally {
    // Always re-enable the button
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
});


// ═════════════════════════════════════════════════════════════════════════
// 7. DISPLAY RESULTS
// ============================================================================
// Takes the API response and renders all UI components:
//   - Decision card (risk level, probabilities, confidence)
//   - Animated gauge (speedometer-style canvas drawing)
//   - Description & recommendation text
//   - Radar chart (6-dimension financial profile)
//   - Feature importance bar chart
//   - Factor analysis cards (individual drivers)
// ============================================================================
function displayResults(result, applicantName) {
  const resultsSection = document.getElementById('results');

  // ── SET APPLICANT NAME ───────────────────────────────────────────────
  const nameEl = document.getElementById('result-applicant-name');
  nameEl.textContent = applicantName
    ? `Risk Assessment — ${applicantName}`
    : 'Risk Assessment Results';

  // ── DECISION CARD ────────────────────────────────────────────────────
  const decisionCard = document.getElementById('decision-card');
  decisionCard.style.borderColor = result.color + '40';  // 25% opacity border

  document.getElementById('decision-icon').textContent = result.icon;
  document.getElementById('decision-icon').style.color = result.color;

  document.getElementById('decision-label').textContent = result.decision;
  document.getElementById('decision-label').style.color = result.color;

  document.getElementById('decision-level').textContent = `${result.risk_level} RISK`;
  document.getElementById('decision-level').style.color = result.color;

  // Animate probability numbers (count up from 0)
  animateNumber('default-prob-value', 0, result.default_probability, '%', result.color);
  animateNumber('safe-prob-value', 0, result.safe_probability, '%', 'var(--risk-low)');

  // Confidence bar
  document.getElementById('confidence-fill').style.width = result.confidence + '%';
  document.getElementById('confidence-value').textContent = result.confidence + '%';

  // New customer badge
  const badge = document.getElementById('new-cust-badge');
  badge.style.display = result.is_new_customer ? 'inline-flex' : 'none';

  // ── GAUGE ─────────────────────────────────────────────────────────────
  drawGauge(result.default_probability / 100, result.color);
  document.getElementById('gauge-percent').textContent = result.default_probability + '%';
  document.getElementById('gauge-percent').style.color = result.color;

  // ── DESCRIPTION & RECOMMENDATION ─────────────────────────────────────
  document.getElementById('result-description').textContent    = result.description;
  document.getElementById('result-recommendation').textContent = result.recommendation;

  // ── CHARTS ────────────────────────────────────────────────────────────
  renderRadarChart(result.radar_scores, result.color);
  renderImportanceChart(result.feature_importances);

  // ── FACTOR CARDS ──────────────────────────────────────────────────────
  renderFactorCards(result.factors);

  // ── SHOW RESULTS SECTION WITH SMOOTH SCROLL ───────────────────────────
  resultsSection.style.display = 'block';
  setTimeout(() => {
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}


// ── ANIMATE NUMBER (count-up effect) ─────────────────────────────────────────
function animateNumber(elementId, from, to, suffix, color) {
  const el = document.getElementById(elementId);
  const duration = 1200;  // ms
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out: starts fast, slows toward end
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (to - from) * eased;

    el.textContent = current.toFixed(1) + suffix;
    el.style.color = color;

    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}


// ═════════════════════════════════════════════════════════════════════════
// GAUGE / SPEEDOMETER (Canvas Drawing)
// ============================================================================
// CONCEPT: The HTML Canvas element lets us draw 2D shapes programmatically.
// We use arc() to draw the colored gauge arc, then overlay a needle.
//
// The gauge is a semicircle (π radians = 180°) divided into three zones:
//   - Green (0-30%): low risk
//   - Orange (30-55%): moderate risk
//   - Red (55-100%): high risk
//
// We animate the needle from 0 to the target probability using
// requestAnimationFrame for smooth 60fps animation.
// ============================================================================
function drawGauge(probability, color) {
  const canvas = document.getElementById('gauge-canvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Cancel any previous animation
  if (gaugeAnimFrame) cancelAnimationFrame(gaugeAnimFrame);

  const cx = W / 2;       // center X
  const cy = H - 30;      // center Y (near bottom)
  const r  = W * 0.42;    // radius

  const startAngle = Math.PI;           // 180° (left)
  const endAngle   = 2 * Math.PI;       // 360° (right)
  const totalAngle = endAngle - startAngle;  // = π

  // Zone boundaries as fraction of total (0-100% probability maps to 0-π angle)
  const lowEnd  = startAngle + totalAngle * 0.30;   // 30% threshold
  const modEnd  = startAngle + totalAngle * 0.55;   // 55% threshold

  let currentProb = 0;
  const targetProb = probability;
  const animDuration = 1500;  // ms
  const startTime = performance.now();

  function frame(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / animDuration, 1);
    const eased    = 1 - Math.pow(1 - progress, 4);  // cubic ease-out
    currentProb    = eased * targetProb;

    // Clear canvas
    ctx.clearRect(0, 0, W, H);

    // ── DRAW ARC SEGMENTS ─────────────────────────────────────────────
    // Each arc = one risk zone, drawn as a thick colored arc

    // Background track (dark grey)
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.lineWidth = 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Low risk zone (green)
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, Math.min(lowEnd, startAngle + totalAngle * currentProb));
    ctx.lineWidth = 20;
    ctx.strokeStyle = currentProb <= 0.30 ? '#06d6a0' : '#06d6a0';
    ctx.stroke();

    // Moderate risk zone (orange) — only if prob > 30%
    if (currentProb > 0.30) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, lowEnd, Math.min(modEnd, startAngle + totalAngle * currentProb));
      ctx.lineWidth = 20;
      ctx.strokeStyle = '#fb8500';
      ctx.stroke();
    }

    // High risk zone (red) — only if prob > 55%
    if (currentProb > 0.55) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, modEnd, startAngle + totalAngle * currentProb);
      ctx.lineWidth = 20;
      ctx.strokeStyle = '#ef233c';
      ctx.stroke();
    }

    // ── DRAW NEEDLE ───────────────────────────────────────────────────
    // The needle points from center to the current probability position on the arc
    const needleAngle = startAngle + totalAngle * currentProb;
    const needleLen   = r * 0.75;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(needleAngle) * needleLen,
      cy + Math.sin(needleAngle) * needleLen
    );
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Needle base circle
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // ── DRAW ZONE LABELS ──────────────────────────────────────────────
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(6,214,160,0.7)';
    ctx.fillText('LOW', cx - r * 0.65, cy - r * 0.18);

    ctx.fillStyle = 'rgba(251,133,0,0.7)';
    ctx.fillText('MED', cx, cy - r * 0.85);

    ctx.fillStyle = 'rgba(239,35,60,0.7)';
    ctx.fillText('HIGH', cx + r * 0.65, cy - r * 0.18);

    if (progress < 1) {
      gaugeAnimFrame = requestAnimationFrame(frame);
    }
  }

  gaugeAnimFrame = requestAnimationFrame(frame);
}


// ═════════════════════════════════════════════════════════════════════════
// RADAR CHART (Chart.js)
// ============================================================================
// CONCEPT: A radar (spider) chart shows multiple dimensions on a single plot.
// Each axis = one financial dimension (0-100 score, 100 = safest).
// The filled polygon shape shows the applicant's overall financial profile at a glance.
// A "pointy" shape = uneven profile (good in some areas, weak in others).
// A "round" shape = balanced profile.
// ============================================================================
function renderRadarChart(radarScores, riskColor) {
  const canvas = document.getElementById('radar-chart');
  const labels = Object.keys(radarScores);
  const values = Object.values(radarScores);

  // Destroy previous chart instance if it exists
  // (Chart.js requires this to avoid "Canvas already has a chart" error)
  if (radarChart) radarChart.destroy();

  radarChart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Applicant Profile',
        data: values,
        backgroundColor: riskColor + '22',   // 13% opacity fill
        borderColor:     riskColor,
        borderWidth:     2,
        pointBackgroundColor: riskColor,
        pointRadius:     5,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation: { duration: 1000, easing: 'easeOutQuart' },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: {
            stepSize: 20,
            color: 'rgba(136,153,187,0.6)',
            backdropColor: 'transparent',
            font: { size: 10 }
          },
          grid:        { color: 'rgba(255,255,255,0.07)' },
          angleLines:  { color: 'rgba(255,255,255,0.07)' },
          pointLabels: {
            color: 'rgba(232,240,254,0.8)',
            font:  { size: 11, weight: '600' }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw}/100`
          }
        }
      }
    }
  });
}


// ═════════════════════════════════════════════════════════════════════════
// FEATURE IMPORTANCE BAR CHART (Chart.js)
// ============================================================================
// CONCEPT: Feature importance from a Random Forest tells us which features
// the model used MOST across ALL its 200 decision trees.
// A high importance = the model split on this feature often → it's predictive.
// This is useful for explaining the model to regulators and business stakeholders.
// ============================================================================
function renderImportanceChart(importances) {
  const canvas = document.getElementById('importance-chart');

  // Sort and take top 8 features
  const sorted = Object.entries(importances)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const labels = sorted.map(([name]) => name);
  const values = sorted.map(([, val]) => (val * 100).toFixed(1));

  // Colors: gradient from accent to cyan
  const colors = labels.map((_, i) => {
    const t = i / (labels.length - 1);
    return `hsla(${220 + t * 60}, 80%, 65%, 0.8)`;
  });

  if (importanceChart) importanceChart.destroy();

  importanceChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Importance (%)',
        data: values,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',        // Horizontal bars (easier to read long feature names)
      responsive:          true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(136,153,187,0.8)', font: { size: 10 } },
          title: {
            display: true,
            text:    'Importance (%)',
            color:   'rgba(136,153,187,0.6)',
            font:    { size: 10 }
          }
        },
        y: {
          grid:  { display: false },
          ticks: { color: 'rgba(232,240,254,0.8)', font: { size: 10 } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw}% of model weight`
          }
        }
      }
    }
  });
}


// ═════════════════════════════════════════════════════════════════════════
// FACTOR ANALYSIS CARDS
// ============================================================================
// Each card shows one specific factor from this applicant's profile:
//   - The factor name
//   - Their specific value
//   - Whether it's pushing risk UP (negative), DOWN (positive), or neutral
//   - A plain-English explanation
//
// This is the "explainability" layer — critical for fair lending compliance
// (banks must be able to explain WHY a loan was denied under ECOA/FCRA).
// ============================================================================
function renderFactorCards(factors) {
  const grid = document.getElementById('factors-grid');
  grid.innerHTML = '';  // Clear previous results

  factors.forEach((factor, i) => {
    const card = document.createElement('div');
    card.className = `factor-item ${factor.impact}`;
    card.style.animationDelay = `${i * 80}ms`;

    const impactArrow = factor.impact === 'positive' ? '↓ risk' :
                        factor.impact === 'negative' ? '↑ risk' : '→ risk';

    card.innerHTML = `
      <div class="factor-header">
        <div class="factor-name">${factor.factor}</div>
        <div class="factor-value">${factor.value}</div>
      </div>
      <div class="factor-detail">
        <span style="font-size:0.7rem; font-weight:700; margin-right:4px; opacity:0.8">${impactArrow}</span>
        ${factor.detail}
      </div>
    `;
    grid.appendChild(card);
  });
}


// ═════════════════════════════════════════════════════════════════════════
// RESET FORM
// ============================================================================
function resetForm() {
  // Reset all input fields
  document.getElementById('loan-form').reset();

  // Reset credit score marker
  document.getElementById('cs-marker').style.left = '0%';

  // Hide results
  document.getElementById('results').style.display = 'none';

  // Go back to step 1
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.progress-step').forEach(s => {
    s.classList.remove('active', 'done');
  });
  document.getElementById('step-1').classList.add('active');
  document.querySelector('.progress-step[data-step="1"]').classList.add('active');
  currentStep = 1;

  // Reset new-customer toggle
  document.getElementById('is_new_customer').checked = false;
  newCustomerNotice.style.display = 'none';
  toggleCard.classList.remove('is-new');
  creditFields.forEach((id, i) => {
    document.getElementById(id).setAttribute('required', '');
    document.getElementById(id).style.opacity = '1';
    const reqSpan = document.getElementById(requiredSpans[i]);
    if (reqSpan) reqSpan.style.display = '';
  });

  // Scroll to top
  document.getElementById('assess').scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// ── SMOOTH SCROLL for nav links ───────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});


// ── INTERSECTION OBSERVER (scroll-triggered fade-in for cards) ────────────
// As the user scrolls down, section elements fade in smoothly.
// This uses IntersectionObserver — a browser API that fires a callback
// when elements enter/leave the viewport.
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animation = 'fadeInUp 0.6s ease both';
      observer.unobserve(entry.target);  // Stop observing once animated
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.step-card, .tier-card, .stat-card').forEach(el => {
  el.style.opacity = '1';  // Start hidden
  observer.observe(el);
});
