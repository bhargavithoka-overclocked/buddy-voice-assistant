const desktop = window.buddyDesktop.setup;
let folder = null;
let plan = null;

function show(step) {
  document.querySelectorAll(".step").forEach((s) => (s.hidden = s.id !== step));
}

function size(bytes) {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => show(button.dataset.next));
});

function showFolder() {
  document.getElementById("folder-path").textContent = folder;
}

document.getElementById("choose-folder").addEventListener("click", async () => {
  const chosen = await desktop.chooseFolder();
  if (chosen) {
    folder = chosen;
    showFolder();
  }
});

// --- downloads list ---

function chosenItems() {
  return [...document.querySelectorAll("#items input:checked")].map((box) => box.value);
}

function updateSummary() {
  const total = plan.items
    .filter((item) => chosenItems().includes(item.id) && !item.installed)
    .reduce((sum, item) => sum + item.size, 0);
  const summary = document.getElementById("summary");
  const tooBig = total > plan.freeSpace;
  summary.textContent = tooBig
    ? `That's ${size(total)}, but there's only ${size(plan.freeSpace)} free there. Pick another folder or fewer models.`
    : `Total: ${size(total)} (you have ${size(plan.freeSpace)} free)`;
  summary.classList.toggle("bad", tooBig);
  document.getElementById("start-download").disabled = tooBig;
}

function renderItems() {
  const list = document.getElementById("items");
  list.innerHTML = "";
  for (const item of plan.items) {
    const li = document.createElement("li");
    li.className = item.installed ? "installed" : "";
    li.innerHTML = `
      <input type="checkbox" value="${item.id}">
      <div class="name">
        <div>${item.name}${item.optional ? " (optional)" : ""}</div>
        <div class="from">${item.installed ? "Already downloaded" : `from ${item.from}`}</div>
        ${item.note ? `<div class="note">${item.note}</div>` : ""}
      </div>
      <div class="size">${item.installed ? "" : size(item.size)}</div>`;
    const box = li.querySelector("input");
    box.checked = item.installed || item.recommended;
    // the required parts can't be unticked
    box.disabled = item.installed || !item.optional;
    box.addEventListener("change", updateSummary);
    list.append(li);
  }
  updateSummary();
}

document.getElementById("to-downloads").addEventListener("click", async () => {
  plan = await desktop.plan(folder);
  renderItems();
  document.getElementById("found-existing").hidden = !plan.existing;
  show("downloads");
});

// --- downloading ---

function renderProgress(ids) {
  const list = document.getElementById("progress-items");
  list.innerHTML = "";
  for (const item of plan.items.filter((i) => ids.includes(i.id) && !i.installed)) {
    const li = document.createElement("li");
    li.id = `progress-${item.id}`;
    li.innerHTML = `
      <div class="top"><span>${item.name}</span><span class="status">Waiting</span></div>
      <div class="bar"><span></span></div>`;
    list.append(li);
  }
}

desktop.onProgress(({ id, done, total, status, finished }) => {
  const li = document.getElementById(`progress-${id}`);
  if (!li) return;
  if (total) {
    li.querySelector(".bar span").style.width = `${Math.min((done / total) * 100, 100)}%`;
    li.querySelector(".status").textContent = status || `${size(done)} of ${size(total)}`;
  } else if (status) {
    li.querySelector(".status").textContent = status;
  }
  if (finished) {
    li.classList.add("finished");
    li.querySelector(".bar span").style.width = "100%";
  }
});

async function runSetup() {
  const ids = chosenItems();
  renderProgress(ids);
  show("progress");
  document.getElementById("setup-error").hidden = true;
  document.getElementById("retry").hidden = true;

  const result = await desktop.run(folder, ids);
  if (result.ok) {
    show("done");
  } else {
    const error = document.getElementById("setup-error");
    error.textContent = `Something went wrong: ${result.message}. Already-downloaded parts are kept, so trying again picks up where it stopped.`;
    error.hidden = false;
    document.getElementById("retry").hidden = false;
  }
}

document.getElementById("start-download").addEventListener("click", runSetup);
document.getElementById("retry").addEventListener("click", async () => {
  plan = await desktop.plan(folder); // some parts may be done now
  runSetup();
});
document.getElementById("finish").addEventListener("click", () => desktop.finish());

desktop.defaults().then((defaults) => {
  folder = defaults.folder;
  showFolder();
});
