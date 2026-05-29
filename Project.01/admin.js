const ADMIN_PASSWORD = "anthony2026";
let currentTab = "all";
let cachedRows = [];

const $ = (id) => document.getElementById(id);

function checkSupabase() {
  if (!window.sb) {
    alert("Supabase não carregou. Confira se supabase.js foi colocado antes do admin.js no admin.html.");
    return false;
  }
  return true;
}

async function getRsvps() {
  if (!checkSupabase()) return {};

  const { data, error } = await window.sb
    .from("rsvps")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar confirmações:", error);
    alert("Erro ao carregar confirmações. Veja o Console/F12.");
    return {};
  }

  const map = {};
  (data || []).forEach(r => {
    map[r.family_key] = {
      attending: r.attending || [],
      notAttending: r.not_attending || [],
      message: r.message || "",
      createdAt: r.created_at || "",
    };
  });

  return map;
}

async function getRows() {
  const rsvps = await getRsvps();
  return FAMILIAS.map(f => {
    const r = rsvps[f.key];
    const attending = r?.attending || [];
    const notAttending = r?.notAttending || [];
    const pending = r ? [] : f.members;
    return {
      family: f,
      answered: Boolean(r),
      attending,
      notAttending,
      pending,
      message: r?.message || "",
      createdAt: r?.createdAt || "",
    };
  });
}

function renderStats(rows) {
  const totalGuests = FAMILIAS.reduce((s, f) => s + f.members.length, 0);
  const totalGoing = rows.reduce((s, r) => s + r.attending.length, 0);
  const totalNotGoing = rows.reduce((s, r) => s + r.notAttending.length, 0);
  const totalPending = rows.reduce((s, r) => s + r.pending.length, 0);
  $("totalGuests").textContent = totalGuests;
  $("totalGoing").textContent = totalGoing;
  $("totalNotGoing").textContent = totalNotGoing;
  $("totalPending").textContent = totalPending;
}

function privateLink(f) {
  return `${window.location.origin}/?convite=${encodeURIComponent(f.key)}`;
}

function filterRows(rows) {
  if (currentTab === "going") return rows.filter(r => r.attending.length > 0);
  if (currentTab === "notgoing") return rows.filter(r => r.notAttending.length > 0);
  if (currentTab === "pending") return rows.filter(r => !r.answered);
  return rows;
}

async function renderTable() {
  const rows = await getRows();
  cachedRows = rows;
  renderStats(rows);
  const filtered = filterRows(rows);
  $("adminRows").innerHTML = filtered.map(r => `
    <tr>
      <td><strong>${r.family.title}</strong><small>${r.family.members.length} convidado(s)</small></td>
      <td><code>${r.family.codigo}</code></td>
      <td><input readonly value="${privateLink(r.family)}" onclick="this.select()"></td>
      <td class="yes">${r.attending.length ? r.attending.join("<br>") : "—"}</td>
      <td class="no">${r.notAttending.length ? r.notAttending.join("<br>") : "—"}</td>
      <td>${r.pending.length ? r.pending.join("<br>") : "—"}</td>
      <td>${r.message || "—"}</td>
      <td>${r.createdAt ? new Date(r.createdAt).toLocaleString("pt-BR") : "—"}</td>
    </tr>
  `).join("");
}

async function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab").forEach(btn => btn.classList.remove("active"));
  $({ all: "tabAll", going: "tabGoing", notgoing: "tabNotGoing", pending: "tabPending" }[tab]).classList.add("active");
  await renderTable();
}

function csvEscape(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

async function exportCsv() {
  const rows = cachedRows.length ? cachedRows : await getRows();
  const data = [["Família", "Código", "Link privado", "Vai", "Não vai", "Pendente", "Mensagem", "Data"]];
  rows.forEach(r => data.push([
    r.family.title,
    r.family.codigo,
    privateLink(r.family),
    r.attending.join(", "),
    r.notAttending.join(", "),
    r.pending.join(", "),
    r.message,
    r.createdAt ? new Date(r.createdAt).toLocaleString("pt-BR") : "",
  ]));
  const csv = data.map(row => row.map(csvEscape).join(";")).join("\n");
  downloadFile("confirmacoes-anthony.csv", "text/csv;charset=utf-8", "\uFEFF" + csv);
}

async function exportDoc() {
  const rows = cachedRows.length ? cachedRows : await getRows();
  let html = `<html><head><meta charset="UTF-8"><title>Confirmações Anthony</title></head><body>`;
  html += `<h1>Confirmações — Anthony 1 ano</h1>`;
  rows.forEach(r => {
    html += `<h2>${r.family.title}</h2>`;
    html += `<p><strong>Código:</strong> ${r.family.codigo}</p>`;
    html += `<p><strong>Vão:</strong> ${r.attending.length ? r.attending.join(", ") : "—"}</p>`;
    html += `<p><strong>Não vão:</strong> ${r.notAttending.length ? r.notAttending.join(", ") : "—"}</p>`;
    html += `<p><strong>Pendentes:</strong> ${r.pending.length ? r.pending.join(", ") : "—"}</p>`;
    html += `<p><strong>Mensagem:</strong> ${r.message || "—"}</p><hr>`;
  });
  html += `</body></html>`;
  downloadFile("confirmacoes-anthony.doc", "application/msword", html);
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setupLogin() {
  if (sessionStorage.getItem("anthony_admin") === "ok") showAdmin();
  $("adminLoginBtn").addEventListener("click", () => {
    if ($("adminPass").value === ADMIN_PASSWORD) {
      sessionStorage.setItem("anthony_admin", "ok");
      showAdmin();
    } else {
      $("adminLoginError").textContent = "Senha incorreta.";
    }
  });
  $("adminPass").addEventListener("keydown", e => {
    if (e.key === "Enter") $("adminLoginBtn").click();
  });
}

async function showAdmin() {
  $("loginAdmin").classList.add("hidden");
  $("adminPanel").classList.remove("hidden");
  await renderTable();
}

$("tabAll").addEventListener("click", () => setTab("all"));
$("tabGoing").addEventListener("click", () => setTab("going"));
$("tabNotGoing").addEventListener("click", () => setTab("notgoing"));
$("tabPending").addEventListener("click", () => setTab("pending"));
$("exportCsv").addEventListener("click", exportCsv);
$("exportDoc").addEventListener("click", exportDoc);
setupLogin();

const resetBtn = document.getElementById("reset-btn");

if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    const confirmar = confirm("Tem certeza que deseja apagar TODAS as confirmações?");
    if (!confirmar) return;

    const senha = prompt("Digite a senha de administrador:");
    if (senha !== ADMIN_PASSWORD) {
      alert("Senha incorreta!");
      return;
    }

    const { error } = await window.sb
      .from("rsvps")
      .delete()
      .neq("family_key", "__nao_existe__");

    if (error) {
      console.error("Erro ao apagar confirmações:", error);
      alert("Erro ao apagar confirmações. Veja o Console/F12.");
      return;
    }

    alert("Todas as confirmações foram apagadas!");
    await renderTable();
  });
}
