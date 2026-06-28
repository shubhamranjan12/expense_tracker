"use strict";

// ---------------------------------------------------------------------------
// Expense Tracker frontend — thin client over the DRF API at /api/expenses/.
// All validation/business rules live in the API; this is a convenience UI.
// ---------------------------------------------------------------------------

const API = "/api/expenses/";

// --- DOM refs ---------------------------------------------------------------
const els = {
  form: document.getElementById("expense-form"),
  reason: document.getElementById("reason"),
  amount: document.getElementById("amount"),
  date: document.getElementById("date"),
  submitBtn: document.getElementById("submit-btn"),
  filterDate: document.getElementById("filter-date"),
  filterClear: document.getElementById("filter-clear"),
  list: document.getElementById("expense-list"),
  total: document.getElementById("total"),
  loading: document.getElementById("loading"),
  empty: document.getElementById("empty"),
  banner: document.getElementById("banner"),
  rowTemplate: document.getElementById("row-template"),
};

// --- Helpers ----------------------------------------------------------------
function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function getCookie(name) {
  const match = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
  return match ? decodeURIComponent(match.pop()) : "";
}

function fmtAmount(value) {
  return Number(value).toFixed(2);
}

async function apiRequest(url, options = {}) {
  const opts = { headers: {}, ...options };
  if (opts.body) {
    opts.headers["Content-Type"] = "application/json";
  }
  if (!["GET", "HEAD", "OPTIONS"].includes((opts.method || "GET").toUpperCase())) {
    opts.headers["X-CSRFToken"] = getCookie("csrftoken");
  }
  const res = await fetch(url, opts);
  let data = null;
  if (res.status !== 204) {
    try { data = await res.json(); } catch (_) { data = null; }
  }
  if (!res.ok) {
    const err = new Error("Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// --- UI state ---------------------------------------------------------------
function setBanner(message, type) {
  if (!message) {
    els.banner.hidden = true;
    els.banner.textContent = "";
    els.banner.className = "banner";
    return;
  }
  els.banner.textContent = message;
  els.banner.className = `banner banner--${type}`;
  els.banner.hidden = false;
}

function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
}

function showFieldErrors(data) {
  // DRF returns { field: ["msg", ...], ... } and/or non_field_errors / detail.
  if (!data || typeof data !== "object") {
    setBanner("Something went wrong. Please try again.", "error");
    return;
  }
  let hadField = false;
  for (const [field, messages] of Object.entries(data)) {
    const target = document.querySelector(`[data-error-for="${field}"]`);
    const text = Array.isArray(messages) ? messages.join(" ") : String(messages);
    if (target) {
      target.textContent = text;
      hadField = true;
    } else if (field === "non_field_errors" || field === "detail") {
      setBanner(text, "error");
    }
  }
  if (!hadField && els.banner.hidden) {
    setBanner("Please check the form and try again.", "error");
  }
}

// --- Rendering --------------------------------------------------------------
function renderList(expenses) {
  els.list.innerHTML = "";
  let total = 0;

  for (const expense of expenses) {
    total += Number(expense.amount);
    const node = els.rowTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = expense.id;
    node.querySelector(".expense__reason").textContent = expense.reason;
    node.querySelector(".expense__date").textContent = expense.date;
    node.querySelector(".expense__amount").textContent = fmtAmount(expense.amount);

    node.querySelector('[data-action="delete"]').addEventListener("click", () =>
      handleDelete(expense)
    );
    node.querySelector('[data-action="edit"]').addEventListener("click", () =>
      startEdit(node, expense)
    );
    els.list.appendChild(node);
  }

  els.total.textContent = fmtAmount(total);
  els.empty.hidden = expenses.length > 0;
}

// --- Data load --------------------------------------------------------------
async function loadExpenses() {
  setBanner(null);
  els.loading.hidden = false;
  els.empty.hidden = true;
  try {
    const date = els.filterDate.value;
    const url = date ? `${API}?date=${encodeURIComponent(date)}` : API;
    const expenses = await apiRequest(url);
    renderList(expenses);
  } catch (err) {
    els.list.innerHTML = "";
    els.total.textContent = "0.00";
    setBanner("Could not load expenses. Is the server running?", "error");
  } finally {
    els.loading.hidden = true;
  }
}

// --- Create -----------------------------------------------------------------
async function handleSubmit(event) {
  event.preventDefault();
  clearFieldErrors();
  setBanner(null);

  const payload = {
    reason: els.reason.value.trim(),
    amount: els.amount.value,
    date: els.date.value || todayISO(),
  };

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Adding…";
  try {
    await apiRequest(API, { method: "POST", body: JSON.stringify(payload) });
    els.form.reset();
    els.date.value = todayISO();
    setBanner("Expense added.", "success");
    await loadExpenses();
  } catch (err) {
    if (err.status === 400) showFieldErrors(err.data);
    else setBanner("Could not add expense. Please try again.", "error");
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Add";
  }
}

// --- Delete -----------------------------------------------------------------
async function handleDelete(expense) {
  if (!confirm(`Delete "${expense.reason}" (${fmtAmount(expense.amount)})?`)) return;
  try {
    await apiRequest(`${API}${expense.id}/`, { method: "DELETE" });
    await loadExpenses();
  } catch (err) {
    setBanner("Could not delete expense.", "error");
  }
}

// --- Inline edit ------------------------------------------------------------
function startEdit(node, expense) {
  node.classList.add("expense--editing");
  node.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "expense__edit";
  wrap.innerHTML = `
    <input type="text" value="" maxlength="255" data-edit="reason" />
    <input type="number" min="0.01" step="0.01" value="" data-edit="amount" />
    <input type="date" value="" data-edit="date" />
    <span class="expense__actions">
      <button type="button" class="btn btn--primary" data-action="save">Save</button>
      <button type="button" class="btn btn--ghost" data-action="cancel">Cancel</button>
    </span>
  `;
  wrap.querySelector('[data-edit="reason"]').value = expense.reason;
  wrap.querySelector('[data-edit="amount"]').value = expense.amount;
  wrap.querySelector('[data-edit="date"]').value = expense.date;
  node.appendChild(wrap);

  wrap.querySelector('[data-action="cancel"]').addEventListener("click", loadExpenses);
  wrap.querySelector('[data-action="save"]').addEventListener("click", async () => {
    const payload = {
      reason: wrap.querySelector('[data-edit="reason"]').value.trim(),
      amount: wrap.querySelector('[data-edit="amount"]').value,
      date: wrap.querySelector('[data-edit="date"]').value,
    };
    try {
      await apiRequest(`${API}${expense.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setBanner("Expense updated.", "success");
      await loadExpenses();
    } catch (err) {
      if (err.status === 400) {
        const msgs = err.data && typeof err.data === "object"
          ? Object.values(err.data).flat().join(" ")
          : "Invalid values.";
        setBanner(`Could not save: ${msgs}`, "error");
      } else {
        setBanner("Could not save expense.", "error");
      }
    }
  });
}

// --- Wire up ----------------------------------------------------------------
function init() {
  els.date.value = todayISO();
  els.form.addEventListener("submit", handleSubmit);
  els.filterDate.addEventListener("change", loadExpenses);
  els.filterClear.addEventListener("click", () => {
    els.filterDate.value = "";
    loadExpenses();
  });
  loadExpenses();
}

document.addEventListener("DOMContentLoaded", init);
