const STORAGE_KEY = "infra-cost-visualizer-state";

const modelMultipliers = {
  "on-demand": 1,
  reserved: 0.72,
  spot: 0.35,
};

const currencySymbols = {
  USD: "$",
  EUR: "EUR ",
  GBP: "GBP ",
};

// Approximate exchange rates relative to USD for quick scenario planning.
const exchangeRates = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
};

const modelColors = {
  "on-demand": "#326ea8",
  reserved: "#6d8fb4",
  spot: "#9aaec6",
};

const els = {
  rowTemplate: document.getElementById("rowTemplate"),
  resourceBody: document.getElementById("resourceBody"),
  addRowBtn: document.getElementById("addRowBtn"),
  resetBtn: document.getElementById("resetBtn"),
  currencySelect: document.getElementById("currencySelect"),
  monthlyTotal: document.getElementById("monthlyTotal"),
  annualTotal: document.getElementById("annualTotal"),
  topCategory: document.getElementById("topCategory"),
  resourceCount: document.getElementById("resourceCount"),
  budgetDelta: document.getElementById("budgetDelta"),
  monthlyBudget: document.getElementById("monthlyBudget"),
  scenarioName: document.getElementById("scenarioName"),
  scenarioTag: document.getElementById("scenarioTag"),
  healthNote: document.getElementById("healthNote"),
  forecastTag: document.getElementById("forecastTag"),
  categoryBars: document.getElementById("categoryBars"),
  modelDonut: document.getElementById("modelDonut"),
  donutLegend: document.getElementById("donutLegend"),
  forecastLine: document.getElementById("forecastLine"),
  growthRate: document.getElementById("growthRate"),
  growthValue: document.getElementById("growthValue"),
  presetSaas: document.getElementById("presetSaas"),
  presetData: document.getElementById("presetData"),
  presetEdge: document.getElementById("presetEdge"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  importFile: document.getElementById("importFile"),
  dropZone: document.getElementById("dropZone"),
  importStatus: document.getElementById("importStatus"),
  recommendationList: document.getElementById("recommendationList"),
  saveServerBtn: document.getElementById("saveServerBtn"),
  loadServerBtn: document.getElementById("loadServerBtn"),
};

const csvRequiredHeaders = ["service", "category", "model", "qty", "units", "price", "discount"];

function setImportStatus(message, type = "") {
  els.importStatus.textContent = message;
  els.importStatus.classList.remove("error", "success");
  if (type) els.importStatus.classList.add(type);
}

function isServedOverHttp() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

async function apiFetch(path, options) {
  if (!isServedOverHttp()) {
    throw new Error("Run the app via `npm run dev` to use Save/Load (backend API isn't available from a file:// page).");
  }

  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });

  if (res.status === 204) return null;

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg = body?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return body;
}

function buildScenarioPayloadFromUi() {
  return {
    name: (els.scenarioName.value || "").trim() || "Custom",
    currency: els.currencySelect.value,
    growthRate: Number(els.growthRate.value),
    monthlyBudget: Number(els.monthlyBudget.value) || 0,
    rows: getRowsFromUI(),
  };
}

async function saveScenarioToServer() {
  els.saveServerBtn.disabled = true;
  try {
    const payload = buildScenarioPayloadFromUi();
    await apiFetch("/api/scenarios", { method: "POST", body: JSON.stringify(payload) });
    setImportStatus("Saved to server.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed.";
    setImportStatus(message, "error");
  } finally {
    els.saveServerBtn.disabled = false;
  }
}

async function loadScenarioFromServer() {
  els.loadServerBtn.disabled = true;
  try {
    const list = await apiFetch("/api/scenarios", { method: "GET" });
    const items = list?.items || [];
    if (!items.length) {
      setImportStatus("No saved scenarios on the server yet.", "error");
      return;
    }

    const choices = items
      .slice(0, 20)
      .map((x, i) => `${i + 1}. ${x.name} (${x.id.slice(0, 8)})`)
      .join("\n");
    const input = window.prompt(
      `Choose a scenario to load:\n\n${choices}\n\nEnter 1-${Math.min(items.length, 20)}:`
    );
    const idx = Number(input);
    if (!Number.isFinite(idx) || idx < 1 || idx > Math.min(items.length, 20)) return;

    const chosen = items[idx - 1];
    const detail = await apiFetch(`/api/scenarios/${chosen.id}`, { method: "GET" });
    const scenario = detail?.item;
    if (!scenario) throw new Error("Scenario not found.");

    els.resourceBody.innerHTML = "";
    (scenario.rows || []).forEach(addRow);
    els.scenarioName.value = scenario.name || "Custom";
    els.currencySelect.value = scenario.currency || "USD";
    els.growthRate.value = String(scenario.growthRate ?? 4);
    els.monthlyBudget.value = String(scenario.monthlyBudget ?? 0);
    recalculateAndRender();

    setImportStatus("Loaded from server.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed.";
    setImportStatus(message, "error");
  } finally {
    els.loadServerBtn.disabled = false;
  }
}

function csvEscape(value) {
  const raw = String(value ?? "");
  if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
    return `"${raw.replace(/\"/g, '""')}"`;
  }
  return raw;
}

function exportRowsAsCsv() {
  const rows = getRowsFromUI();
  const headers = ["service", "category", "model", "qty", "units", "price", "discount"];
  const lines = [headers.join(",")];

  rows.forEach((row) => {
    lines.push(
      headers
        .map((key) => csvEscape(row[key]))
        .join(",")
    );
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "infrastructure-costs.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  out.push(current);
  return out;
}

function importRowsFromCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV is empty or missing row data.");
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const index = (name) => headers.indexOf(name);
  const missingHeaders = csvRequiredHeaders.filter((key) => index(key) === -1);
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(", ")}.`);
  }

  const importedRows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      service: cols[index("service")] || "Imported Service",
      category: cols[index("category")] || "Other",
      model: cols[index("model")] || "on-demand",
      qty: Number(cols[index("qty")]) || 0,
      units: Number(cols[index("units")]) || 0,
      price: Number(cols[index("price")]) || 0,
      discount: Number(cols[index("discount")]) || 0,
    };
  });

  if (!importedRows.length) {
    throw new Error("No valid data rows were found.");
  }

  els.resourceBody.innerHTML = "";
  importedRows.forEach(addRow);
  recalculateAndRender();
  setImportStatus(`Imported ${importedRows.length} row(s) successfully.`, "success");
}

async function handleImportFile(file) {
  if (!file) return;

  const fileName = (file.name || "").toLowerCase();
  const looksLikeCsv = fileName.endsWith(".csv") || file.type.includes("csv");
  if (!looksLikeCsv) {
    setImportStatus("Please upload a CSV file.", "error");
    return;
  }

  try {
    const text = await file.text();
    importRowsFromCsv(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed. Please check the CSV format.";
    setImportStatus(message, "error");
  }
}

function renderRecommendations(rows, monthlyUsd, topCategory, deltaUsd) {
  const tips = [];

  if (rows.length === 0) {
    tips.push("Add at least one resource to generate recommendations.");
  }

  if (topCategory && monthlyUsd > 0) {
    const share = Math.round((topCategory[1] / monthlyUsd) * 100);
    tips.push(`${topCategory[0]} is the main cost driver at ${share}% of monthly spend.`);
  }

  if (deltaUsd > 0) {
    tips.push("Current plan is over budget. Focus on high-volume compute and network workloads first.");
  } else {
    tips.push("Current plan is within budget. Consider reserving stable workloads for additional savings.");
  }

  const onDemandRows = rows.filter((r) => r.model === "on-demand");
  if (onDemandRows.length > 0) {
    const heavyOnDemand = [...onDemandRows]
      .sort((a, b) => monthlyCost(b) - monthlyCost(a))[0];
    tips.push(`Largest on-demand item: ${heavyOnDemand.service}. Evaluate reserved pricing for this service.`);
  }

  els.recommendationList.innerHTML = "";
  tips.slice(0, 4).forEach((tip) => {
    const li = document.createElement("li");
    li.textContent = tip;
    els.recommendationList.appendChild(li);
  });
}

const presets = {
  saas: {
    scenarioName: "SaaS Production",
    monthlyBudget: 12000,
    growthRate: 5,
    rows: [
      { service: "Web App Nodes", category: "Compute", model: "reserved", qty: 8, units: 730, price: 0.11, discount: 0 },
      { service: "Managed PostgreSQL", category: "Database", model: "on-demand", qty: 2, units: 730, price: 0.63, discount: 0 },
      { service: "Object Storage", category: "Storage", model: "reserved", qty: 24, units: 1, price: 20, discount: 8 },
      { service: "CDN + WAF Traffic", category: "Networking", model: "spot", qty: 18, units: 100, price: 0.085, discount: 0 },
      { service: "Logging + APM", category: "Monitoring", model: "on-demand", qty: 1, units: 1, price: 780, discount: 0 },
    ],
  },
  data: {
    scenarioName: "Data Platform",
    monthlyBudget: 22000,
    growthRate: 7,
    rows: [
      { service: "ETL Workers", category: "Compute", model: "spot", qty: 22, units: 730, price: 0.1, discount: 0 },
      { service: "Warehouse Cluster", category: "Database", model: "on-demand", qty: 3, units: 730, price: 1.9, discount: 0 },
      { service: "Raw Data Lake", category: "Storage", model: "reserved", qty: 120, units: 1, price: 17, discount: 12 },
      { service: "Streaming Pipeline", category: "Networking", model: "on-demand", qty: 1, units: 1, price: 2600, discount: 0 },
      { service: "Security Scanning", category: "Security", model: "reserved", qty: 1, units: 1, price: 980, discount: 5 },
    ],
  },
  edge: {
    scenarioName: "Edge API Global",
    monthlyBudget: 9000,
    growthRate: 4,
    rows: [
      { service: "Regional API Nodes", category: "Compute", model: "reserved", qty: 10, units: 730, price: 0.13, discount: 0 },
      { service: "Redis Cache", category: "Database", model: "on-demand", qty: 2, units: 730, price: 0.34, discount: 0 },
      { service: "Edge Transfer", category: "Networking", model: "spot", qty: 42, units: 100, price: 0.07, discount: 0 },
      { service: "Image Storage", category: "Storage", model: "reserved", qty: 30, units: 1, price: 19, discount: 5 },
      { service: "Observability", category: "Monitoring", model: "on-demand", qty: 1, units: 1, price: 540, discount: 0 },
    ],
  },
};

function getCanvasSurface(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  return { ctx, width, height };
}

function modelLabel(model) {
  if (model === "on-demand") return "On-Demand";
  if (model === "reserved") return "Reserved";
  if (model === "spot") return "Spot";
  return model;
}

function formatCurrency(value, currency) {
  const symbol = currencySymbols[currency] || "$";
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getDefaultRows() {
  return [
    {
      service: "Compute Node",
      category: "Compute",
      model: "on-demand",
      qty: 6,
      units: 730,
      price: 0.14,
      discount: 0,
    },
    {
      service: "Object Storage",
      category: "Storage",
      model: "reserved",
      qty: 18,
      units: 1,
      price: 23,
      discount: 5,
    },
    {
      service: "Managed Database",
      category: "Database",
      model: "on-demand",
      qty: 2,
      units: 730,
      price: 0.55,
      discount: 0,
    },
    {
      service: "CDN Egress",
      category: "Networking",
      model: "spot",
      qty: 12,
      units: 100,
      price: 0.09,
      discount: 0,
    },
  ];
}

function readRow(tr) {
  const value = (selector) => tr.querySelector(selector).value;
  return {
    service: value(".service").trim() || "Untitled Service",
    category: value(".category"),
    model: value(".model"),
    qty: Number(value(".qty")) || 0,
    units: Number(value(".units")) || 0,
    price: Number(value(".price")) || 0,
    discount: Number(value(".discount")) || 0,
  };
}

function monthlyCost(row) {
  const base = row.qty * row.units * row.price;
  const discountFactor = 1 - Math.min(Math.max(row.discount, 0), 100) / 100;
  const modelFactor = modelMultipliers[row.model] ?? 1;
  return base * discountFactor * modelFactor;
}

function renderRow(row) {
  const fragment = els.rowTemplate.content.cloneNode(true);
  const tr = fragment.querySelector("tr");

  tr.querySelector(".service").value = row.service;
  tr.querySelector(".category").value = row.category;
  tr.querySelector(".model").value = row.model;
  tr.querySelector(".qty").value = row.qty;
  tr.querySelector(".units").value = row.units;
  tr.querySelector(".price").value = row.price;
  tr.querySelector(".discount").value = row.discount;

  tr.querySelector(".remove").addEventListener("click", () => {
    tr.remove();
    recalculateAndRender();
  });

  tr.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", () => recalculateAndRender());
  });

  els.resourceBody.appendChild(fragment);
}

function getRowsFromUI() {
  return [...els.resourceBody.querySelectorAll("tr")].map((tr) => readRow(tr));
}

function saveState(rows, currency, growthRate) {
  const payload = {
    rows,
    currency,
    growthRate,
    scenarioName: els.scenarioName.value,
    monthlyBudget: Number(els.monthlyBudget.value) || 0,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function aggregateByKey(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const k = row[key];
    const current = map.get(k) || 0;
    map.set(k, current + monthlyCost(row));
  }
  return map;
}

function drawCategoryBars(categoryMap, currency) {
  els.categoryBars.innerHTML = "";
  const entries = [...categoryMap.entries()].sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    els.categoryBars.textContent = "No category data yet.";
    return;
  }

  const maxValue = entries[0][1] || 1;

  const swatches = [
    ["#2f679d", "#5684b4"],
    ["#4d769f", "#7998bc"],
    ["#6a87a8", "#93abc5"],
    ["#7f96b0", "#a8bacd"],
  ];

  entries.forEach(([category, cost], index) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("span");
    label.textContent = category;

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${(cost / maxValue) * 100}%`;
    const [start, end] = swatches[index % swatches.length];
    fill.style.background = `linear-gradient(90deg, ${start}, ${end})`;

    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = formatCurrency(convert(cost, currency), currency);

    track.appendChild(fill);
    row.append(label, track, value);
    els.categoryBars.appendChild(row);
  });
}

function drawDonut(modelMap, currency) {
  const canvas = els.modelDonut;
  const { ctx, width, height } = getCanvasSurface(canvas);

  const entries = [...modelMap.entries()];
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  els.donutLegend.innerHTML = "";

  if (!total) {
    ctx.fillStyle = "#41576e";
    ctx.font = "16px IBM Plex Sans";
    ctx.fillText("No pricing model data", 20, 34);
    return;
  }

  const cx = width / 2;
  const cy = height / 2;
  const radius = 88;
  const innerRadius = 54;

  let start = -Math.PI / 2;
  entries.forEach(([model, value]) => {
    const angle = (value / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = modelColors[model] || "#5f7780";
    ctx.fill();

    start += angle;

    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <span class="legend-dot" style="background:${modelColors[model] || "#5f7780"}"></span>
      <span>${modelLabel(model)} (${Math.round((value / total) * 100)}%) - ${formatCurrency(convert(value, currency), currency)}</span>
    `;
    els.donutLegend.appendChild(item);
  });

  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.fillStyle = "#2f455d";
  ctx.font = "600 14px IBM Plex Mono";
  const totalText = formatCurrency(convert(total, currency), currency);
  const textX = cx - ctx.measureText(totalText).width / 2;
  ctx.fillText(totalText, textX, cy + 4);
}

function drawForecast(monthlyBase, growthRate, currency) {
  const canvas = els.forecastLine;
  const { ctx, width, height } = getCanvasSurface(canvas);

  const pad = { top: 26, right: 26, bottom: 34, left: 44 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const points = [];
  for (let month = 0; month < 12; month += 1) {
    const projected = monthlyBase * Math.pow(1 + growthRate / 100, month);
    points.push(projected);
  }

  const maxY = Math.max(...points, 1);
  const minY = Math.min(...points, 0);

  const yFor = (value) => {
    const domain = maxY - minY || 1;
    return pad.top + chartH - ((value - minY) / domain) * chartH;
  };

  ctx.strokeStyle = "rgba(75, 97, 120, 0.3)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();

    const v = maxY - ((maxY - minY) * i) / 4;
    ctx.fillStyle = "#5f7389";
    ctx.font = "11px IBM Plex Mono";
    ctx.fillText(formatCurrency(convert(v, currency), currency), 8, y + 4);
  }

  ctx.beginPath();
  points.forEach((value, index) => {
    const x = pad.left + (chartW * index) / 11;
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  const areaGradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  areaGradient.addColorStop(0, "rgba(50, 110, 168, 0.2)");
  areaGradient.addColorStop(1, "rgba(50, 110, 168, 0.02)");
  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.lineTo(pad.left, pad.top + chartH);
  ctx.closePath();
  ctx.fillStyle = areaGradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((value, index) => {
    const x = pad.left + (chartW * index) / 11;
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#326ea8";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  points.forEach((value, index) => {
    const x = pad.left + (chartW * index) / 11;
    const y = yFor(value);

    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "#5f89b2";
    ctx.fill();

    if (index === 0 || index === 11) {
      const label = index === 0 ? "Now" : "12mo";
      ctx.fillStyle = "#49617a";
      ctx.font = "12px IBM Plex Sans";
      ctx.fillText(label, x - 11, height - 12);

      ctx.fillStyle = "#3d556f";
      ctx.font = "11px IBM Plex Mono";
      const valueText = formatCurrency(convert(value, currency), currency);
      ctx.fillText(valueText, x - 24, y - 10);
    }
  });

  return points[points.length - 1] || 0;
}

function convert(usdAmount, currency) {
  const rate = exchangeRates[currency] || 1;
  return usdAmount * rate;
}

function recalculateAndRender() {
  const rows = getRowsFromUI();
  const currency = els.currencySelect.value;
  const growthRate = Number(els.growthRate.value);
  els.growthValue.value = `${growthRate}%`;

  const costsByRow = rows.map((r) => monthlyCost(r));
  [...els.resourceBody.querySelectorAll("tr")].forEach((tr, i) => {
    tr.querySelector(".cost-cell").textContent = formatCurrency(
      convert(costsByRow[i], currency),
      currency
    );
  });

  const monthlyUsd = costsByRow.reduce((sum, v) => sum + v, 0);
  const annualUsd = monthlyUsd * 12;
  const categoryMap = aggregateByKey(rows, "category");
  const modelMap = aggregateByKey(rows, "model");
  const budgetUsd = Number(els.monthlyBudget.value) || 0;

  const topCategory = [...categoryMap.entries()].sort((a, b) => b[1] - a[1])[0];

  els.monthlyTotal.textContent = formatCurrency(convert(monthlyUsd, currency), currency);
  els.annualTotal.textContent = formatCurrency(convert(annualUsd, currency), currency);
  els.topCategory.textContent = topCategory ? topCategory[0] : "-";
  els.resourceCount.textContent = String(rows.length);

  const deltaUsd = monthlyUsd - budgetUsd;
  const deltaCard = els.budgetDelta.closest(".metric-card");
  deltaCard.classList.toggle("metric-over", deltaUsd > 0);
  deltaCard.classList.toggle("metric-under", deltaUsd <= 0);
  const deltaLabel = deltaUsd > 0 ? "Over " : "Under ";
  els.budgetDelta.textContent = `${deltaLabel}${formatCurrency(
    convert(Math.abs(deltaUsd), currency),
    currency
  )}`;

  const topShare = topCategory && monthlyUsd > 0 ? Math.round((topCategory[1] / monthlyUsd) * 100) : 0;
  const scenarioName = els.scenarioName.value.trim() || "Custom";
  const modeText = deltaUsd > 0 ? "Over Budget" : "Within Budget";
  els.scenarioTag.textContent = `${scenarioName} | ${modeText}`;
  els.healthNote.textContent = topCategory
    ? `${topCategory[0]} represents about ${topShare}% of monthly spend.`
    : "Add at least one resource to generate spending insights.";

  drawCategoryBars(categoryMap, currency);
  drawDonut(modelMap, currency);
  const month12Usd = drawForecast(monthlyUsd, growthRate, currency);
  els.forecastTag.textContent = `Projected month-12 total: ${formatCurrency(
    convert(month12Usd, currency),
    currency
  )}`;

  renderRecommendations(rows, monthlyUsd, topCategory, deltaUsd);

  saveState(rows, currency, growthRate);
}

function addRow(row) {
  renderRow(
    row || {
      service: "New Service",
      category: "Compute",
      model: "on-demand",
      qty: 1,
      units: 730,
      price: 0.1,
      discount: 0,
    }
  );
}

function resetApp() {
  els.resourceBody.innerHTML = "";
  getDefaultRows().forEach(addRow);
  els.currencySelect.value = "USD";
  els.growthRate.value = "4";
  els.monthlyBudget.value = "8000";
  els.scenarioName.value = "Q2 Production";
  recalculateAndRender();
}

function applyPreset(name) {
  const preset = presets[name];
  if (!preset) return;

  els.resourceBody.innerHTML = "";
  preset.rows.forEach(addRow);
  els.scenarioName.value = preset.scenarioName;
  els.monthlyBudget.value = String(preset.monthlyBudget);
  els.growthRate.value = String(preset.growthRate);
  recalculateAndRender();
}

function hydrate() {
  const state = loadState();

  if (state?.rows?.length) {
    state.rows.forEach(addRow);
    els.currencySelect.value = state.currency || "USD";
    els.growthRate.value = String(state.growthRate ?? 4);
    els.monthlyBudget.value = String(state.monthlyBudget ?? 8000);
    els.scenarioName.value = state.scenarioName || "Q2 Production";
  } else {
    getDefaultRows().forEach(addRow);
  }

  recalculateAndRender();
}

els.addRowBtn.addEventListener("click", () => {
  addRow();
  recalculateAndRender();
});

els.resetBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  resetApp();
});

els.currencySelect.addEventListener("change", recalculateAndRender);
els.growthRate.addEventListener("input", recalculateAndRender);
els.monthlyBudget.addEventListener("input", recalculateAndRender);
els.scenarioName.addEventListener("input", recalculateAndRender);
els.presetSaas.addEventListener("click", () => applyPreset("saas"));
els.presetData.addEventListener("click", () => applyPreset("data"));
els.presetEdge.addEventListener("click", () => applyPreset("edge"));
els.exportBtn.addEventListener("click", exportRowsAsCsv);
els.importBtn.addEventListener("click", () => els.importFile.click());
els.saveServerBtn.addEventListener("click", saveScenarioToServer);
els.loadServerBtn.addEventListener("click", loadScenarioFromServer);
els.dropZone.addEventListener("click", () => els.importFile.click());
els.dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    els.importFile.click();
  }
});
els.importFile.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  await handleImportFile(file);
  event.target.value = "";
});

["dragenter", "dragover"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("is-dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("is-dragover");
  });
});

els.dropZone.addEventListener("drop", async (event) => {
  const [file] = event.dataTransfer?.files || [];
  await handleImportFile(file);
});

let resizeTimer;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(recalculateAndRender, 120);
});

hydrate();
