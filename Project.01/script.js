let familiaAtual = null;

const $ = (id) => document.getElementById(id);

function normalize(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function checkSupabase() {
  if (!window.sb) {
    console.warn("Supabase ainda não carregou. A lista de nomes vai aparecer mesmo assim.");
    return false;
  }
  return true;
}

async function getRsvpByFamily(familyKey) {
  if (!checkSupabase()) return null;

  const { data, error } = await window.sb
    .from("rsvps")
    .select("*")
    .eq("family_key", familyKey)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar confirmação:", error);
    alert("Erro ao carregar confirmação. Veja o Console/F12.");
    return null;
  }

  return data;
}

function convertRsvpFromSupabase(r) {
  if (!r) return null;

  return {
    familyKey: r.family_key,
    attending: r.attending || [],
    notAttending: r.not_attending || [],
    message: r.message || "",
    createdAt: r.created_at || "",
  };
}

async function saveRsvpOnline(payload) {
  if (!checkSupabase()) return false;

  const { error } = await window.sb
    .from("rsvps")
    .upsert(
      {
        family_key: payload.familyKey,
        attending: payload.attending,
        not_attending: payload.notAttending,
        message: payload.message,
        created_at: payload.createdAt,
      },
      { onConflict: "family_key" }
    );

  if (error) {
    console.error("Erro ao salvar confirmação:", error);
    alert("Não consegui salvar a confirmação online. Veja o Console/F12.");
    return false;
  }

  return true;
}

function findFamilyByPrivateAccess(value) {
  const v = normalize(value).replace(/[^a-z0-9-]/g, "");
  return FAMILIAS.find(f => normalize(f.key) === v || normalize(f.codigo) === v);
}

function startSite() {
  const video = $("introVideo");

  if (video) {
    video.pause();
    video.currentTime = 0;
    video.muted = true;
  }

  $("intro").classList.add("hidden");
  $("site").classList.remove("hidden");
}

function setupIntro() {
  const video = $("introVideo");
  $("playIntro").addEventListener("click", async () => {
    try {
      video.muted = false;
      await video.play();
      $("playIntro").classList.add("hidden");
    } catch (e) {
      startSite();
    }
  });
  $("skipIntro").addEventListener("click", startSite);
  video.addEventListener("ended", startSite);
}

async function setupPrivateAccess() {
  const params = new URLSearchParams(window.location.search);
  const convite = params.get("convite") || params.get("codigo");

  if (convite) {
    const family = findFamilyByPrivateAccess(convite);
    if (family) {
      await showFamily(family);
      setTimeout(() => document.querySelector("#rsvp").scrollIntoView({ behavior: "smooth" }), 400);
      return;
    }
  }

  $("codeBox").classList.remove("hidden");
}

async function showFamily(family) {
  familiaAtual = family;
  $("codeBox").classList.add("hidden");
  $("familyPanel").classList.remove("hidden");
  $("thanksPanel").classList.add("hidden");
  $("familyTitle").textContent = family.title;
  $("familyCount").textContent = `${family.members.length} convidado(s) nesta família`;
  $("message").value = "";

  // Mostra os nomes imediatamente. A internet/Supabase não pode travar a lista.
  renderMembers(null);

  const saved = convertRsvpFromSupabase(await getRsvpByFamily(family.key));

  if (saved) {
    $("alreadyAnswered").classList.remove("hidden");
    $("alreadyAnswered").innerHTML = `
      <strong>Esta família já respondeu.</strong><br>
      Confirmados: ${saved.attending.length ? saved.attending.join(", ") : "ninguém"}<br>
      Não vão: ${saved.notAttending.length ? saved.notAttending.join(", ") : "—"}
    `;
  } else {
    $("alreadyAnswered").classList.add("hidden");
    $("alreadyAnswered").innerHTML = "";
  }

  if (saved) renderMembers(saved);
}

function renderMembers(saved = null) {
  const box = $("membersList");

  if (!box) {
    alert("Erro: não achei o espaço dos convidados no index.html (membersList).");
    return;
  }

  box.innerHTML = "";

  if (!familiaAtual || !Array.isArray(familiaAtual.members) || familiaAtual.members.length === 0) {
    box.innerHTML = `<p class="muted">Nenhum convidado cadastrado nesta família.</p>`;
    return;
  }

  familiaAtual.members.forEach((name) => {
    const checked = saved && Array.isArray(saved.attending) && saved.attending.includes(name);
    const item = document.createElement("label");
    item.className = "member-check";
    item.innerHTML = `
      <input type="checkbox" value="${String(name).replace(/"/g, '&quot;')}" ${checked ? "checked" : ""}>
      <span class="fake-box"></span>
      <span>${name}</span>
    `;
    box.appendChild(item);
  });

  updateSelectedCount();
  box.querySelectorAll("input").forEach(input => input.addEventListener("change", updateSelectedCount));
}

function updateSelectedCount() {
  const total = familiaAtual ? familiaAtual.members.length : 0;
  const selected = [...document.querySelectorAll("#membersList input:checked")].length;
  $("selectedCount").textContent = `${selected} de ${total} convidado(s) marcados para comparecer`;
}

async function submitRsvp() {
  if (!familiaAtual) return;

  $("confirmRsvp").disabled = true;
  $("confirmRsvp").textContent = "Salvando...";

  const selected = [...document.querySelectorAll("#membersList input:checked")].map(i => i.value);
  const notAttending = familiaAtual.members.filter(name => !selected.includes(name));

  const payload = {
    familyKey: familiaAtual.key,
    familyTitle: familiaAtual.title,
    attending: selected,
    notAttending,
    total: familiaAtual.members.length,
    message: $("message").value.trim(),
    createdAt: new Date().toISOString(),
  };

  const ok = await saveRsvpOnline(payload);

  $("confirmRsvp").disabled = false;
  $("confirmRsvp").textContent = "Confirmar Presença";

  if (!ok) return;

  $("familyPanel").classList.add("hidden");
  $("thanksPanel").classList.remove("hidden");
  $("thanksText").innerHTML = selected.length
    ? `Presença confirmada para: <strong>${selected.join(", ")}</strong>. Nos vemos na comemoração do Anthony!`
    : `Resposta registrada. Sentiremos a falta de vocês.`;
}

function setupActions() {
  $("accessByCode").addEventListener("click", async () => {
    const family = findFamilyByPrivateAccess($("codeInput").value);
    if (!family) {
      $("codeError").textContent = "Código inválido. Confira e tente novamente.";
      return;
    }
    $("codeError").textContent = "";
    await showFamily(family);
  });

  $("codeInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("accessByCode").click();
  });

  $("changeFamily").addEventListener("click", () => {
    familiaAtual = null;
    $("familyPanel").classList.add("hidden");
    $("codeBox").classList.remove("hidden");
    $("codeInput").value = "";
  });

  $("confirmRsvp").addEventListener("click", submitRsvp);
}

setupIntro();
setupPrivateAccess();
setupActions();
