const root = document.querySelector('#app');
let state = { tasks: [], skills: [], runtime: {} }, selected = null, view = 'new', tab = 'report';
let draft = { title: '', prompt: '', sources: [{ title: '', content: '' }], skillIds: [] };
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = { queued: 'Queued', running: 'Working', completed: 'Ready to review', failed: 'Needs attention', cancelled: 'Cancelled', interrupted: 'Interrupted' };
const date = (value) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const skillList = () => state.skills.map((skill) => `<label class="skill-check"><input type="checkbox" name="skill" value="${esc(skill.id)}" ${draft.skillIds.includes(skill.id) ? 'checked' : ''}>${esc(skill.title)} <small>v${skill.version}</small></label>`).join('');
function notice(message, error = false) { const node = document.querySelector('#toast'); node.textContent = message; node.style.display = 'block'; clearTimeout(notice.timer); notice.timer = setTimeout(() => node.style.display = 'none', error ? 7000 : 3500); }
async function api(route, data) { const response = await fetch(route, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'The request could not finish.'); return result; }
function markdown(content) {
  const inline = (value) => esc(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\[(S[1-6])\]/g, '<button class="citation" data-source-cite="$1">[$1]</button>');
  const lines = content.split('\n'), html = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => inline(cell.trim()));
      const headers = cells(line); i += 2; const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(cells(lines[i])); i++; }
      i--; html.push(`<div class="table-scroll"><table><thead><tr>${headers.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (/^### /.test(line)) html.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (/^##? /.test(line)) html.push(`<h2>${inline(line.replace(/^##? /, ''))}</h2>`);
    else if (line.trim()) html.push(`<div class="md-line ${/^[-*] /.test(line) ? 'bullet' : ''}">${inline(line)}</div>`);
    else if (lines[i - 1]?.trim()) html.push('<div class="paragraph-break"></div>');
  }
  return html.join('');
}
function shell() {
  root.innerHTML = `<header><div class="brand"><img src="/lds-logo.svg" alt="LDS"><div><strong>AI Coworker</strong><small>by Let's Data Science</small></div></div><div class="header-right"><span class="runtime"><span class="dot ${state.runtime.ready ? 'on' : ''}"></span>${state.runtime.ready ? 'Hermes configured' : 'Connect Hermes'}</span><button class="button quiet" data-action="setup">Setup</button><button class="button" data-action="new">＋ New task</button></div></header><main><div class="workspace-heading"><div><h1>Your work, with a head start.</h1><p>Give Hermes a brief. Review the work. Keep what it learns.</p></div><p>Saved on this computer</p></div><div class="workspace"><aside class="sidebar"><div class="sidebar-label">Your tasks <span class="count">${state.tasks.length}</span></div><div class="task-list">${[...state.tasks].reverse().map((task) => `<button class="task-link ${selected === task.id && view === 'task' ? 'selected' : ''}" data-task="${task.id}"><strong>${esc(task.title)}</strong><small><span class="status-dot ${task.status}"></span>${labels[task.status]}<span>· ${date(task.createdAt)}</span></small></button>`).join('') || '<p>No tasks yet.<br>Your first brief starts here.</p>'}</div><div class="sidebar-bottom"><button class="button" data-action="skills">◇ Your skills <span class="count">${state.skills.length}</span></button><p>Useful procedures you approve and choose for the next task.</p></div></aside><section id="work-panel"></section></div><div class="footer"><span>AI Coworker · An LDS build-along project</span><span>Notes go to your model only when you start a task.</span></div></main><dialog class="dialog" id="dialog"></dialog>`;
  renderPanel();
}
function sourceFields() { return draft.sources.map((source, i) => `<div class="source-box"><div class="source-head"><span>Source ${i + 1}</span>${i ? `<button type="button" class="button quiet" data-remove-source="${i}" aria-label="Remove source ${i + 1}">Remove</button>` : '<span>Only the notes you provide</span>'}</div><label class="field"><span>Source title</span><input name="source-title-${i}" data-source="${i}" data-field="title" value="${esc(source.title)}" maxlength="100" placeholder="For example, product A documentation" required></label><label class="field"><span>Notes or excerpt <small>Up to 12,000 characters</small></span><textarea name="source-content-${i}" data-source="${i}" data-field="content" maxlength="12000" minlength="10" placeholder="Paste the evidence Hermes should work from. Include a source URL in the note if you have one." required>${esc(source.content)}</textarea></label></div>`).join(''); }
function renderPanel() {
  const panel = document.querySelector('#work-panel');
  if (view === 'new') {
    panel.innerHTML = `<div class="panel"><div class="panel-heading"><div><h2>What should we work on?</h2><p>A clear brief and a few useful notes are all you need to start.</p></div><span class="pill">One task at a time</span></div><div class="panel-content">${!state.runtime.ready ? `<div class="notice">${!state.runtime.installed ? 'Install the Hermes runtime' : 'Add your Gemini API key'} to run your first task. You can write the brief now. <button class="button quiet" data-action="setup">Open setup</button></div>` : ''}<div class="new-task-grid"><form id="task-form"><label class="field"><span>Task title</span><input name="title" value="${esc(draft.title)}" maxlength="100" minlength="3" placeholder="Compare our next project options" required></label><label class="field"><span>The brief</span><textarea name="prompt" maxlength="3000" minlength="12" placeholder="What should Hermes produce? Define the audience, the output, and what matters most." required>${esc(draft.prompt)}</textarea></label><div class="section-label"><span>Give it the evidence</span><button type="button" class="button quiet" data-action="add-source" ${draft.sources.length >= 6 ? 'disabled' : ''}>＋ Add source</button></div><div id="source-fields">${sourceFields()}</div><div class="section-label"><span>Apply what you learned</span><button type="button" class="button quiet" data-action="skills">Manage skills</button></div><div class="skill-selector">${skillList() || '<p>No saved skills yet. Turn a useful correction into one after your first task.</p>'}</div><div class="form-footer"><small>Starts a model run. Up to 8 agent turns and 2 minutes. Your provider may charge for usage.</small><button class="button primary" type="submit">Start task ↗</button></div></form><aside class="flow-note"><div class="flow-item"><span class="flow-num">1</span><strong>Give it a clear brief</strong><p>Tell Hermes what a useful result looks like. Supply the evidence it needs.</p></div><div class="flow-item"><span class="flow-num">2</span><strong>Watch the work happen</strong><p>Follow source reads and report creation in the activity trail.</p></div><div class="flow-item"><span class="flow-num">3</span><strong>Make the next task better</strong><p>Save your feedback as an approved skill. Choose it when it is relevant.</p></div></aside></div></div></div>`;
    return;
  }
  if (view === 'skills') {
    panel.innerHTML = `<div class="panel"><div class="panel-heading"><div><h2>Your skills</h2><p>Procedures you approve. Select up to three when you start a task.</p></div><button class="button primary" data-action="add-skill">＋ Add skill</button></div><div class="panel-content">${state.skills.map((skill) => `<article class="skill"><h3>${esc(skill.title)}</h3><p>${esc(skill.instructions)}</p><div class="skill-actions"><span class="pill">Approved · Version ${skill.version}</span><button class="button quiet" data-edit-skill="${skill.id}">Edit skill</button></div></article>`).join('') || '<div class="empty-report"><h3>A good correction is worth keeping.</h3><p>For example, ask for a comparison table before the recommendation. Save that procedure here and apply it to your next task.</p><button class="button" data-action="add-skill">Create your first skill</button></div>'}</div></div>`;
    return;
  }
  const task = state.tasks.find((item) => item.id === selected);
  if (!task) { view = 'new'; renderPanel(); return; }
  const running = ['running', 'queued'].includes(task.status);
  let content;
  if (tab === 'activity') content = `<ol class="timeline">${task.events.map((item) => `<li><small>${date(item.at)}</small><strong>${esc(item.title.replaceAll('_', ' '))}</strong><p>${esc(item.detail)}</p></li>`).join('')}</ol>`;
  else if (tab === 'sources') content = `<h3>The brief</h3><p class="source-content">${esc(task.prompt)}</p>${task.sources.map((source, i) => `<article class="skill" id="source-S${i + 1}"><h3>[S${i + 1}] ${esc(source.title)}</h3><p class="source-content">${esc(source.content)}</p></article>`).join('')}${task.skills.length ? '<h3>Skills applied to this task</h3>' + task.skills.map((skill) => `<article class="skill"><h3>${esc(skill.title)} · v${skill.version}</h3><p>${esc(skill.instructions)}</p></article>`).join('') : ''}`;
  else content = `${task.error ? `<div class="notice error">${esc(task.error)}</div>` : ''}${task.artifacts.length ? `<div class="review-banner">✓ ${task.status === 'completed' ? 'Your report is ready.' : 'Partial report saved.'} <small>Check the claims against your source notes.</small></div><article class="report">${markdown(task.artifacts[0].content)}</article><div class="form-footer"><small>Help the next task benefit from your review.</small><button class="button" data-action="feedback">Save a correction as a skill</button></div>${task.suggestion ? `<div class="skill"><h3>Hermes suggested a skill</h3><p>${esc(task.suggestion.title)}</p><p>${esc(task.suggestion.instructions)}</p><button class="button" data-action="review-suggestion">Review suggestion</button></div>` : ''}` : `<div class="empty-report"><h3>${running ? 'Your coworker is on it.' : 'No completed report yet.'}</h3><p>${running ? 'Hermes is working through the sources you supplied. Open Activity to see the actual tool calls as they happen.' : 'Review the activity and setup before starting another task. Failed runs are never shown as completed work.'}</p><button class="button" data-tab="activity">View activity</button></div>`}`;
  panel.innerHTML = `<div class="panel"><div class="panel-heading"><div><h2>${esc(task.title)}</h2><p><span class="pill ${task.status}">${labels[task.status]}</span> &nbsp; ${task.sources.length} sources · ${task.skills.length} ${task.skills.length === 1 ? 'skill' : 'skills'}</p></div><div class="task-actions">${running ? '<button class="button danger" data-action="cancel">Stop task</button>' : '<button class="button" data-action="reuse">Use this brief again</button>'}${task.artifacts.length ? `<a class="button primary" href="/api/report?task=${task.id}">Download report ↓</a>` : ''}</div></div><div class="tabs">${[['report', 'Report'], ['activity', 'Activity'], ['sources', 'Brief & sources']].map(([id, name]) => `<button class="tab ${tab === id ? 'active' : ''}" data-tab="${id}" aria-pressed="${tab === id}">${name}</button>`).join('')}</div><div class="panel-content">${content}</div></div>`;
}
function setupDialog() {
  const dialog = document.querySelector('#dialog'); dialog.innerHTML = `<div class="setup"><h2>Connect your coworker</h2><p>The interface and saved workspace run locally. Hermes sends your brief and source notes to Gemini when you start a task.</p><ol><li>Install Node.js 22.13+, Git, and uv.</li><li>In the project folder, run:<code>npm run setup:hermes</code></li><li>Open <strong>.env.local</strong> and set:<code>GEMINI_API_KEY=your_own_key\nGEMINI_MODEL=gemini-2.5-flash</code></li><li>Restart the app:<code>npm start</code></li></ol><p>Hermes runtime: <strong>${state.runtime.installed ? 'Installed' : 'Not installed'}</strong><br>API key: <strong>${state.runtime.configured ? 'Configured on the server' : 'Not configured'}</strong></p><p>See docs/BUILD.md for Windows instructions, dependency details, and troubleshooting.</p></div><div class="dialog-actions"><button class="button primary" data-action="close-dialog">Done</button></div>`; dialog.showModal();
}
function editSkill(skill = {}) {
  const dialog = document.querySelector('#dialog'); dialog.innerHTML = `<h2>${skill.id ? 'Edit your skill' : 'Keep what you learned'}</h2><form id="skill-form" data-id="${esc(skill.id || '')}"><label class="field"><span>Skill name</span><input name="title" value="${esc(skill.title || '')}" placeholder="Evidence-first comparisons" minlength="3" maxlength="80" required></label><label class="field"><span>The reusable procedure</span><textarea name="instructions" minlength="12" maxlength="2000" rows="7" placeholder="Describe what the next task should do differently. Keep this general enough to reuse." required>${esc(skill.instructions || '')}</textarea></label><p>You approve this text when you save it. Changes affect future tasks only.</p><div class="dialog-actions">${skill.id ? `<button class="button quiet danger" type="button" data-delete-skill="${esc(skill.id)}">Remove</button>` : ''}<button class="button" type="button" data-action="close-dialog">Cancel</button><button class="button primary" type="submit">Approve and save</button></div></form>`; dialog.showModal();
}
root.addEventListener('input', (event) => {
  if (!event.target.closest('#task-form')) return;
  const element = event.target;
  if (element.dataset.source !== undefined) draft.sources[Number(element.dataset.source)][element.dataset.field] = element.value;
  else if (element.name === 'title' || element.name === 'prompt') draft[element.name] = element.value;
  else if (element.name === 'skill') draft.skillIds = [...document.querySelectorAll('[name="skill"]:checked')].map((node) => node.value);
});
root.addEventListener('click', async (event) => {
  const element = event.target.closest('button'); if (!element) return;
  try {
    if (element.dataset.task) { selected = element.dataset.task; view = 'task'; tab = 'report'; shell(); }
    if (element.dataset.tab) { tab = element.dataset.tab; renderPanel(); }
    if (element.dataset.sourceCite) { tab = 'sources'; renderPanel(); document.querySelector('#source-' + element.dataset.sourceCite)?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }
    if (element.dataset.removeSource) { draft.sources.splice(Number(element.dataset.removeSource), 1); renderPanel(); }
    if (element.dataset.editSkill) editSkill(state.skills.find((skill) => skill.id === element.dataset.editSkill));
    if (element.dataset.deleteSkill) { await api('/api/skills/remove', { id: element.dataset.deleteSkill }); document.querySelector('#dialog').close(); await refresh(); renderPanel(); notice('Skill removed from future tasks.'); }
    const task = state.tasks.find((item) => item.id === selected);
    switch (element.dataset.action) {
      case 'new': selected = null; view = 'new'; shell(); break;
      case 'setup': setupDialog(); break;
      case 'close-dialog': document.querySelector('#dialog').close(); break;
      case 'skills': view = 'skills'; shell(); break;
      case 'add-skill': editSkill(); break;
      case 'feedback': editSkill(); break;
      case 'review-suggestion': editSkill(task.suggestion); break;
      case 'add-source': if (draft.sources.length < 6) draft.sources.push({ title: '', content: '' }); renderPanel(); break;
      case 'reuse': draft = { title: task.title, prompt: task.prompt, sources: task.sources.map((source) => ({ ...source })), skillIds: task.skills.map((skill) => skill.id).filter((id) => state.skills.some((skill) => skill.id === id)) }; view = 'new'; selected = null; shell(); break;
      case 'cancel': await api('/api/cancel', { id: selected }); await refresh(); renderPanel(); notice('Task stopped.'); break;
    }
  } catch (error) { notice(error.message, true); }
});
root.addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.target, button = form.querySelector('[type="submit"]'); button.disabled = true;
  try {
    if (form.id === 'task-form') { const result = await api('/api/tasks', draft); selected = result.id; view = 'task'; tab = 'activity'; draft = { title: '', prompt: '', sources: [{ title: '', content: '' }], skillIds: [] }; await refresh(); shell(); }
    if (form.id === 'skill-form') { const values = Object.fromEntries(new FormData(form)); await api('/api/skills', { ...values, ...(form.dataset.id ? { id: form.dataset.id } : {}) }); document.querySelector('#dialog').close(); await refresh(); renderPanel(); notice('Skill approved. Choose it for your next task.'); }
  } catch (error) { notice(error.message, true); button.disabled = false; }
});
async function refresh() { state = await api('/api/state'); }
try { await refresh(); shell(); } catch { root.innerHTML = '<main><h1>The workspace could not load.</h1><p>Start the local server with npm start, then reload this page.</p></main>'; }
setInterval(async () => { if (document.hidden || !state.tasks.some((task) => ['queued', 'running'].includes(task.status))) return; try { const previous = JSON.stringify(state.tasks); await refresh(); if (previous !== JSON.stringify(state.tasks) && view === 'task' && !document.querySelector('#dialog')?.open) shell(); } catch { notice('Connection interrupted. Your saved work remains on this computer.', true); } }, 1800);
