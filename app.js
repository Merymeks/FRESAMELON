// === Constantes ===
const STORAGE_TRANSACTIONS = "homeBudget_transactions_v3";
const STORAGE_BUDGETS = "homeBudget_budgets_v3";
const TARGET_YEAR = 2026;

const MONTH_NAMES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL",
  "MAYO", "JUNIO", "JULIO", "AGOSTO",
  "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

// === Helpers Storage ===
function loadFromStorage(key, defaultValue) {
  const raw = localStorage.getItem(key);
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// === Estado global ===
let transactions = loadFromStorage(STORAGE_TRANSACTIONS, []);
let budgets = loadFromStorage(STORAGE_BUDGETS, { facturas: {}, gastos: {} });

// aseguramos estructura mínima
if (!budgets.facturas || !budgets.gastos) {
  budgets = {
    facturas: budgets.facturas || {},
    gastos: budgets.gastos || {},
    savingsGoal: budgets.savingsGoal || 0
  };
} else if (typeof budgets.savingsGoal === "undefined") {
  budgets.savingsGoal = 0;
}

let selectedYear = TARGET_YEAR;
const today = new Date();
let selectedMonth =
  today.getFullYear() === TARGET_YEAR ? today.getMonth() : 0;

// === Tabs / Vistas ===
const tabButtons = document.querySelectorAll(".tab-btn");
const views = document.querySelectorAll(".view");

function showView(viewId) {
  views.forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });

  tabButtons.forEach((btn) => {
    const target = btn.getAttribute("data-view");
    btn.classList.toggle("active", target === viewId);
  });

  switch (viewId) {
    case "year-view":
      renderYearDashboard();
      break;
    case "ingresos-view":
      renderIngresosTable();
      updateMonthLabels();
      break;
    case "facturas-view":
      renderFacturasTable();
      updateMonthLabels();
      break;
    case "gastos-view":
      renderGastosTable();
      updateMonthLabels();
      break;
    case "presupuesto-view":
      renderPresupuestoTables();
      break;
    case "overview-view":
      if (typeof renderOverview === "function") renderOverview();
      break;
    case "savings-view":
      renderSavingsView();
      break;
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-view");
    showView(target);
  });
});

// === Helpers generales ===
function formatMoney(value) {
  const num = Number(value) || 0;
  return num.toFixed(2);
}

function getTransactionsForMonth(year, monthIndex) {
  return transactions.filter((tx) => {
    const d = new Date(tx.date);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });
}

function getCategoryFromSelect(selectEl, customEl) {
  const customVal = customEl.value.trim();
  if (customVal) return customVal;
  return selectEl.value;
}

function computeMonthStats(year, monthIndex) {
  const monthTx = getTransactionsForMonth(year, monthIndex);
  let income = 0;
  let facturas = 0;
  let gastos = 0;

  monthTx.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === "income") {
      income += amt;
    } else if (tx.type === "expense") {
      if (tx.group === "factura") facturas += amt;
      if (tx.group === "gasto") gastos += amt;
    }
  });

  return {
    income,
    facturas,
    gastos,
    balance: income - facturas - gastos
  };
}

// Gastos del mes por categoría (facturas + gastos)
function computeMonthExpensesByCategory(year, monthIndex) {
  const monthTx = getTransactionsForMonth(year, monthIndex)
    .filter((tx) => tx.type === "expense");

  const map = {};
  monthTx.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (!amt) return;
    const key = tx.category || "Otros";
    map[key] = (map[key] || 0) + amt;
  });

  return map;
}

// === Donut chart gastos mes ===
function renderMonthExpensesPie() {
  const container = document.getElementById("month-pie-chart");
  const legend = document.getElementById("month-expenses-legend");
  if (!container || !legend) return;

  const dataMap = computeMonthExpensesByCategory(TARGET_YEAR, selectedMonth);
  const entries = Object.entries(dataMap).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  if (!total) {
    container.innerHTML = "<div class='small'>Sin gastos en este mes.</div>";
    legend.innerHTML = "";
    return;
  }

  const colors = [
    "#f97373", "#fb923c", "#facc15",
    "#22c55e", "#2dd4bf", "#3b82f6",
    "#a855f7", "#ec4899", "#78716c"
  ];

  const cx = 90;
  const cy = 90;
  const rOuter = 80;
  const rInner = 48;
  let currentAngle = -Math.PI / 2;

  function polarToCartesian(r, angle) {
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    };
  }

  let paths = "";

  entries.forEach(([label, value], index) => {
    const fraction = value / total;
    const angle = fraction * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const start = polarToCartesian(rOuter, startAngle);
    const end = polarToCartesian(rOuter, endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const color = colors[index % colors.length];

    const pathData = [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${end.x} ${end.y}`,
      "Z"
    ].join(" ");

    paths += `<path d="${pathData}" fill="${color}"></path>`;
  });

  const svg = `
    <svg viewBox="0 0 180 180">
      ${paths}
      <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="#f5f5f5"></circle>
    </svg>
  `;
  container.innerHTML = svg;

  legend.innerHTML = "";
  entries.forEach(([label, value], index) => {
    const color = colors[index % colors.length];
    const pct = ((value / total) * 100).toFixed(1);

    const row = document.createElement("div");
    row.className = "pie-legend-item";

    const dot = document.createElement("span");
    dot.className = "pie-legend-color";
    dot.style.backgroundColor = color;

    const lab = document.createElement("span");
    lab.className = "pie-legend-label";
    lab.textContent = label;

    const val = document.createElement("span");
    val.className = "pie-legend-value";
    val.textContent = `${formatMoney(value)} € (${pct}%)`;

    row.appendChild(dot);
    row.appendChild(lab);
    row.appendChild(val);
    legend.appendChild(row);
  });
}

// === Ahorro anual ===
function computeYearSavings() {
  const balances = [];
  for (let m = 0; m < 12; m++) {
    const stats = computeMonthStats(TARGET_YEAR, m);
    balances.push(stats.balance);
  }
  return balances;
}

function computeYearTotals() {
  let totalIncome = 0;
  let totalFacturas = 0;
  let totalGastos = 0;

  for (let m = 0; m < 12; m++) {
    const stats = computeMonthStats(TARGET_YEAR, m);
    totalIncome += stats.income;
    totalFacturas += stats.facturas;
    totalGastos += stats.gastos;
  }

  const totalExpenses = totalFacturas + totalGastos;
  const totalBalance = totalIncome - totalExpenses;

  return { totalIncome, totalExpenses, totalBalance };
}

// objetivo de ahorro anual (guardado en budgets)
function getSavingsGoal() {
  return Number(budgets.savingsGoal) || 0;
}

function setSavingsGoal(newGoal) {
  budgets.savingsGoal = newGoal;
  saveToStorage(STORAGE_BUDGETS, budgets);
}

// === Dashboard año (HOME) ===
function renderYearDashboard() {
  const grid = document.getElementById("year-grid");
  const totalSavingValueEl = document.getElementById("total-saving-value");
  const totalSavingCardEl = document.getElementById("total-saving-card");
  const currentMonthLabel = document.getElementById("current-month-label");
  const currentIncomeEl = document.getElementById("current-income-value");
  const currentExpenseEl = document.getElementById("current-expense-value");

  if (!grid || !totalSavingValueEl) return;

  grid.innerHTML = "";
  let totalSaving = 0;

  for (let m = 0; m < 12; m++) {
    const stats = computeMonthStats(TARGET_YEAR, m);
    const bal = stats.balance;
    totalSaving += bal;

    const card = document.createElement("div");
    card.className = "month-card";

    const nameEl = document.createElement("div");
    nameEl.className = "month-name";
    nameEl.textContent = MONTH_NAMES[m];

    const savingEl = document.createElement("div");
    savingEl.className = "month-saving";
    if (bal > 0) savingEl.classList.add("positive");
    else if (bal < 0) savingEl.classList.add("negative");
    else savingEl.classList.add("zero");
    savingEl.textContent = formatMoney(bal) + " €";

    card.appendChild(nameEl);
    card.appendChild(savingEl);
    grid.appendChild(card);
  }

  totalSavingValueEl.textContent = formatMoney(totalSaving) + " €";
  if (totalSavingCardEl) {
    totalSavingCardEl.classList.remove("positive", "negative");
  }

  const statsCurrent = computeMonthStats(TARGET_YEAR, selectedMonth);
  const totalExpensesCurrent = statsCurrent.facturas + statsCurrent.gastos;

  if (currentMonthLabel) {
    currentMonthLabel.textContent = MONTH_NAMES[selectedMonth];
  }
  if (currentIncomeEl) {
    currentIncomeEl.textContent = formatMoney(statsCurrent.income) + " €";
  }
  if (currentExpenseEl) {
    currentExpenseEl.textContent = formatMoney(totalExpensesCurrent) + " €";
  }

  renderMonthExpensesPie();
}

// === Vista AHORRO 2026 ===
function renderSavingsView() {
  const data = computeYearSavings();
  const chartContainer = document.getElementById("savings-chart");
  const tableBody = document.querySelector("#savings-table tbody");
  const summaryContainer = document.getElementById("year-summary-cards");

  if (!chartContainer || !tableBody || !summaryContainer) return;

  const { totalIncome, totalExpenses, totalBalance } = computeYearTotals();
  const savingsGoal = getSavingsGoal();
  const ahorroAcumulado = totalBalance; // lo que llevas ahorrado en 2026

  const pct = savingsGoal > 0
    ? Math.max(0, Math.min(100, (ahorroAcumulado / savingsGoal) * 100))
    : 0;

  // Tarjetas + tarjeta objetivo + balance, todo con estética dashboard
  summaryContainer.innerHTML = `
    <div class="current-month-cards annual-cards">
      <div class="summary-pill income-pill">
        <div class="pill-header">
          <div class="pill-icon">💰</div>
          <div class="pill-label">TOTAL INGRESOS 2026</div>
        </div>
        <div class="pill-value" id="year-income-value"></div>
      </div>

      <div class="summary-pill expense-pill">
        <div class="pill-header">
          <div class="pill-icon">💸</div>
          <div class="pill-label">TOTAL GASTOS 2026</div>
        </div>
        <div class="pill-value" id="year-expense-value"></div>
      </div>
    </div>

    <div class="year-balance-wrapper" style="margin-top: 12px;">
      <div class="year-balance-card" id="year-balance-card">
        <div class="year-balance-top">
          <div class="year-balance-icon">⚖️</div>
          <div class="year-balance-label">BALANCE TOTAL 2026</div>
        </div>
        <div class="year-balance-value" id="year-balance-value"></div>
      </div>
    </div>

    <div class="savings-goal-card" id="savings-goal-card">
      <div class="savings-goal-header">
        <div class="savings-goal-title">OBJETIVO DE AHORRO 2026</div>
        <div class="savings-goal-target" id="savings-goal-target"></div>
      </div>
      <div class="savings-goal-bar-wrapper">
        <div class="savings-goal-bar-bg">
          <div class="savings-goal-bar-fill" id="savings-goal-fill" style="width:0%;"></div>
        </div>
        <div class="savings-goal-meta">
          <div class="savings-goal-progress" id="savings-goal-progress"></div>
          <div class="savings-goal-current" id="savings-goal-current"></div>
        </div>
      </div>
    </div>
  `;

  // Rellenar valores de las tarjetas
  const incomeValEl = document.getElementById("year-income-value");
  const expenseValEl = document.getElementById("year-expense-value");
  const balanceValEl = document.getElementById("year-balance-value");
  const balanceCardEl = document.getElementById("year-balance-card");

  if (incomeValEl) incomeValEl.textContent = formatMoney(totalIncome) + " €";
  if (expenseValEl) expenseValEl.textContent = formatMoney(totalExpenses) + " €";
  if (balanceValEl) balanceValEl.textContent = formatMoney(totalBalance) + " €";

  if (balanceCardEl) {
    // color soft según signo (solo efecto visual, no cambiamos layout)
    if (totalBalance > 0) {
      balanceCardEl.style.background = "var(--pastel-green)";
    } else if (totalBalance < 0) {
      balanceCardEl.style.background = "var(--pastel-red)";
    } else {
      balanceCardEl.style.background = "var(--pastel-yellow)";
    }
  }

  // Rellenar objetivo de ahorro
  const goalTargetEl = document.getElementById("savings-goal-target");
  const goalFillEl = document.getElementById("savings-goal-fill");
  const goalProgressEl = document.getElementById("savings-goal-progress");
  const goalCurrentEl = document.getElementById("savings-goal-current");

  if (goalTargetEl) {
    goalTargetEl.textContent =
      savingsGoal > 0 ? formatMoney(savingsGoal) + " €" : "Sin objetivo definido";
  }
  if (goalFillEl) {
    goalFillEl.style.width = pct + "%";
  }
  if (goalProgressEl) {
    goalProgressEl.textContent =
      savingsGoal > 0
        ? `${pct.toFixed(0)}% del objetivo alcanzado`
        : "Marca un objetivo para ver el porcentaje.";
  }
  if (goalCurrentEl) {
    goalCurrentEl.textContent = `Ahorro acumulado: ${formatMoney(ahorroAcumulado)} €`;
  }

  // Permitir cambiar rápidamente el objetivo haciendo click en la tarjeta
  const goalCardEl = document.getElementById("savings-goal-card");
  if (goalCardEl) {
    goalCardEl.addEventListener("click", () => {
      const currentGoal = getSavingsGoal();
      const input = prompt(
        "Introduce tu objetivo de ahorro para 2026 (€):",
        currentGoal > 0 ? currentGoal : ""
      );
      if (input === null) return;
      const parsed = Number(String(input).replace(",", "."));
      if (!parsed || parsed <= 0) {
        alert("Introduce un importe válido mayor que 0.");
        return;
      }
      setSavingsGoal(parsed);
      renderSavingsView(); // refresca barra y textos
    });
  }

  // ------ Gráfico línea ahorro mensual ------
  const maxVal = Math.max(...data, 0);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;

  const width = 600;
  const height = 200;
  const padding = 30;

  let points = "";
  if (data.length === 1) {
    const x = width / 2;
    const y = height / 2;
    points = `${x},${y}`;
  } else {
    points = data
      .map((v, i) => {
        const x =
          padding +
          (data.length === 1
            ? (width - 2 * padding) / 2
            : (i / (data.length - 1)) * (width - 2 * padding));
        const y =
          height -
          padding -
          ((v - minVal) / range) * (height - 2 * padding);
        return `${x},${y}`;
      })
      .join(" ");
  }

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#ccc" stroke-width="1" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#ccc" stroke-width="1" />
      <polyline fill="none" stroke="#1a4f7f" stroke-width="2" points="${points}" />
    </svg>
  `;

  // ------ Tabla detalle por mes ------
  tableBody.innerHTML = "";
  let acumulado = 0;
  data.forEach((val, i) => {
    acumulado += val;
    const tr = document.createElement("tr");

    const tdMes = document.createElement("td");
    tdMes.textContent = MONTH_NAMES[i];

    const tdMesAh = document.createElement("td");
    tdMesAh.textContent = formatMoney(val) + " €";
    if (val > 0) tdMesAh.className = "highlight-positive";
    else if (val < 0) tdMesAh.className = "highlight-negative";
    else tdMesAh.className = "highlight-neutral";

    const tdAcum = document.createElement("td");
    tdAcum.textContent = formatMoney(acumulado) + " €";
    if (acumulado > 0) tdAcum.className = "highlight-positive";
    else if (acumulado < 0) tdAcum.className = "highlight-negative";
    else tdAcum.className = "highlight-neutral";

    tr.appendChild(tdMes);
    tr.appendChild(tdMesAh);
    tr.appendChild(tdAcum);
    tableBody.appendChild(tr);
  });
}

// === Añadir / borrar transacción ===
function addTransaction({
  dateInput,
  categorySelect,
  categoryCustom,
  descriptionInput,
  amountInput,
  notesInput,
  type,
  group
}) {
  const date = dateInput.value || new Date().toISOString().slice(0, 10);
  const d = new Date(date);
  if (d.getFullYear() !== TARGET_YEAR) {
    if (!confirm("La fecha no es de 2026. ¿Quieres guardarla igualmente?")) {
      return false;
    }
  }

  const category = getCategoryFromSelect(categorySelect, categoryCustom) || "Otros";
  const description = descriptionInput.value.trim() || "(sin descripción)";
  const amount = Number(amountInput.value);
  if (!amount || amount <= 0) {
    alert("Introduce un importe válido.");
    return false;
  }
  const notes = notesInput.value.trim();

  const tx = {
    id: Date.now() + Math.random(),
    date,
    type,
    group,
    category,
    description,
    amount,
    notes,
    createdAt: new Date().toISOString()
  };

  transactions.push(tx);
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  saveToStorage(STORAGE_TRANSACTIONS, transactions);

  renderYearDashboard();
  if (typeof renderOverview === "function") renderOverview();
  return true;
}

function deleteTransaction(id) {
  if (!confirm("¿Borrar este registro?")) return;
  transactions = transactions.filter((tx) => tx.id !== id);
  saveToStorage(STORAGE_TRANSACTIONS, transactions);
  renderYearDashboard();
  if (typeof renderOverview === "function") renderOverview();
  renderIngresosTable();
  renderFacturasTable();
  renderGastosTable();
}

// === Labels de mes ===
function updateMonthLabels() {
  const label = MONTH_NAMES[selectedMonth] + " 2026";
  const ingLabel = document.getElementById("ing-selected-month-label");
  const facLabel = document.getElementById("fac-selected-month-label");
  const gasLabel = document.getElementById("gas-selected-month-label");
  const ovLabel = document.getElementById("overview-month-label");

  if (ingLabel) ingLabel.textContent = label;
  if (facLabel) facLabel.textContent = label;
  if (gasLabel) gasLabel.textContent = label;
  if (ovLabel) ovLabel.textContent = MONTH_NAMES[selectedMonth];
}

// === Cambio de mes ===
function changeMonth(delta) {
  selectedMonth += delta;
  if (selectedMonth < 0) selectedMonth = 11;
  if (selectedMonth > 11) selectedMonth = 0;

  updateMonthLabels();

  const activeView = document.querySelector(".view.active");
  if (!activeView) return;

  switch (activeView.id) {
    case "overview-view":
      if (typeof renderOverview === "function") renderOverview();
      break;
    case "ingresos-view":
      renderIngresosTable();
      resetIngresosForm();
      break;
    case "facturas-view":
      renderFacturasTable();
      resetFacturasForm();
      break;
    case "gastos-view":
      renderGastosTable();
      resetGastosForm();
      break;
    case "year-view":
      renderYearDashboard();
      break;
  }
}

const monthPrevButtons = document.querySelectorAll(".month-prev");
const monthNextButtons = document.querySelectorAll(".month-next");

monthPrevButtons.forEach((btn) =>
  btn.addEventListener("click", () => changeMonth(-1))
);
monthNextButtons.forEach((btn) =>
  btn.addEventListener("click", () => changeMonth(1))
);

// === INGRESOS ===
const ingDate = document.getElementById("ing-date");
const ingCategory = document.getElementById("ing-category");
const ingCategoryCustom = document.getElementById("ing-category-custom");
const ingDescription = document.getElementById("ing-description");
const ingAmount = document.getElementById("ing-amount");
const ingNotes = document.getElementById("ing-notes");
const ingAddBtn = document.getElementById("ing-add-btn");
const ingClearBtn = document.getElementById("ing-clear-btn");
const ingTableBody = document.querySelector("#ing-table tbody");

function resetIngresosForm() {
  if (!ingDate) return;
  ingCategory.value = "Maria - Salario";
  ingCategoryCustom.value = "";
  ingDescription.value = "";
  ingAmount.value = "";
  ingNotes.value = "";
  const anyDate = new Date(TARGET_YEAR, selectedMonth, 1)
    .toISOString()
    .slice(0, 10);
  ingDate.value = anyDate;
}

function renderIngresosTable() {
  if (!ingTableBody) return;
  ingTableBody.innerHTML = "";
  const monthTx = getTransactionsForMonth(selectedYear, selectedMonth).filter(
    (tx) => tx.group === "ingreso"
  );

  if (monthTx.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "Sin ingresos registrados en este mes.";
    td.className = "small";
    tr.appendChild(td);
    ingTableBody.appendChild(tr);
    return;
  }

  const recent = monthTx.slice(0, 20);
  recent.forEach((tx) => {
    const tr = document.createElement("tr");
    const d = new Date(tx.date);
    const dateStr = !isNaN(d) ? d.toLocaleDateString() : tx.date;

    const tdDate = document.createElement("td");
    const tdCat = document.createElement("td");
    const tdDesc = document.createElement("td");
    const tdAmt = document.createElement("td");
    const tdActions = document.createElement("td");

    tdDate.textContent = dateStr;
    tdCat.textContent = tx.category;
    tdDesc.textContent = tx.description;
    if (tx.notes) {
      const notesEl = document.createElement("div");
      notesEl.className = "small";
      notesEl.textContent = tx.notes;
      tdDesc.appendChild(notesEl);
    }

    tdAmt.className = "amount-income";
    tdAmt.textContent = "+" + formatMoney(tx.amount) + " €";

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-ghost";
    delBtn.textContent = "Borrar";
    delBtn.addEventListener("click", () => deleteTransaction(tx.id));
    tdActions.appendChild(delBtn);

    tr.appendChild(tdDate);
    tr.appendChild(tdCat);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAmt);
    tr.appendChild(tdActions);
    ingTableBody.appendChild(tr);
  });
}

if (ingAddBtn) {
  ingAddBtn.addEventListener("click", () => {
    const ok = addTransaction({
      dateInput: ingDate,
      categorySelect: ingCategory,
      categoryCustom: ingCategoryCustom,
      descriptionInput: ingDescription,
      amountInput: ingAmount,
      notesInput: ingNotes,
      type: "income",
      group: "ingreso"
    });
    if (ok) {
      resetIngresosForm();
      renderIngresosTable();
    }
  });
}

if (ingClearBtn) {
  ingClearBtn.addEventListener("click", resetIngresosForm);
}

// === FACTURAS ===
const facDate = document.getElementById("fac-date");
const facCategory = document.getElementById("fac-category");
const facCategoryCustom = document.getElementById("fac-category-custom");
const facDescription = document.getElementById("fac-description");
const facAmount = document.getElementById("fac-amount");
const facNotes = document.getElementById("fac-notes");
const facAddBtn = document.getElementById("fac-add-btn");
const facClearBtn = document.getElementById("fac-clear-btn");
const facTableBody = document.querySelector("#fac-table tbody");
const facDuplicateBtn = document.getElementById("fac-duplicate-btn");

function resetFacturasForm() {
  if (!facDate) return;
  facCategory.value = "Alquiler";
  facCategoryCustom.value = "";
  facDescription.value = "";
  facAmount.value = "";
  facNotes.value = "";
  const anyDate = new Date(TARGET_YEAR, selectedMonth, 1)
    .toISOString()
    .slice(0, 10);
  facDate.value = anyDate;
}

function renderFacturasTable() {
  if (!facTableBody) return;
  facTableBody.innerHTML = "";
  const monthTx = getTransactionsForMonth(selectedYear, selectedMonth).filter(
    (tx) => tx.group === "factura"
  );

  if (monthTx.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "Sin facturas registradas en este mes.";
    td.className = "small";
    tr.appendChild(td);
    facTableBody.appendChild(tr);
    return;
  }

  const recent = monthTx.slice(0, 20);
  recent.forEach((tx) => {
    const tr = document.createElement("tr");
    const d = new Date(tx.date);
    const dateStr = !isNaN(d) ? d.toLocaleDateString() : tx.date;

    const tdDate = document.createElement("td");
    const tdCat = document.createElement("td");
    const tdDesc = document.createElement("td");
    const tdAmt = document.createElement("td");
    const tdActions = document.createElement("td");

    tdDate.textContent = dateStr;
    tdCat.textContent = tx.category;
    tdDesc.textContent = tx.description;
    if (tx.notes) {
      const notesEl = document.createElement("div");
      notesEl.className = "small";
      notesEl.textContent = tx.notes;
      tdDesc.appendChild(notesEl);
    }

    tdAmt.className = "amount-expense";
    tdAmt.textContent = "-" + formatMoney(tx.amount) + " €";

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-ghost";
    delBtn.textContent = "Borrar";
    delBtn.addEventListener("click", () => deleteTransaction(tx.id));
    tdActions.appendChild(delBtn);

    tr.appendChild(tdDate);
    tr.appendChild(tdCat);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAmt);
    tr.appendChild(tdActions);
    facTableBody.appendChild(tr);
  });
}

if (facAddBtn) {
  facAddBtn.addEventListener("click", () => {
    const ok = addTransaction({
      dateInput: facDate,
      categorySelect: facCategory,
      categoryCustom: facCategoryCustom,
      descriptionInput: facDescription,
      amountInput: facAmount,
      notesInput: facNotes,
      type: "expense",
      group: "factura"
    });
    if (ok) {
      resetFacturasForm();
      renderFacturasTable();
    }
  });
}

if (facClearBtn) {
  facClearBtn.addEventListener("click", resetFacturasForm);
}

function duplicateLastMonthFacturas() {
  if (selectedMonth === 0) {
    alert(
      "Solo puedes duplicar facturas a partir de febrero 2026 (se usa el mes anterior dentro de 2026)."
    );
    return;
  }

  const prevMonth = selectedMonth - 1;
  const prevYear = TARGET_YEAR;

  const prevTx = transactions.filter((tx) => {
    if (tx.group !== "factura") return false;
    const d = new Date(tx.date);
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  });

  if (prevTx.length === 0) {
    alert("No hay facturas en el mes anterior para duplicar.");
    return;
  }

  const confirmMsg =
    `Se van a duplicar ${prevTx.length} facturas de ${MONTH_NAMES[prevMonth]} 2026 ` +
    `en ${MONTH_NAMES[selectedMonth]} 2026. ¿Continuar?`;
  if (!confirm(confirmMsg)) return;

  const newTxs = prevTx.map((tx) => {
    const oldDate = new Date(tx.date);
    const day = isNaN(oldDate) ? 1 : oldDate.getDate();
    const newDate = new Date(TARGET_YEAR, selectedMonth, day);
    return {
      ...tx,
      id: Date.now() + Math.random(),
      date: newDate.toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    };
  });

  transactions = transactions.concat(newTxs);
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  saveToStorage(STORAGE_TRANSACTIONS, transactions);

  renderYearDashboard();
  if (typeof renderOverview === "function") renderOverview();
  renderFacturasTable();
}

if (facDuplicateBtn) {
  facDuplicateBtn.addEventListener("click", duplicateLastMonthFacturas);
}

// === GASTOS ===
const gasDate = document.getElementById("gas-date");
const gasCategory = document.getElementById("gas-category");
const gasCategoryCustom = document.getElementById("gas-category-custom");
const gasDescription = document.getElementById("gas-description");
const gasAmount = document.getElementById("gas-amount");
const gasNotes = document.getElementById("gas-notes");
const gasAddBtn = document.getElementById("gas-add-btn");
const gasClearBtn = document.getElementById("gas-clear-btn");
const gasTableBody = document.querySelector("#gas-table tbody");

function resetGastosForm() {
  if (!gasDate) return;
  gasCategory.value = "Compra Hogar";
  gasCategoryCustom.value = "";
  gasDescription.value = "";
  gasAmount.value = "";
  gasNotes.value = "";
  const anyDate = new Date(TARGET_YEAR, selectedMonth, 1)
    .toISOString()
    .slice(0, 10);
  gasDate.value = anyDate;
}

function renderGastosTable() {
  if (!gasTableBody) return;
  gasTableBody.innerHTML = "";
  const monthTx = getTransactionsForMonth(selectedYear, selectedMonth).filter(
    (tx) => tx.group === "gasto"
  );

  if (monthTx.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "Sin gastos registrados en este mes.";
    td.className = "small";
    tr.appendChild(td);
    gasTableBody.appendChild(tr);
    return;
  }

  const recent = monthTx.slice(0, 20);
  recent.forEach((tx) => {
    const tr = document.createElement("tr");
    const d = new Date(tx.date);
    const dateStr = !isNaN(d) ? d.toLocaleDateString() : tx.date;

    const tdDate = document.createElement("td");
    const tdCat = document.createElement("td");
    const tdDesc = document.createElement("td");
    const tdAmt = document.createElement("td");
    const tdActions = document.createElement("td");

    tdDate.textContent = dateStr;
    tdCat.textContent = tx.category;
    tdDesc.textContent = tx.description;
    if (tx.notes) {
      const notesEl = document.createElement("div");
      notesEl.className = "small";
      notesEl.textContent = tx.notes;
      tdDesc.appendChild(notesEl);
    }

    tdAmt.className = "amount-expense";
    tdAmt.textContent = "-" + formatMoney(tx.amount) + " €";

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-ghost";
    delBtn.textContent = "Borrar";
    delBtn.addEventListener("click", () => deleteTransaction(tx.id));
    tdActions.appendChild(delBtn);

    tr.appendChild(tdDate);
    tr.appendChild(tdCat);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAmt);
    tr.appendChild(tdActions);
    gasTableBody.appendChild(tr);
  });
}

if (gasAddBtn) {
  gasAddBtn.addEventListener("click", () => {
    const ok = addTransaction({
      dateInput: gasDate,
      categorySelect: gasCategory,
      categoryCustom: gasCategoryCustom,
      descriptionInput: gasDescription,
      amountInput: gasAmount,
      notesInput: gasNotes,
      type: "expense",
      group: "gasto"
    });
    if (ok) {
      resetGastosForm();
      renderGastosTable();
    }
  });
}

if (gasClearBtn) {
  gasClearBtn.addEventListener("click", resetGastosForm);
}

// === PRESUPUESTO ===
const preFacCategory = document.getElementById("pre-fac-category");
const preFacCategoryCustom = document.getElementById("pre-fac-category-custom");
const preFacAmount = document.getElementById("pre-fac-amount");
const preFacSaveBtn = document.getElementById("pre-fac-save-btn");
const preFacTableBody = document.querySelector("#pre-fac-table tbody");

const preGasCategory = document.getElementById("pre-gas-category");
const preGasCategoryCustom = document.getElementById("pre-gas-category-custom");
const preGasAmount = document.getElementById("pre-gas-amount");
const preGasSaveBtn = document.getElementById("pre-gas-save-btn");
const preGasTableBody = document.querySelector("#pre-gas-table tbody");

function savePresupuesto(type) {
  if (type === "facturas") {
    const cat = getCategoryFromSelect(preFacCategory, preFacCategoryCustom);
    const amount = Number(preFacAmount.value);
    if (!cat) {
      alert("Selecciona o escribe una categoría.");
      return;
    }
    if (!amount || amount <= 0) {
      alert("Introduce un importe de presupuesto válido.");
      return;
    }
    budgets.facturas[cat] = amount;
    saveToStorage(STORAGE_BUDGETS, budgets);
    renderPresupuestoTables();
  } else {
    const cat = getCategoryFromSelect(preGasCategory, preGasCategoryCustom);
    const amount = Number(preGasAmount.value);
    if (!cat) {
      alert("Selecciona o escribe una categoría.");
      return;
    }
    if (!amount || amount <= 0) {
      alert("Introduce un importe de presupuesto válido.");
      return;
    }
    budgets.gastos[cat] = amount;
    saveToStorage(STORAGE_BUDGETS, budgets);
    renderPresupuestoTables();
  }
}

function deletePresupuesto(type, cat) {
  if (!confirm("¿Borrar presupuesto para " + cat + "?")) return;
  if (type === "facturas") delete budgets.facturas[cat];
  else delete budgets.gastos[cat];
  saveToStorage(STORAGE_BUDGETS, budgets);
  renderPresupuestoTables();
}

function renderPresupuestoTables() {
  if (!preFacTableBody || !preGasTableBody) return;

  // Facturas
  preFacTableBody.innerHTML = "";
  const facCats = Object.keys(budgets.facturas);
  if (facCats.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "No hay presupuestos de facturas.";
    td.className = "small";
    tr.appendChild(td);
    preFacTableBody.appendChild(tr);
  } else {
    facCats.sort().forEach((cat) => {
      const tr = document.createElement("tr");
      const tdCat = document.createElement("td");
      const tdAmt = document.createElement("td");
      const tdActions = document.createElement("td");

      tdCat.textContent = cat;
      tdAmt.textContent = formatMoney(budgets.facturas[cat]) + " €";

      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-ghost";
      delBtn.textContent = "Borrar";
      delBtn.addEventListener("click", () =>
        deletePresupuesto("facturas", cat)
      );
      tdActions.appendChild(delBtn);

      tr.appendChild(tdCat);
      tr.appendChild(tdAmt);
      tr.appendChild(tdActions);
      preFacTableBody.appendChild(tr);
    });
  }

  // Gastos
  preGasTableBody.innerHTML = "";
  const gasCats = Object.keys(budgets.gastos);
  if (gasCats.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "No hay presupuestos de gastos.";
    td.className = "small";
    tr.appendChild(td);
    preGasTableBody.appendChild(tr);
  } else {
    gasCats.sort().forEach((cat) => {
      const tr = document.createElement("tr");
      const tdCat = document.createElement("td");
      const tdAmt = document.createElement("td");
      const tdActions = document.createElement("td");

      tdCat.textContent = cat;
      tdAmt.textContent = formatMoney(budgets.gastos[cat]) + " €";

      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-ghost";
      delBtn.textContent = "Borrar";
      delBtn.addEventListener("click", () =>
        deletePresupuesto("gastos", cat)
      );
      tdActions.appendChild(delBtn);

      tr.appendChild(tdCat);
      tr.appendChild(tdAmt);
      tr.appendChild(tdActions);
      preGasTableBody.appendChild(tr);
    });
  }
}

if (preFacSaveBtn) {
  preFacSaveBtn.addEventListener("click", () => savePresupuesto("facturas"));
}
if (preGasSaveBtn) {
  preGasSaveBtn.addEventListener("click", () => savePresupuesto("gastos"));
}

// === Click tarjeta BALANCE TOTAL 2026 -> vista ahorro ===
const totalSavingCard = document.getElementById("total-saving-card");
if (totalSavingCard) {
  totalSavingCard.addEventListener("click", () => {
    showView("savings-view");
  });
}

// Segmented control: RESUMEN MES / RESUMEN 2026
const summaryTabs = document.querySelectorAll(".summary-tab");
const summaryPanels = {
  "month-expenses-panel": document.getElementById("month-expenses-panel"),
  "year-grid-panel": document.getElementById("year-grid-panel")
};

// pastilla amarilla deslizante
const summarySwitch = document.querySelector(".summary-switch");
let summaryHighlight = null;

if (summarySwitch && summaryTabs.length > 0) {
  summaryHighlight = document.createElement("div");
  summaryHighlight.className = "summary-highlight";
  summarySwitch.prepend(summaryHighlight); // va debajo de los botones
}

// mueve la highlight bajo el tab activo
function moveSummaryHighlight(targetTab) {
  if (!summaryHighlight || !summarySwitch || !targetTab) return;
  const switchRect = summarySwitch.getBoundingClientRect();
  const tabRect = targetTab.getBoundingClientRect();

  const leftInside = tabRect.left - switchRect.left;

  summaryHighlight.style.width = tabRect.width + "px";
  summaryHighlight.style.transform = `translateX(${leftInside}px)`;
}

// listeners tabs resumen
summaryTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const targetId = tab.getAttribute("data-target");

    summaryTabs.forEach((t) => {
      t.classList.toggle("active", t === tab);
    });

    Object.entries(summaryPanels).forEach(([id, panel]) => {
      if (!panel) return;
      panel.classList.toggle("open", id === targetId);
    });

    moveSummaryHighlight(tab);
  });
});

// === Toggle DETALLE POR MES en AHORRO ===
const savingsDetailToggle = document.querySelector(".savings-detail-toggle");
const savingsDetailPanel = document.getElementById("savings-detail-panel");

if (savingsDetailToggle && savingsDetailPanel) {
  savingsDetailToggle.addEventListener("click", () => {
    const isOpen = savingsDetailPanel.classList.toggle("open");
    savingsDetailToggle.classList.toggle("open", isOpen);
  });
}

// === Info overlay EVOLUCIÓN ===
const evolutionInfoBtn = document.querySelector("#savings-view .info-icon-btn");
const evolutionInfoOverlay = document.getElementById("evolution-info-overlay");
const evolutionInfoClose = document.querySelector(
  "#evolution-info-overlay .btn-close-info"
);

if (evolutionInfoBtn && evolutionInfoOverlay) {
  evolutionInfoBtn.addEventListener("click", () => {
    evolutionInfoOverlay.classList.add("open");
  });
}

if (evolutionInfoClose && evolutionInfoOverlay) {
  evolutionInfoClose.addEventListener("click", () => {
    evolutionInfoOverlay.classList.remove("open");
  });
}

if (evolutionInfoOverlay) {
  evolutionInfoOverlay.addEventListener("click", (e) => {
    if (e.target === evolutionInfoOverlay) {
      evolutionInfoOverlay.classList.remove("open");
    }
  });
}

// === Init ===
function init() {
  const anyDate = new Date(TARGET_YEAR, selectedMonth, 1)
    .toISOString()
    .slice(0, 10);

  if (ingDate) ingDate.value = anyDate;
  if (facDate) facDate.value = anyDate;
  if (gasDate) gasDate.value = anyDate;

  resetIngresosForm();
  resetFacturasForm();
  resetGastosForm();

  renderYearDashboard();
  renderPresupuestoTables();
  if (typeof renderOverview === "function") renderOverview();
  updateMonthLabels();

  // panel por defecto: resumen mes abierto, resumen 2026 cerrado
  const monthPanel = document.getElementById("month-expenses-panel");
  const yearPanel = document.getElementById("year-grid-panel");
  if (monthPanel) monthPanel.classList.add("open");
  if (yearPanel) yearPanel.classList.remove("open");

  // colocar la pastilla amarilla debajo de la pestaña activa
  const activeTab = document.querySelector(".summary-tab.active");
  if (activeTab) {
    setTimeout(() => moveSummaryHighlight(activeTab), 0);
  }
}

init();
