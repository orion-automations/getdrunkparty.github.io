import { CATEGORIES, TARGETS, VERSION } from "./config.js";
import { loadState, saveState, validateCards, seedState, parseCardImport, exportCardCatalog } from "./storage.js";
import { gameEngine } from "./game.js";
import { makeId, downloadJSON, escapeText } from "./utils.js";
import { addDrink } from "./drinks.js";
import { findManual } from "./manuals.js";
import { DICE_FACES, diceRotationTarget } from "./dice.js";
import { validateMinigameRules } from "./minigame-results.js";

let state = loadState(),
  engine = gameEngine(state),
  toastTimer;
let animateCardNext = false;
let animateCardId = null;
let rolling = false;
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
for (const face of DICE_FACES) {
  const side = document.createElement("div");
  side.className = `dice-face face-${face.surface}`;
  side.style.setProperty("--face-color", CATEGORIES[face.category]?.color ?? "#fff");
  side.textContent = face.label;
  $("#dice-cube").append(side);
}
const persist = () => {
  if (!saveState(state))
    notify(
      "No se pudo guardar. Libera espacio en el navegador o exporta un respaldo.",
    );
};
function notify(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
function setView(view) {
  $$(".view").forEach((el) =>
    el.classList.toggle("active", el.id === `view-${view}`),
  );
  $$(".nav-link").forEach((el) =>
    el.classList.toggle("active", el.dataset.view === view),
  );
  $("#nav").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}
function esc(text) {
  return escapeText(text);
}
function shotLabel(count) {
  const shots = Number(count);
  return `${shots} ${shots === 1 ? "Shot" : "Shots"}`;
}
function render() {
  renderGame();
  renderRewards();
  renderPlayers();
  renderCards();
  renderManuals();
  renderDrinks();
  $("#position-reversed").checked = state.settings.positionReversed;
}
function renderGame() {
  const active = state.participants.filter((p) => p.active);
  const cur = state.game.current;
  const current = cur ? state.participants.find((p) => p.id === cur.playerId) : state.participants[state.game.currentIndex];
  $("#current-player").textContent = current?.active ? current.name : "Agrega participantes";
  const ready = state.game.state === "READY" && active.length > 0 && !rolling;
  const digital = (state.settings.gameMode ?? "digital") === "digital";
  $("#game-mode").value = digital ? "digital" : "physical";
  $("#dice-stage").classList.toggle("hidden", !digital || !ready);
  $("#roll-button").disabled = !ready;
  const choosingPhysical = !digital && ready;
  const choosingRolledCategory = digital && cur?.phase === "AWAITING_CATEGORY";
  const mainDecksVisible = digital ? active.length > 0 : choosingPhysical || Boolean(cur);
  $("#category-choices").classList.toggle("hidden", !mainDecksVisible);
  $("#blocked-choice").classList.toggle("hidden", !choosingPhysical);
  $("#aux-decks").classList.toggle("disabled-decks", !cur || cur.type === "BLOCKED" || state.game.state !== "RESOLVING" || Boolean(cur.outcome));
  $$("#category-choices [data-category]").forEach((b) => {
    const enabled = choosingPhysical || (choosingRolledCategory && b.dataset.category === cur.category);
    b.disabled = !enabled;
    b.classList.toggle("selected-deck", choosingRolledCategory && b.dataset.category === cur.category);
  });
  $("#blocked-choice").disabled = !choosingPhysical;
  const armedMiniSelection = cur?.category === "MINIJUEGO" ? cur.armedSelection : null;
  const effectCategories = (cur?.pendingEffects ?? []).filter((effect) => effect.type === "DRAW_AUXILIARY").map((effect) => effect.category);
  const canDrawAuxiliary = Boolean(cur?.primaryCard && cur.category !== "MINIJUEGO" && cur.auxiliaryCards?.length === 0 && (!cur.outcome || effectCategories.length) && cur.type !== "BLOCKED" && state.game.state === "RESOLVING");
  $$("#aux-category-choices [data-category]").forEach((b) => {
    b.disabled = armedMiniSelection ? b.dataset.category !== armedMiniSelection.category : !(canDrawAuxiliary && (!cur?.outcome || effectCategories.includes(b.dataset.category)));
  });
  $("#game-message").textContent = cur
    ? cur.category === "BLOQUEADA" ? "Cara bloqueada · no hay acción."
      : cur.phase === "AWAITING_CATEGORY" ? `Resultado: ${CATEGORIES[cur.category]?.label ?? cur.category} · pulsa el mazo iluminado.`
      : cur.phase === "EMPTY" ? `Resultado: ${CATEGORIES[cur.category]?.label ?? cur.category} · mazo agotado.`
        : `${CATEGORIES[cur.category]?.label ?? cur.category} · turno en curso.`
    : "";
  const cardsHost = $("#turn-cards");
  const items = cur ? [cur.primaryCard, ...(cur.auxiliaryCards ?? [])].filter(Boolean) : [];
  const cardsKey = items.map((item) => `${item.cardId}:${(item.targetIds ?? []).join(",")}`).join("|");
  if (cardsHost.dataset.cardsKey !== cardsKey) {
    cardsHost.replaceChildren();
    for (const [index, item] of items.entries()) {
      const card = state.cards.find((c) => c.id === item.cardId);
      if (card) cardsHost.append(makeTurnCard(card, item, index === 0, animateCardNext && item.cardId === animateCardId));
    }
    cardsHost.dataset.cardsKey = cardsKey;
    if (animateCardNext && cardsKey.includes(animateCardId ?? "\0")) {
      animateCardNext = false;
      animateCardId = null;
    }
  }
  cardsHost.classList.toggle("hidden", !items.length);
  const miniCard = cur?.primaryCard && state.cards.find((card) => card.id === cur.primaryCard.cardId && card.categoryId === "MINIJUEGO");
  $("#minigame-flow").classList.toggle("hidden", !miniCard || state.game.state !== "RESOLVING");
  if (miniCard) renderMinigameFlow(cur, miniCard);
  $("#resolve-actions").classList.toggle("hidden", !cur || state.game.state !== "RESOLVING" || cur.phase === "AWAITING_CATEGORY");
  const isChallenge = cur?.category === "DESAFIO";
  const isMinigame = cur?.category === "MINIJUEGO";
  const hasPenalty = (cur?.auxiliaryCards ?? []).some((item) => item.category === "CASTIGO");
  $("#confirm-completed").classList.toggle("hidden", !cur || cur.category === "BLOQUEADA" || isChallenge || isMinigame || Boolean(cur.outcome));
  $("#confirm-challenge").classList.toggle("hidden", !isChallenge || isMinigame || Boolean(cur?.outcome));
  $("#confirm-penalty").classList.toggle("hidden", !isChallenge || isMinigame || !hasPenalty || Boolean(cur?.outcome));
  const hasCard = items.length > 0;
  $("#confirm-alternative").classList.toggle("hidden", !hasCard || isMinigame || Boolean(cur?.outcome));
  $("#confirm-pass").classList.toggle("hidden", !hasCard || isMinigame || Boolean(cur?.outcome));
  const canFinish = Boolean(cur && (cur.type === "BLOCKED" || cur.phase === "EMPTY" || (cur.outcome && (!isMinigame || !(cur.pendingSelections?.length)))));
  $("#finish-turn").classList.toggle("hidden", !canFinish);
  $("#finish-turn").disabled = !canFinish;
  const effectMessages = (cur?.pendingEffects ?? [])
    .filter((effect) => effect.type === "DRAW_AUXILIARY" && ["PREMIO", "CASTIGO"].includes(effect.category))
    .map((effect) => `Efecto disponible: mazo ${CATEGORIES[effect.category].label}.`);
  $("#reward-status").textContent = effectMessages.join(" ");
}

function renderMinigameFlow(turn, card) {
  const participantHost = $("#minigame-participant-picker");
  const outcomeHost = $("#minigame-outcomes");
  const selectionHost = $("#minigame-selection");
  const saveParticipants = $("#save-minigame-participants");
  const recordResult = $("#record-minigame-result");
  participantHost.replaceChildren();
  outcomeHost.replaceChildren();
  selectionHost.replaceChildren();
  saveParticipants.classList.add("hidden");
  recordResult.classList.add("hidden");

  const activePlayers = state.participants.filter((player) => player.active);
  const participants = (turn.participantIds ?? []).map((id) => state.participants.find((player) => player.id === id)).filter(Boolean);
  const needsManualParticipants = ["PLAYER_PAIR", "MANUAL_SELECTION"].includes(card.target.mode) && participants.length !== card.target.count;
  if (needsManualParticipants && !turn.minigameResult) {
    const list = document.createElement("div");
    list.className = "minigame-participant-list";
    activePlayers.forEach((player) => {
      const label = document.createElement("label");
      label.className = "minigame-participant-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "minigame-participant";
      checkbox.value = player.id;
      checkbox.checked = (turn.participantIds ?? []).includes(player.id);
      label.append(checkbox, document.createTextNode(player.name));
      list.append(label);
    });
    participantHost.append(list);
    saveParticipants.classList.remove("hidden");
    saveParticipants.disabled = activePlayers.length < card.target.count;
  } else if (!turn.minigameResult) {
    const summary = document.createElement("p");
    summary.className = "fine-print";
    summary.textContent = participants.length
      ? `Participantes: ${participants.map((player) => player.name).join(", ")}`
      : "Agrega participantes activos para registrar este minijuego.";
    participantHost.append(summary);
  }

  if (!turn.minigameResult && participants.length && !needsManualParticipants) {
    const list = document.createElement("div");
    list.className = "minigame-outcome-list";
    const selectors = [];
    participants.forEach((player) => {
      const row = document.createElement("label");
      row.className = "minigame-outcome-row";
      const name = document.createElement("span");
      name.textContent = player.name;
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Resultado de ${player.name}`);
      select.innerHTML = '<option value="">Seleccionar resultado</option><option value="WIN">Ganó</option><option value="LOSS">Perdió</option><option value="NEUTRAL">Neutral / sin consecuencia</option>';
      selectors.push({ playerId: player.id, select });
      row.append(name, select);
      list.append(row);
    });
    outcomeHost.append(list);
    recordResult.classList.remove("hidden");
    recordResult.disabled = false;
    recordResult.onclick = () => {
      const outcomes = selectors.map(({ playerId, select }) => ({ playerId, result: select.value }));
      if (outcomes.some((item) => !item.result)) return notify("Registra si cada participante ganó, perdió o quedó neutral.");
      const result = engine.recordMinigameResult(outcomes);
      if (result.error) return notify(result.message ?? "No se pudo registrar el resultado.");
      persist();
      renderGame();
    };
  }

  if (!turn.minigameResult) return;
  const summary = document.createElement("p");
  summary.className = "fine-print";
  const winnerNames = turn.minigameResult.winners.map((id) => state.participants.find((player) => player.id === id)?.name).filter(Boolean);
  const loserNames = turn.minigameResult.losers.map((id) => state.participants.find((player) => player.id === id)?.name).filter(Boolean);
  summary.textContent = `Resultado acordado por el grupo · Ganaron: ${winnerNames.join(", ") || "—"} · Perdieron: ${loserNames.join(", ") || "—"}`;
  selectionHost.append(summary);
  const next = turn.pendingSelections?.[0];
  if (!next) {
    const status = document.createElement("p");
    status.className = "minigame-selection-status";
    status.textContent = "No hay selecciones pendientes para este resultado. Puedes finalizar el turno.";
    selectionHost.append(status);
    return;
  }
  const row = document.createElement("div");
  row.className = "minigame-selection-row";
  const categoryName = CATEGORIES[next.category]?.label ?? next.category;
  const eligible = next.eligiblePlayerIds.map((id) => state.participants.find((player) => player.id === id)).filter(Boolean);
  const label = document.createElement("span");
  let recipientSelect = null;
  if (next.playerId) {
    label.textContent = `Siguiente selección: ${state.participants.find((player) => player.id === next.playerId)?.name ?? "Participante"} · ${categoryName}`;
  } else {
    label.textContent = `Asigna una carta de ${categoryName} a:`;
    recipientSelect = document.createElement("select");
    recipientSelect.setAttribute("aria-label", "Participante que recibe la carta");
    recipientSelect.innerHTML = '<option value="">Seleccionar participante</option>';
    eligible.forEach((player) => {
      const option = document.createElement("option");
      option.value = player.id;
      option.textContent = player.name;
      recipientSelect.append(option);
    });
  }
  row.append(label);
  if (recipientSelect) row.append(recipientSelect);
  const armButton = document.createElement("button");
  armButton.type = "button";
  armButton.className = "button button-small button-primary";
  armButton.textContent = turn.armedSelection ? "Selección preparada" : "Preparar selección individual";
  armButton.disabled = Boolean(turn.armedSelection) || Boolean(recipientSelect && eligible.length === 0);
  armButton.onclick = () => {
    const recipientId = next.playerId ?? recipientSelect?.value;
    const result = engine.armMinigameSelection(recipientId);
    if (result.error) return notify("Selecciona un destinatario válido para esta carta.");
    persist();
    renderGame();
  };
  row.append(armButton);
  selectionHost.append(row);
  const status = document.createElement("p");
  status.className = "minigame-selection-status";
  status.textContent = turn.armedSelection
    ? `${state.participants.find((player) => player.id === turn.armedSelection.playerId)?.name ?? "Participante"}, selecciona el mazo de ${categoryName}.`
    : `${turn.pendingSelections.length} selección${turn.pendingSelections.length === 1 ? "" : "es"} pendiente${turn.pendingSelections.length === 1 ? "" : "s"}.`;
  selectionHost.append(status);
}

function makeTurnCard(card, item, primary, animate) {
  const slot = document.createElement("div");
  slot.className = `card-slot${primary ? " primary-card-slot" : " auxiliary-card-slot"}`;
  let help = null;
  if (card.manualId) {
    help = document.createElement("button");
    help.type = "button";
    help.className = "help-button";
    help.textContent = "?";
    help.setAttribute("aria-label", `Abrir manual de ${card.title}`);
    help.onclick = () => openManual(card.manualId);
  }
  const area = document.createElement("div");
  area.className = "card-area";
  const playing = document.createElement("div");
  playing.className = "playing-card";
  playing.style.setProperty("--card-color", CATEGORIES[card.categoryId]?.color ?? "#39e58c");
  const back = document.createElement("div");
  back.className = "card-back";
  back.innerHTML = '<div class="cross-ribbon"><span></span></div><b>GDP</b>';
  back.querySelector("span").textContent = CATEGORIES[card.categoryId]?.label.toUpperCase() ?? card.categoryId;
  const front = document.createElement("article");
  front.className = "card-front";
  const category = document.createElement("div");
  category.className = "card-category";
  category.textContent = CATEGORIES[card.categoryId]?.label.toUpperCase() ?? card.categoryId;
  const players = document.createElement("div");
  players.className = "card-players";
  const assigned = (item.targetIds ?? []).map((id) => state.participants.find((p) => p.id === id)?.name).filter(Boolean);
  players.textContent = assigned.length ? `Participantes asignados: ${assigned.join(" · ")}` : (TARGETS[card.target.mode] ?? "Participación voluntaria");
  const copy = document.createElement("div");
  copy.className = "card-copy";
  const title = document.createElement("h3");
  title.textContent = card.title;
  const description = document.createElement("p");
  description.textContent = card.description;
  copy.append(title, description);
  const footer = document.createElement("div");
  footer.className = "card-footer";
  const penalty = document.createElement("span");
  penalty.textContent = card.penalty.enabled && card.penalty.units > 0 ? shotLabel(card.penalty.units) : "";
  const fires = document.createElement("span");
  fires.setAttribute("aria-label", "Intensidad");
  fires.textContent = "🔥".repeat(card.spiceLevel);
  footer.append(penalty, fires);
  front.append(category, players, copy, footer);
  playing.append(back, front);
  area.append(playing);
  if (help) slot.append(help);
  slot.append(area);
  const reveal = () => playing.classList.add("revealed");
  if (animate) {
    animateCardNext = false;
    animateCardId = null;
    requestAnimationFrame(() => setTimeout(reveal, 360));
  } else reveal();
  return slot;
}
function renderRewards() {
  const host = $("#effects-list");
  if (!host) return;
  host.replaceChildren();
  const rewards = state.game.rewards ?? [];
  if (!rewards.some((r) => !r.used)) {
    const empty = document.createElement("li");
    empty.textContent = "Sin premios guardados.";
    host.append(empty);
  }
  rewards
    .filter((r) => !r.used)
    .forEach((reward) => {
      const li = document.createElement("li");
      const owner =
        state.participants.find((p) => p.id === reward.playerId)?.name ??
        "Participante";
      li.textContent = `${owner}: ${reward.title} · pendiente de uso manual `;
      const btn = document.createElement("button");
      btn.className = "button button-small";
      btn.textContent = "Marcar usado";
      btn.onclick = () => {
        reward.used = true;
        reward.usedAt = new Date().toISOString();
        persist();
        renderRewards();
        notify("Premio marcado como usado.");
      };
      li.append(btn);
      host.append(li);
    });
}
function renderPlayers() {
  const host = $("#players-list");
  host.replaceChildren();
  state.participants.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "manage-row";
    row.innerHTML = `<span class="player-number">${String(i + 1).padStart(2, "0")}</span><input aria-label="Nombre" value="${esc(p.name)}" maxlength="32"><span class="fine-print">${p.id === state.participants[state.game.currentIndex]?.id ? "Turno actual" : ""}</span><button class="button button-small" data-action="save-player">Guardar</button><button class="button button-small button-danger" data-action="delete-player">Eliminar</button>`;
    row.querySelector("[data-action=save-player]").onclick = () => {
      const v = row.querySelector("input").value.trim();
      if (!v) return notify("El nombre no puede quedar vacío.");
      p.name = v;
      persist();
      render();
      notify("Participante actualizado.");
    };
    row.querySelector("[data-action=delete-player]").onclick = () =>
      confirmAction("Eliminar participante", `¿Eliminar a ${p.name}?`, () => {
        const wasCurrent = i === state.game.currentIndex;
        state.participants.splice(i, 1);
        if (i < state.game.currentIndex) state.game.currentIndex--;
        else if (wasCurrent)
          state.game.currentIndex = Math.min(i, state.participants.length - 1);
        state.game.currentIndex = Math.max(0, state.game.currentIndex);
        persist();
        render();
      });
    host.append(row);
  });
}
function populateForm(card) {
  const f = $("#card-form");
  f.reset();
  $("#form-error").textContent = "";
  $("#f-category").innerHTML = Object.entries(CATEGORIES)
    .filter(([id]) => id !== "SHOT")
    .map(([id, c]) => `<option value="${id}">${c.label}</option>`)
    .join("");
  $("#f-target").innerHTML = Object.entries(TARGETS)
    .map(([id, label]) => `<option value="${id}">${label}</option>`)
    .join("");
  $("#f-manual").innerHTML =
    '<option value="">Sin manual</option>' +
    state.manuals
      .map((m) => `<option value="${m.id}">${esc(m.title)}</option>`)
      .join("");
  const c = card ?? {
    id: makeId("CARTA"),
    categoryId: "VERDAD",
    title: "",
    description: "",
    spiceLevel: 0,
    target: { mode: "CURRENT_PLAYER", count: 1 },
    manualId: null,
    icon: { type: "glyph", value: "✦" },
    penalty: { enabled: false, units: 1 },
    enabled: true,
  };
  $("#form-heading").textContent = card ? "Editar carta" : "Nueva carta";
  $("#f-id").value = c.id;
  $("#f-id").readOnly = Boolean(card);
  $("#f-category").value = c.categoryId;
  $("#f-title").value = c.title;
  $("#f-description").value = c.description;
  $("#f-effects").value = c.effects ? JSON.stringify(c.effects, null, 2) : "";
  $("#f-spice").value = c.spiceLevel;
  $("#f-target").value = c.target.mode;
  $("#f-count").value = c.target.count ?? 1;
  $("#f-manual").value = c.manualId ?? "";
  $("#f-icon").value = c.icon?.value ?? "✦";
  $("#f-penalty-enabled").checked = c.penalty.enabled;
  $("#f-units").value = c.penalty.units;
  $("#f-enabled").checked = c.enabled;
  updatePreview();
  $("#editor-dialog").showModal();
}
function updatePreview() {
  const cat = CATEGORIES[$("#f-category").value] ?? CATEGORIES.VERDAD,
    penalty =
      $("#f-penalty-enabled").checked && Number($("#f-units").value) > 0
        ? shotLabel($("#f-units").value)
        : "Sin penalización";
  $("#card-preview").style.setProperty("--card-color", cat.color);
  $("#card-preview").innerHTML =
    `<b>${esc($("#f-title").value || "Título de la carta")}</b><p>${esc($("#f-description").value || "La descripción aparecerá aquí.")}</p><small>${esc(penalty)} · ${"🔥".repeat(Number($("#f-spice").value)) || "Sin intensidad"}</small>`;
}
function saveCard(event) {
  event.preventDefault();
  const id = $("#f-id").value.trim(),
    old = state.cards.find((c) => c.id === id);
  let effects = null;
  try {
    effects = $("#f-effects").value.trim() ? JSON.parse($("#f-effects").value) : null;
    if (effects !== null && (typeof effects !== "object" || Array.isArray(effects))) throw new Error("Los efectos deben ser un objeto JSON.");
  } catch (error) {
    $("#form-error").textContent = error instanceof SyntaxError ? "El JSON de efectos no es válido." : error.message;
    return;
  }
  const card = {
    id,
    categoryId: $("#f-category").value,
    title: $("#f-title").value.trim(),
    description: $("#f-description").value.trim(),
    icon: {
      type: "glyph",
      value: $("#f-icon").value.trim().slice(0, 8) || "✦",
    },
    spiceLevel: Number($("#f-spice").value),
    target: {
      mode: $("#f-target").value,
      count: Number($("#f-count").value),
      position: null,
    },
    penalty: {
      enabled: $("#f-penalty-enabled").checked,
      units: Number($("#f-units").value),
    },
    manualId: $("#f-manual").value || null,
    ...(effects ? { effects } : {}),
    enabled: $("#f-enabled").checked,
  };
  try {
    validateCards(
      old
        ? state.cards.map((c) => (c.id === id ? card : c))
        : [...state.cards, card],
      state.manuals,
    );
    if (old) state.cards[state.cards.indexOf(old)] = card;
    else state.cards.push(card);
    persist();
    $("#editor-dialog").close();
    renderCards();
    notify("Carta guardada.");
  } catch (e) {
    $("#form-error").textContent = e.message;
  }
}
function renderCards() {
  const filter = $("#category-filter"),
    previous = filter.value;
  filter.innerHTML =
    '<option value="">Todas las categorías</option>' +
    Object.entries(CATEGORIES)
      .filter(([id]) => id !== "SHOT")
      .map(([id, c]) => `<option value="${id}">${c.label}</option>`)
      .join("");
  filter.value = previous;
  const term = $("#card-search").value.toLocaleLowerCase(),
    cat = filter.value;
  const cards = state.cards
    .filter(
      (c) =>
        (!cat || c.categoryId === cat) &&
        (!term ||
          `${c.id} ${c.title} ${c.description}`
            .toLocaleLowerCase()
            .includes(term)),
    )
    .sort(
      (a, b) =>
        a.categoryId.localeCompare(b.categoryId) ||
        a.title.localeCompare(b.title),
    );
  $("#cards-list").replaceChildren();
  $("#cards-list").dataset.count = cards.length;
  cards.forEach((card) => {
    const row = document.createElement("article");
    row.className = `editor-card ${card.enabled ? "" : "disabled"}`;
    row.style.setProperty("--card-color", CATEGORIES[card.categoryId].color);
    row.innerHTML = `<div class="editor-card-icon">${esc(card.icon?.value ?? "✦")}</div><div class="editor-card-copy"><div class="editor-card-meta"><span>${CATEGORIES[card.categoryId].label}</span><code>${esc(card.id)}</code></div><h3>${esc(card.title)} ${card.enabled ? "" : "<small>(desactivada)</small>"}</h3><p>${esc(card.description)}</p></div><div class="editor-card-actions"><button class="button button-small" data-action="edit">Editar</button><button class="button button-small" data-action="duplicate">Duplicar</button><button class="button button-small" data-action="toggle">${card.enabled ? "Desactivar" : "Activar"}</button><button class="button button-small button-danger" data-action="delete">Eliminar</button></div>`;
    row.querySelector("[data-action=edit]").onclick = () => populateForm(card);
    row.querySelector("[data-action=duplicate]").onclick = () => {
      const copy = structuredClone(card);
      copy.id = makeId(card.categoryId);
      copy.title = `${copy.title} (copia)`;
      state.cards.push(copy);
      persist();
      renderCards();
      notify("Carta duplicada.");
    };
    row.querySelector("[data-action=toggle]").onclick = () => {
      card.enabled = !card.enabled;
      persist();
      renderCards();
    };
    row.querySelector("[data-action=delete]").onclick = () =>
      confirmAction("Eliminar carta", `¿Eliminar “${card.title}”?`, () => {
        state.cards = state.cards.filter((c) => c.id !== card.id);
        Object.values(state.game.decks).forEach((d) => {
          d.order = d.order.filter((id) => id !== card.id);
        });
        persist();
        render();
      });
    $("#cards-list").append(row);
  });
}
function confirmAction(title, copy, action) {
  $("#confirm-title").textContent = title;
  $("#confirm-copy").textContent = copy;
  const dlg = $("#confirm-dialog"),
    btn = $("#confirm-action");
  btn.onclick = (e) => {
    e.preventDefault();
    action();
    dlg.close();
  };
  dlg.showModal();
}
function openManual(id) {
  const manual = findManual(state.manuals, id);
  if (!manual) {
    notify("No hay manual disponible para esta carta.");
    return;
  }
  $("#manual-title").textContent = manual.title;
  const host = $("#manual-content");
  host.replaceChildren();
  const p = document.createElement("p");
  p.textContent = manual.summary;
  host.append(p);
  const manualFields = [
    ["objective", "Objetivo"], ["participants", "Participantes"],
    ["materials", "Materiales"], ["preparation", "Preparación"],
    ["victoryCondition", "Condición de victoria"], ["tiebreaker", "Desempate"],
    ["duration", "Duración estimada"], ["resultToRecord", "Resultado a registrar"],
  ];
  const consequences = manual.details?.consequenceRules;
  if (Array.isArray(consequences) && consequences.length) {
    const details = document.createElement("p");
    details.innerHTML = "<strong>Consecuencias configuradas:</strong> ";
    const consequenceSummary = consequences.map((rule) => {
      const when = rule.when === "WIN" ? "ganadores" : rule.when === "LOSS" ? "perdedores" : "participantes";
      const howMany = rule.cardsPerRecipient ? `${rule.cardsPerRecipient} por persona` : `${rule.totalCards} en total`;
      return `${when}: ${howMany} del mazo ${CATEGORIES[rule.category]?.label ?? rule.category}`;
    }).join(" · ");
    details.append(document.createTextNode(consequenceSummary));
    host.append(details);
  }
  for (const [key, label] of manualFields) {
    const value = manual.details?.[key];
    if (value) {
      const detail = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      detail.append(strong, document.createTextNode(value));
      host.append(detail);
    }
  }
  if (manual.pending) {
    const badge = document.createElement("p");
    badge.className = "pending-badge";
    badge.textContent = "Reglas pendientes de configurar";
    host.append(badge);
  }
  manual.instructions.forEach((text) => {
    const line = document.createElement("p");
    line.textContent = text;
    host.append(line);
  });
  if (manual.notes) {
    const note = document.createElement("p");
    note.textContent = manual.notes;
    host.append(note);
  }
  $("#edit-open-manual").onclick = () => {
    dlgManual(manual);
  };
  $("#manual-dialog").showModal();
}
function dlgManual(manual, isNew = false) {
  $("#manual-dialog").close();
  const name = prompt("Título del manual:", manual.title);
  if (name === null) return;
  const summary = prompt("Resumen:", manual.summary);
  if (summary === null) return;
  const instructions = prompt(
    "Instrucciones (cada línea es un paso):",
    manual.instructions.join("\n"),
  );
  if (instructions === null) return;
  const detailsText = prompt(
    'Detalles opcionales en JSON (objective, participants, materials, preparation, victoryCondition, tiebreaker, duration, resultToRecord y consequenceRules). Ejemplo consequenceRules: [{"when":"LOSS","category":"CASTIGO","recipients":"LOSERS","cardsPerRecipient":1}]:',
    JSON.stringify(manual.details ?? {}, null, 2),
  );
  if (detailsText === null) return;
  let details;
  try {
    details = JSON.parse(detailsText || "{}");
    if (!details || typeof details !== "object" || Array.isArray(details)) throw new Error();
    if (details.consequenceRules !== undefined) validateMinigameRules(details.consequenceRules);
  } catch {
    return notify("Los detalles del manual deben ser un objeto JSON válido.");
  }
  manual.title = name.trim() || manual.title;
  manual.summary = summary.trim();
  manual.instructions = instructions
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  manual.details = details;
  manual.pending = manual.instructions.length === 0;
  manual.notes = manual.pending
    ? "Reglas pendientes de completar."
    : manual.notes;
  if (isNew) state.manuals.push(manual);
  persist();
  renderManuals();
  notify(isNew ? "Manual creado." : "Manual actualizado.");
}
function renderManuals() {
  const host = $("#manuals-list");
  host.replaceChildren();
  state.manuals.forEach((m) => {
    const el = document.createElement("article");
    el.className = "panel manual-card";
    el.innerHTML = `<div><span class="eyebrow">${esc(m.id)}</span><h2>${esc(m.title)}</h2><p>${esc(m.summary)}</p>${m.pending ? '<span class="pending-badge">Pendiente de configurar</span>' : ""}</div><button class="button" data-edit>Editar manual</button>`;
    el.querySelector("[data-edit]").onclick = () => dlgManual(m);
    host.append(el);
  });
}
function renderDrinks() {
  const host = $("#drinks-list");
  host.replaceChildren();
  state.drinks.forEach((d) => {
    const line = document.createElement("div");
    line.className = "drink-row";
    line.innerHTML = `<span>${esc(d.name)}</span><span class="fine-print">${esc(d.unitLabel)}</span><button class="button button-small" data-edit>Editar</button><button class="button button-small" data-toggle>${d.enabled ? "Desactivar" : "Activar"}</button><button class="button button-small button-danger" data-delete>Eliminar</button>`;
    line.querySelector("[data-edit]").onclick = () => {
      const name = prompt("Nombre de la bebida o alternativa:", d.name);
      if (name === null) return;
      if (!name.trim()) return notify("El nombre no puede quedar vacío.");
      d.name = name.trim();
      const unit = prompt("Etiqueta de unidad:", d.unitLabel);
      if (unit !== null && unit.trim()) d.unitLabel = unit.trim();
      persist();
      renderDrinks();
    };
    line.querySelector("[data-toggle]").onclick = () => {
      d.enabled = !d.enabled;
      persist();
      renderDrinks();
    };
    line.querySelector("[data-delete]").onclick = () => {
      if (state.cards.some((c) => c.penalty.drinkTypeId === d.id))
        return notify(
          "No se puede eliminar: hay cartas que usan esta unidad. Puedes desactivarla o editar esas cartas.",
        );
      confirmAction("Eliminar bebida", `¿Eliminar ${d.name}?`, () => {
        state.drinks = state.drinks.filter((item) => item.id !== d.id);
        persist();
        renderDrinks();
      });
    };
    host.append(line);
  });
}

$("#nav").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-view]");
  if (btn) setView(btn.dataset.view);
});
$("#menu-toggle").onclick = () => $("#nav").classList.toggle("open");
$$(".close-dialog").forEach(
  (b) => (b.onclick = () => b.closest("dialog").close()),
);
function makeCategoryButton(id, category) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "category-back-button";
  button.dataset.category = id;
  button.style.setProperty("--category-color", category.color);
  button.innerHTML = '<span class="category-cross"></span><span class="category-name"></span>';
  button.querySelector(".category-name").textContent = category.label;
  button.onclick = () => drawCategory(id);
  return button;
}
function drawCategory(id) {
  const result = engine.draw(id);
  if (result.error) return notify(result.error === "NO_PLAYERS" ? "Agrega participantes primero." : result.error === "AUXILIARY_ALREADY_DRAWN" ? "Ya elegiste un mazo auxiliar en este turno." : "Espera a que termine la acción actual.");
  if (result.empty) {
    persist();
    renderGame();
    notify(`El mazo ${CATEGORIES[id]?.label ?? id} no tiene cartas habilitadas.`);
    return;
  }
  if (result.card) {
    animateCardNext = true;
    animateCardId = result.card.id;
  }
  persist();
  renderGame();
}
$("#save-minigame-participants").onclick = () => {
  const playerIds = $$("#minigame-participant-picker input[name='minigame-participant']:checked").map((input) => input.value);
  const result = engine.setMinigameParticipants(playerIds);
  if (result.error) return notify(result.error === "INVALID_PARTICIPANT_COUNT" ? "Selecciona la cantidad de participantes indicada en la carta." : "Selecciona participantes activos y sin repetir.");
  persist();
  renderGame();
};
for (const [id, category] of Object.entries(CATEGORIES)) {
  if (["VERDAD", "DESAFIO", "MINIJUEGO"].includes(id)) $("#category-choices").append(makeCategoryButton(id, category));
  if (["PREMIO", "CASTIGO"].includes(id)) $("#aux-category-choices").append(makeCategoryButton(id, category));
}
$("#blocked-choice").innerHTML = '<span class="category-cross"></span><span class="category-name">BLOQUEADA</span>';
$("#blocked-choice").style.setProperty("--category-color", "#a5a5b4");
$("#blocked-choice").onclick = () => drawCategory("BLOQUEADA");
$("#game-mode").onchange = (event) => {
  if (state.game.current || rolling) {
    event.target.value = state.settings.gameMode ?? "digital";
    return notify("Termina el turno actual antes de cambiar el modo.");
  }
  state.settings.gameMode = event.target.value;
  persist();
  renderGame();
};
$("#roll-button").onclick = () => {
  if (rolling) return;
  const result = engine.rollDigital();
  if (result.error) return notify(result.error === "NO_PLAYERS" ? "Agrega participantes primero." : "Espera a que termine la acción actual.");
  rolling = true;
  renderGame();
  $("#dice-stage").classList.remove("hidden");
  $("#game-message").textContent = "";
  const { face } = result;
  const cube = $("#dice-cube");
  cube.dataset.face = face.category;
  cube.style.setProperty("--face-color", CATEGORIES[face.category]?.color ?? "#fff");
  const currentX = Number(cube.dataset.rotationX ?? 0);
  const currentY = Number(cube.dataset.rotationY ?? 0);
  const targetX = diceRotationTarget(currentX, face.x);
  const targetY = diceRotationTarget(currentY, face.y);
  cube.dataset.rotationX = String(targetX);
  cube.dataset.rotationY = String(targetY);
  cube.style.transform = `rotateX(${targetX}deg) rotateY(${targetY}deg)`;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => {
    const resolved = engine.completeRoll();
    rolling = false;
    persist();
    renderGame();
  }, reducedMotion ? 120 : 2500);
};
function confirmResult(result, sourceCardId) {
  if (!engine.resolve(result, sourceCardId)) return notify("El resultado de este turno ya fue confirmado.");
  persist();
  renderGame();
}
$("#confirm-completed").onclick = () => confirmResult("COMPLETED", state.game.current?.primaryCard?.cardId ?? null);
$("#confirm-challenge").onclick = () => confirmResult("COMPLETED", state.game.current?.primaryCard?.cardId ?? null);
$("#confirm-alternative").onclick = () => confirmResult("ALTERNATIVE_SELECTED", state.game.current?.primaryCard?.cardId ?? null);
$("#confirm-pass").onclick = () => confirmResult("PASSED", state.game.current?.primaryCard?.cardId ?? null);
$("#confirm-penalty").onclick = () => {
  const punishment = [...(state.game.current?.auxiliaryCards ?? [])].reverse().find((item) => item.category === "CASTIGO");
  confirmResult("COMPLETED", punishment?.cardId ?? null);
};
$("#finish-turn").onclick = () => {
  if (!engine.finishTurn()) return notify("Confirma primero el resultado del turno.");
  persist();
  renderGame();
  renderRewards();
};$("#player-form").onsubmit = (e) => {
  e.preventDefault();
  const input = $("#player-name"),
    name = input.value.trim();
  if (!name) return;
  state.participants.push({
    id: makeId("player"),
    name,
    active: true,
    preferences: {},
  });
  input.value = "";
  persist();
  render();
  notify(`${name} se añadió a la partida.`);
};
$("#position-reversed").onchange = (e) => {
  state.settings.positionReversed = e.target.checked;
  persist();
};
$("#card-search").oninput = renderCards;
$("#category-filter").onchange = renderCards;
$("#new-card").onclick = () => populateForm(null);
$("#new-manual").onclick = () => {
  dlgManual({ id: makeId("MANUAL"), title: "", summary: "", instructions: [], notes: "", pending: true, details: {} }, true);
};
[
  "#f-title",
  "#f-description",
  "#f-category",
  "#f-spice",
  "#f-units",
  "#f-penalty-enabled",
].forEach((id) => $(id).addEventListener("input", updatePreview));
$("#card-form").onsubmit = saveCard;
$("#import-cards").onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    const imported = parseCardImport(data, state.cards, state.manuals);
    state.cards.push(...imported);
    persist();
    renderCards();
    notify(`${imported.length} cartas importadas.`);
  } catch (err) {
    notify(`Importación rechazada: ${err.message}`);
  } finally {
    e.target.value = "";
  }
};
$("#export-cards").onclick = () =>
  downloadJSON("get-drunk-party-cartas.json", exportCardCatalog(state.cards));
$("#backup-export").onclick = () =>
  downloadJSON("get-drunk-party-respaldo.json", state);
$("#backup-import").onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    const incoming = JSON.parse(await file.text());
    if (
      !incoming ||
      incoming.version !== 1 ||
      !Array.isArray(incoming.cards) ||
      !Array.isArray(incoming.participants) ||
      !Array.isArray(incoming.manuals)
    )
      throw new Error("Estructura de respaldo no válida.");
    validateCards(incoming.cards, incoming.manuals);
    if (!Array.isArray(incoming.drinks) || !incoming.game)
      throw new Error("Faltan datos obligatorios.");
    state = incoming;
    engine = gameEngine(state);
    persist();
    render();
    notify("Respaldo restaurado.");
  } catch (err) {
    notify(`Respaldo rechazado: ${err.message}`);
  } finally {
    e.target.value = "";
  }
};
$("#drink-form").onsubmit = (e) => {
  e.preventDefault();
  try {
    addDrink(state, $("#drink-name").value);
    $("#drink-name").value = "";
    persist();
    renderDrinks();
  } catch (err) {
    notify(err.message);
  }
};
$("#reset-data").onclick = () =>
  confirmAction(
    "Restaurar instalación",
    "Se sustituirán los datos locales por el catálogo inicial. Exporta un respaldo si lo necesitas.",
    () => {
      state = seedState();
      engine = gameEngine(state);
      persist();
      render();
      notify("Datos iniciales restaurados.");
    },
  );
$("#cancel-draw").onclick = () => {
  $("#empty-deck-dialog").close();
  engine.cancel();
  renderGame();
  persist();
};
$("#manage-deck").onclick = () => {
  $("#empty-deck-dialog").close();
  engine.cancel();
  setView("editor");
};
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  $("#install-button").classList.remove("hidden");
});
$("#install-button").onclick = async () => {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
  } else
    notify(
      "En Android: menú de Chrome → Instalar aplicación o Añadir a pantalla de inicio.",
    );
};
if ("serviceWorker" in navigator && location.protocol !== "file:")
  navigator.serviceWorker
    .register("./sw.js")
    .then(
      () =>
        ($("#storage-status").textContent =
          "Almacenamiento local activo. App lista para instalar cuando se sirva mediante HTTPS."),
    )
    .catch(
      () =>
        ($("#storage-status").textContent =
          "No se pudo registrar el modo offline en este origen. Usa HTTPS o localhost."),
    );
else
  $("#storage-status").textContent =
    "Service worker requiere HTTPS o localhost. No abras el HTML con file://.";
$("#app-version").textContent = VERSION;
render();
