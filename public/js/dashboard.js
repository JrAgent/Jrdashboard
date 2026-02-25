/**
 * Dashboard - Sections, Todos, Notes, AI Insights, Calendar
 */
(function () {
  const sectionsGrid = document.getElementById('sectionsGrid');
  const addSectionCard = document.getElementById('addSectionCard');
  const sectionModal = document.getElementById('sectionModal');
  const sectionForm = document.getElementById('sectionForm');
  const modalTitle = document.getElementById('modalTitle');
  const sectionIdInput = document.getElementById('sectionId');
  const modalCancel = document.getElementById('modalCancel');

  const todoList = document.getElementById('todoList');
  const todoInput = document.getElementById('todoInput');
  const todoAddBtn = document.getElementById('todoAddBtn');

  const jrTodoList = document.getElementById('jrTodoList');
  const jrTodoInput = document.getElementById('jrTodoInput');
  const jrTodoAddBtn = document.getElementById('jrTodoAddBtn');

  const notesList = document.getElementById('notesList');
  const notesAddBtn = document.getElementById('notesAddBtn');
  const noteModal = document.getElementById('noteModal');
  const noteForm = document.getElementById('noteForm');
  const noteIdInput = document.getElementById('noteId');
  const noteModalCancel = document.getElementById('noteModalCancel');

  const aiInsightsList = document.getElementById('aiInsightsList');
  const aiAddBtn = document.getElementById('aiAddBtn');
  const aiModal = document.getElementById('aiModal');
  const aiForm = document.getElementById('aiForm');
  const aiModalCancel = document.getElementById('aiModalCancel');

  const calGrid = document.getElementById('calGrid');
  const calMonth = document.getElementById('calMonth');

  const cryptoPrices = document.getElementById('cryptoPrices');
  const cryptoRefresh = document.getElementById('cryptoRefresh');

  const morningBriefsList = document.getElementById('morningBriefsList');
  const addMorningBriefBtn = document.getElementById('addMorningBriefBtn');
  const morningBriefModal = document.getElementById('morningBriefModal');
  const morningBriefForm = document.getElementById('morningBriefForm');
  const morningBriefCancel = document.getElementById('morningBriefCancel');

  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');

  const COIN_NAMES = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB', cardano: 'ADA', ripple: 'XRP', dogecoin: 'DOGE', 'avalanche-2': 'AVAX', chainlink: 'LINK', polkadot: 'DOT' };

  let editingSectionId = null;
  let editingNoteId = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // --- Calendar ---
  function renderCalendar() {
    if (!calGrid || !calMonth) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    calMonth.textContent = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const weekdays = ['S','M','T','W','T','F','S'];
    let html = weekdays.map(d => `<div class="cal-day weekday">${d}</div>`).join('');

    for (let i = 0; i < startPad; i++) {
      html += '<div class="cal-day other-month"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === now.getDate();
      html += `<div class="cal-day ${isToday ? 'today' : ''}">${d}</div>`;
    }
    const total = startPad + daysInMonth;
    const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let i = 0; i < remaining; i++) {
      html += '<div class="cal-day other-month"></div>';
    }
    calGrid.innerHTML = html;
  }

  // --- Sections ---
  async function loadSections() {
    try {
      const res = await fetch('/api/sections');
      const sections = await res.json();
      renderSections(sections);
    } catch (err) {
      console.error('Failed to load sections:', err);
      renderSections([]);
    }
  }

  function renderSections(sections) {
    if (!sectionsGrid) return;
    const addCard = sectionsGrid.querySelector('.add-section-card');
    sectionsGrid.innerHTML = '';
    sections.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = `card section-card animate-in`;
      card.dataset.id = s.id;
      card.dataset.color = s.color || 'default';
      card.style.animationDelay = `${0.05 + i * 0.05}s`;
      const statusClass = `status-${s.status || 'planned'}`;
      card.innerHTML = `
        <div class="card-actions">
          <button type="button" class="btn-edit" aria-label="Edit">✎</button>
          <button type="button" class="btn-delete" aria-label="Delete">×</button>
        </div>
        <h3 class="card-title">${escapeHtml(s.title)}</h3>
        ${s.description ? `<p class="card-description">${escapeHtml(s.description)}</p>` : ''}
        ${s.notes ? `<p class="card-notes-preview">${escapeHtml((s.notes || '').substring(0, 80))}${(s.notes || '').length > 80 ? '...' : ''}</p>` : ''}
        <span class="card-badge ${statusClass}">${s.status || 'planned'}</span>
      `;
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.card-actions')) openSectionModal(s);
      });
      card.querySelector('.btn-edit').addEventListener('click', (e) => { e.stopPropagation(); openSectionModal(s); });
      card.querySelector('.btn-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteSection(s.id); });
      sectionsGrid.appendChild(card);
    });
    sectionsGrid.appendChild(addCard);
  }

  function openSectionModal(section = null) {
    editingSectionId = section ? section.id : null;
    modalTitle.textContent = section ? 'Edit Project' : 'Begin an Arc';
    sectionIdInput.value = section ? section.id : '';
    document.getElementById('sectionTitle').value = section ? section.title : '';
    document.getElementById('sectionDescription').value = section ? (section.description || '') : '';
    document.getElementById('sectionType').value = section ? section.type : 'workflow';
    document.getElementById('sectionStatus').value = section ? section.status : 'planned';
    document.getElementById('sectionColor').value = section ? section.color : 'default';
    document.getElementById('sectionNotes').value = section ? (section.notes || '') : '';
    sectionModal.classList.add('active');
  }

  function closeSectionModal() {
    sectionModal.classList.remove('active');
    editingSectionId = null;
  }

  sectionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      title: document.getElementById('sectionTitle').value.trim(),
      description: document.getElementById('sectionDescription').value.trim(),
      type: document.getElementById('sectionType').value,
      status: document.getElementById('sectionStatus').value,
      color: document.getElementById('sectionColor').value,
      notes: document.getElementById('sectionNotes').value.trim()
    };
    try {
      if (editingSectionId) {
        await fetch(`/api/sections/${editingSectionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        await fetch('/api/sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      closeSectionModal();
      loadSections();
      setTimeout(() => location.reload(), 100);
    } catch (err) {
      console.error('Failed to save section:', err);
    }
  });

  modalCancel.addEventListener('click', closeSectionModal);
  sectionModal.addEventListener('click', (e) => { if (e.target === sectionModal) closeSectionModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sectionModal.classList.contains('active')) closeSectionModal(); });

  async function deleteSection(id) {
    if (!confirm('Delete this project?')) return;
    try {
      await fetch(`/api/sections/${id}`, { method: 'DELETE' });
      loadSections();
      setTimeout(() => location.reload(), 100);
    } catch (err) {
      console.error('Failed to delete section:', err);
    }
  }

  if (addSectionCard) addSectionCard.addEventListener('click', () => openSectionModal());

  // --- Todos ---
  async function loadTodos() {
    try {
      const res = await fetch('/api/todos');
      const todos = await res.json();
      renderTodos(todos);
      const statEl = document.getElementById('statTodosDone');
      const progressBar = document.getElementById('overviewProgressBar');
      const progressLabel = document.getElementById('overviewProgressLabel');
      if (statEl) {
        const done = todos.filter(t => t.done).length;
        statEl.textContent = done + ' / ' + todos.length;
      }
      if (progressBar && progressLabel) {
        const done = todos.filter(t => t.done).length;
        const total = todos.length;
        const pct = total > 0 ? (done / total * 100) : 0;
        progressBar.style.width = pct + '%';
        progressLabel.textContent = done + ' / ' + total + ' completed';
      }
    } catch (err) {
      console.error('Failed to load todos:', err);
    }
  }

  function renderTodos(todos) {
    if (!todoList) return;
    const pVal = (t) => (typeof t.priority === 'number' ? t.priority : t.priority === 'high' ? 1 : t.priority === 'low' ? 10 : 5);
    todoList.innerHTML = todos.map(t => `
      <li data-id="${t.id}" class="todo-item">
        <input type="checkbox" ${t.done ? 'checked' : ''} data-id="${t.id}" aria-label="Mark done">
        <span class="todo-text ${t.done ? 'done' : ''}">${escapeHtml(t.text)}</span>
        <input type="number" class="todo-priority" data-id="${t.id}" title="Priority (1=most)" min="1" max="10" value="${pVal(t)}" aria-label="Priority">
        <div class="todo-order-btns">
          <button type="button" class="todo-move" data-id="${t.id}" data-dir="up" aria-label="Move up">↑</button>
          <button type="button" class="todo-move" data-id="${t.id}" data-dir="down" aria-label="Move down">↓</button>
        </div>
        <button type="button" class="todo-delete" data-id="${t.id}" aria-label="Delete">×</button>
      </li>
    `).join('');
    todoList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', async () => {
        const id = cb.dataset.id;
        const li = todoList.querySelector(`li[data-id="${id}"]`);
        const done = cb.checked;
        li.querySelector('.todo-text').classList.toggle('done', done);
        try {
          await fetch(`/api/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ done })
          });
          loadTodos();
        } catch (err) {}
      });
    });
    todoList.querySelectorAll('.todo-priority').forEach(inp => {
      inp.addEventListener('change', async () => {
        const id = inp.dataset.id;
        const v = parseInt(inp.value, 10);
        if (isNaN(v) || v < 1 || v > 10) return;
        try {
          await fetch(`/api/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority: v })
          });
          loadTodos();
        } catch (err) {}
      });
    });
    todoList.querySelectorAll('.todo-move').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const dir = btn.dataset.dir;
        const idx = todos.findIndex(t => t.id === id);
        if (idx === -1) return;
        const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= todos.length) return;
        const ids = todos.map(t => t.id);
        [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
        try {
          await fetch('/api/todos/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
          });
          loadTodos();
        } catch (err) {}
      });
    });
    todoList.querySelectorAll('.todo-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await fetch(`/api/todos/${btn.dataset.id}`, { method: 'DELETE' });
          loadTodos();
        } catch (err) {}
      });
    });
  }

  todoAddBtn.addEventListener('click', addTodo);
  todoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTodo(); } });

  async function addTodo() {
    const text = todoInput.value.trim();
    if (!text) return;
    const priorityEl = document.getElementById('todoPriority');
    const priority = priorityEl ? Math.max(1, Math.min(10, parseInt(priorityEl.value, 10) || 5)) : 5;
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, priority })
      });
      todoInput.value = '';
      loadTodos();
    } catch (err) {
      console.error('Failed to add todo:', err);
    }
  }

  // --- Jr's Todos ---
  async function loadJrTodos() {
    try {
      const res = await fetch('/api/jr-todos');
      const todos = await res.json();
      renderJrTodos(todos);
    } catch (err) {
      console.error('Failed to load Jr todos:', err);
    }
  }

  function renderJrTodos(todos) {
    if (!jrTodoList) return;
    const pVal = (t) => (typeof t.priority === 'number' ? t.priority : t.priority === 'high' ? 1 : t.priority === 'low' ? 10 : 5);
    jrTodoList.innerHTML = todos.map(t => `
      <li data-id="${t.id}" class="todo-item">
        <input type="checkbox" ${t.done ? 'checked' : ''} data-id="${t.id}" aria-label="Mark done">
        <span class="todo-text ${t.done ? 'done' : ''}">${escapeHtml(t.text)}</span>
        <input type="number" class="todo-priority jr-todo-priority" data-id="${t.id}" title="Priority (1=most)" min="1" max="10" value="${pVal(t)}" aria-label="Priority">
        <div class="todo-order-btns">
          <button type="button" class="todo-move jr-todo-move" data-id="${t.id}" data-dir="up" aria-label="Move up">↑</button>
          <button type="button" class="todo-move jr-todo-move" data-id="${t.id}" data-dir="down" aria-label="Move down">↓</button>
        </div>
        <button type="button" class="todo-delete jr-todo-delete" data-id="${t.id}" aria-label="Delete">×</button>
      </li>
    `).join('');
    jrTodoList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', async () => {
        const id = cb.dataset.id;
        const li = jrTodoList.querySelector(`li[data-id="${id}"]`);
        const done = cb.checked;
        li.querySelector('.todo-text').classList.toggle('done', done);
        try {
          await fetch(`/api/jr-todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ done })
          });
          loadJrTodos();
        } catch (err) {}
      });
    });
    jrTodoList.querySelectorAll('.jr-todo-priority').forEach(inp => {
      inp.addEventListener('change', async () => {
        const id = inp.dataset.id;
        const v = parseInt(inp.value, 10);
        if (isNaN(v) || v < 1 || v > 10) return;
        try {
          await fetch(`/api/jr-todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority: v })
          });
          loadJrTodos();
        } catch (err) {}
      });
    });
    jrTodoList.querySelectorAll('.jr-todo-move').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const dir = btn.dataset.dir;
        const idx = todos.findIndex(t => t.id === id);
        if (idx === -1) return;
        const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= todos.length) return;
        const ids = todos.map(t => t.id);
        [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
        try {
          await fetch('/api/jr-todos/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
          });
          loadJrTodos();
        } catch (err) {}
      });
    });
    jrTodoList.querySelectorAll('.jr-todo-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await fetch(`/api/jr-todos/${btn.dataset.id}`, { method: 'DELETE' });
          loadJrTodos();
        } catch (err) {}
      });
    });
  }

  if (jrTodoAddBtn) jrTodoAddBtn.addEventListener('click', addJrTodo);
  if (jrTodoInput) jrTodoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addJrTodo(); } });

  async function addJrTodo() {
    const text = jrTodoInput?.value?.trim();
    if (!text) return;
    const priorityEl = document.getElementById('jrTodoPriority');
    const priority = priorityEl ? Math.max(1, Math.min(10, parseInt(priorityEl.value, 10) || 5)) : 5;
    try {
      await fetch('/api/jr-todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, priority })
      });
      if (jrTodoInput) jrTodoInput.value = '';
      loadJrTodos();
    } catch (err) {
      console.error('Failed to add Jr todo:', err);
    }
  }

  // --- Notes ---
  async function loadNotes() {
    try {
      const res = await fetch('/api/notes');
      const notes = await res.json();
      renderNotes(notes.slice(0, 5));
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  }

  function renderNotes(notes) {
    if (!notesList) return;
    notesList.innerHTML = notes.length ? notes.map(n => `
      <div class="note-item" data-id="${n.id}">
        <div class="note-title">${escapeHtml(n.title)}</div>
        <div class="note-preview">${escapeHtml((n.content || '').substring(0, 60))}${(n.content || '').length > 60 ? '...' : ''}</div>
      </div>
    `).join('') : '<p style="color: var(--text-muted); font-size: 0.9rem;">No notes yet</p>';
    notesList.querySelectorAll('.note-item').forEach(el => {
      el.addEventListener('click', () => openNoteModal(notes.find(n => n.id === el.dataset.id)));
    });
  }

  function openNoteModal(note = null) {
    if (!noteModal) return;
    editingNoteId = note ? note.id : null;
    document.getElementById('noteModalTitle').textContent = note ? 'Edit Note' : 'Add Note';
    noteIdInput.value = note ? note.id : '';
    document.getElementById('noteTitle').value = note ? note.title : '';
    document.getElementById('noteContent').value = note ? (note.content || '') : '';
    noteModal.classList.add('active');
  }

  function closeNoteModal() {
    noteModal.classList.remove('active');
    editingNoteId = null;
  }

  noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      title: document.getElementById('noteTitle').value.trim(),
      content: document.getElementById('noteContent').value.trim()
    };
    try {
      if (editingNoteId) {
        await fetch(`/api/notes/${editingNoteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      closeNoteModal();
      loadNotes();
      location.reload();
    } catch (err) {}
  });

  notesAddBtn.addEventListener('click', () => openNoteModal());
  noteModalCancel.addEventListener('click', closeNoteModal);
  noteModal.addEventListener('click', (e) => { if (e.target === noteModal) closeNoteModal(); });

  // --- AI Insights ---
  async function loadAiInsights() {
    try {
      const res = await fetch('/api/ai-insights');
      const insights = await res.json();
      renderAiInsights(insights.slice(0, 5));
    } catch (err) {
      console.error('Failed to load AI insights:', err);
    }
  }

  function renderAiInsights(insights) {
    if (!aiInsightsList) return;
    aiInsightsList.innerHTML = insights.length ? insights.map(i => `
      <div class="ai-insight-item">
        <div class="ai-badge">AI</div>
        <div class="ai-content">${escapeHtml(i.title)}: ${escapeHtml((i.content || '').substring(0, 80))}${(i.content || '').length > 80 ? '...' : ''}</div>
      </div>
    `).join('') : '<p style="color: var(--text-muted); font-size: 0.9rem;">No AI insights yet</p>';
  }

  aiForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      title: document.getElementById('aiTitle').value.trim(),
      content: document.getElementById('aiContent').value.trim(),
      source: 'manual'
    };
    try {
      await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      document.getElementById('aiTitle').value = '';
      document.getElementById('aiContent').value = '';
      aiModal.classList.remove('active');
      loadAiInsights();
    } catch (err) {}
  });

  if (aiAddBtn) aiAddBtn.addEventListener('click', () => aiModal && aiModal.classList.add('active'));
  if (aiModalCancel) aiModalCancel.addEventListener('click', () => aiModal && aiModal.classList.remove('active'));
  if (aiModal) aiModal.addEventListener('click', (e) => { if (e.target === aiModal) aiModal.classList.remove('active'); });

  // --- Crypto Prices ---
  async function loadCryptoPrices() {
    if (!cryptoPrices) return;
    try {
      const res = await fetch('/api/crypto-prices');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      let html = '';
      for (const [id, info] of Object.entries(data)) {
        const sym = COIN_NAMES[id] || id.toUpperCase().slice(0, 4);
        const price = info.usd ? '$' + (info.usd >= 1 ? info.usd.toLocaleString(undefined, { maxFractionDigits: 2 }) : info.usd.toFixed(6)) : '—';
        const change = info.usd_24h_change != null ? (info.usd_24h_change >= 0 ? '+' : '') + info.usd_24h_change.toFixed(2) + '%' : '';
        const changeClass = info.usd_24h_change >= 0 ? 'positive' : 'negative';
        html += `<div class="crypto-row"><span class="crypto-sym">${sym}</span><span class="crypto-price">${price}</span>${change ? `<span class="crypto-change ${changeClass}">${change}</span>` : ''}</div>`;
      }
      cryptoPrices.innerHTML = html;
    } catch (err) {
      cryptoPrices.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Unable to load prices</p>';
    }
  }

  // --- Portfolio Snapshot ---
  const portfolioSnapshot = document.getElementById('portfolioSnapshot');
  async function loadPortfolioSnapshot() {
    if (!portfolioSnapshot) return;
    try {
      const [itemsRes, pricesRes] = await Promise.all([
        fetch('/api/portfolio'),
        fetch('/api/portfolio-prices')
      ]);
      const items = await itemsRes.json();
      const prices = await pricesRes.json();
      if (!Array.isArray(items) || items.length === 0) {
        portfolioSnapshot.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No coins in watchlist. <a href="/portfolio">Add some</a></p>';
        return;
      }
      portfolioSnapshot.innerHTML = items.slice(0, 6).map(i => {
        const p = prices[i.coingeckoId];
        const price = p?.usd ? '$' + (p.usd >= 1 ? p.usd.toLocaleString(undefined, { maxFractionDigits: 2 }) : p.usd.toFixed(6)) : '—';
        const change = p?.usd_24h_change != null ? (p.usd_24h_change >= 0 ? '+' : '') + p.usd_24h_change.toFixed(2) + '%' : '';
        const changeClass = p?.usd_24h_change >= 0 ? 'positive' : 'negative';
        return `<div class="crypto-row"><span class="crypto-sym">${i.symbol}</span><span class="crypto-price">${price}</span>${change ? `<span class="crypto-change ${changeClass}">${change}</span>` : ''}</div>`;
      }).join('');
    } catch (err) {
      portfolioSnapshot.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Unable to load portfolio</p>';
    }
  }

  if (cryptoRefresh) cryptoRefresh.addEventListener('click', async () => {
    if (!cryptoPrices) return;
    cryptoPrices.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Loading...</p>';
    try {
      const res = await fetch('/api/crypto-prices?refresh=1');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      let html = '';
      for (const [id, info] of Object.entries(data)) {
        const sym = COIN_NAMES[id] || id.toUpperCase().slice(0, 4);
        const price = info.usd ? '$' + (info.usd >= 1 ? info.usd.toLocaleString(undefined, { maxFractionDigits: 2 }) : info.usd.toFixed(6)) : '—';
        const change = info.usd_24h_change != null ? (info.usd_24h_change >= 0 ? '+' : '') + info.usd_24h_change.toFixed(2) + '%' : '';
        const changeClass = info.usd_24h_change >= 0 ? 'positive' : 'negative';
        html += `<div class="crypto-row"><span class="crypto-sym">${sym}</span><span class="crypto-price">${price}</span>${change ? `<span class="crypto-change ${changeClass}">${change}</span>` : ''}</div>`;
      }
      cryptoPrices.innerHTML = html;
    } catch (err) {
      cryptoPrices.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Unable to load prices</p>';
    }
  });

  // --- Morning Briefs ---
  async function loadMorningBriefs() {
    if (!morningBriefsList) return;
    try {
      const res = await fetch('/api/morning-briefs');
      const briefs = await res.json();
      morningBriefsList.innerHTML = briefs.length ? briefs.slice(0, 3).map(b => `
        <div class="ai-insight-item">
          <div class="ai-badge">Jr</div>
          <div class="ai-content"><strong>${escapeHtml(b.title || 'Brief')}</strong>: ${escapeHtml((b.content || '').substring(0, 120))}${(b.content || '').length > 120 ? '...' : ''}</div>
        </div>
      `).join('') : '<p style="color: var(--text-muted); font-size: 0.9rem;">No morning briefs yet. Add one from Jr.</p>';
    } catch (err) {
      morningBriefsList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Unable to load briefs</p>';
    }
  }

  if (addMorningBriefBtn) addMorningBriefBtn.addEventListener('click', () => morningBriefModal && morningBriefModal.classList.add('active'));
  if (morningBriefCancel) morningBriefCancel.addEventListener('click', () => morningBriefModal && morningBriefModal.classList.remove('active'));
  if (morningBriefModal) morningBriefModal.addEventListener('click', (e) => { if (e.target === morningBriefModal) morningBriefModal.classList.remove('active'); });

  if (morningBriefForm) morningBriefForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { title: document.getElementById('briefTitle').value.trim(), content: document.getElementById('briefContent').value.trim() };
    try {
      await fetch('/api/morning-briefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      document.getElementById('briefTitle').value = '';
      document.getElementById('briefContent').value = '';
      morningBriefModal.classList.remove('active');
      loadMorningBriefs();
      location.reload();
    } catch (err) {}
  });

  // --- Affirmations ---
  const affirmationText = document.getElementById('affirmationText');
  const affirmationInput = document.getElementById('affirmationInput');
  const affirmationSave = document.getElementById('affirmationSave');

  async function loadAffirmation() {
    if (!affirmationText) return;
    try {
      const res = await fetch('/api/affirmations');
      const data = await res.json();
      affirmationText.textContent = (data.today && data.today.text) ? data.today.text : 'Set your intention for the day...';
    } catch (err) {
      affirmationText.textContent = 'Set your intention for the day...';
    }
  }

  async function saveAffirmation() {
    const text = affirmationInput?.value?.trim();
    if (!text) return;
    try {
      await fetch('/api/affirmations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      affirmationInput.value = '';
      loadAffirmation();
    } catch (err) {}
  }

  if (affirmationSave) affirmationSave.addEventListener('click', saveAffirmation);
  if (affirmationInput) affirmationInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveAffirmation(); } });

  // --- Pomodoro ---
  const pomodoroDisplay = document.getElementById('pomodoroDisplay');
  const pomodoroMode = document.getElementById('pomodoroMode');
  const pomodoroStart = document.getElementById('pomodoroStart');
  const pomodoroPause = document.getElementById('pomodoroPause');
  const pomodoroReset = document.getElementById('pomodoroReset');
  let pomodoroTimer = null;
  let pomodoroSeconds = 25 * 60;
  const pomodoroWorkLen = 25 * 60;
  const pomodoroBreakLen = 5 * 60;
  let pomodoroIsWork = true;
  let pomodoroPaused = false;

  function formatPomodoro(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + sec.toString().padStart(2, '0');
  }

  function tickPomodoro() {
    if (pomodoroPaused) return;
    pomodoroSeconds--;
    if (pomodoroDisplay) pomodoroDisplay.textContent = formatPomodoro(pomodoroSeconds);
    if (pomodoroSeconds <= 0) {
      clearInterval(pomodoroTimer);
      pomodoroTimer = null;
      pomodoroIsWork = !pomodoroIsWork;
      pomodoroSeconds = pomodoroIsWork ? pomodoroWorkLen : pomodoroBreakLen;
      if (pomodoroMode) pomodoroMode.textContent = pomodoroIsWork ? 'Work' : 'Break';
      if (pomodoroDisplay) pomodoroDisplay.textContent = formatPomodoro(pomodoroSeconds);
    }
  }

  if (pomodoroStart) pomodoroStart.addEventListener('click', () => {
    if (pomodoroTimer) return;
    pomodoroPaused = false;
    pomodoroTimer = setInterval(tickPomodoro, 1000);
  });
  if (pomodoroPause) pomodoroPause.addEventListener('click', () => { pomodoroPaused = !pomodoroPaused; });
  if (pomodoroReset) pomodoroReset.addEventListener('click', () => {
    clearInterval(pomodoroTimer);
    pomodoroTimer = null;
    pomodoroIsWork = true;
    pomodoroSeconds = pomodoroWorkLen;
    pomodoroPaused = false;
    if (pomodoroMode) pomodoroMode.textContent = 'Work';
    if (pomodoroDisplay) pomodoroDisplay.textContent = formatPomodoro(pomodoroSeconds);
  });

  // --- One Thing ---
  const oneThingInput = document.getElementById('oneThingInput');
  const oneThingSave = document.getElementById('oneThingSave');
  const oneThingDisplay = document.getElementById('oneThingDisplay');
  async function loadOneThing() {
    try {
      const res = await fetch('/api/one-thing');
      const data = await res.json();
      if (data.text) oneThingDisplay.textContent = data.text;
      else oneThingDisplay.textContent = '';
    } catch (err) {}
  }
  async function saveOneThing() {
    const text = oneThingInput?.value?.trim();
    try {
      await fetch('/api/one-thing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text || '' }) });
      oneThingInput.value = '';
      loadOneThing();
    } catch (err) {}
  }
  if (oneThingSave) oneThingSave.addEventListener('click', saveOneThing);
  if (oneThingInput) oneThingInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveOneThing(); } });

  // --- Gratitude ---
  const gratitude1 = document.getElementById('gratitude1');
  const gratitude2 = document.getElementById('gratitude2');
  const gratitude3 = document.getElementById('gratitude3');
  const gratitudeSave = document.getElementById('gratitudeSave');
  async function loadGratitude() {
    try {
      const res = await fetch('/api/gratitude');
      const data = await res.json();
      if (data.items && data.items.length) {
        gratitude1.value = data.items[0] || '';
        gratitude2.value = data.items[1] || '';
        gratitude3.value = data.items[2] || '';
      }
    } catch (err) {}
  }
  async function saveGratitude() {
    const items = [(gratitude1?.value || '').trim(), (gratitude2?.value || '').trim(), (gratitude3?.value || '').trim()];
    try {
      await fetch('/api/gratitude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
      loadGratitude();
    } catch (err) {}
  }
  if (gratitudeSave) gratitudeSave.addEventListener('click', saveGratitude);

  // --- Focus ---
  const focusInput = document.getElementById('focusInput');
  const focusSave = document.getElementById('focusSave');
  const focusDisplay = document.getElementById('focusDisplay');
  async function loadFocus() {
    try {
      const res = await fetch('/api/focus');
      const data = await res.json();
      if (data.text) focusDisplay.textContent = data.text;
      else focusDisplay.textContent = '';
    } catch (err) {}
  }
  async function saveFocus() {
    const text = focusInput?.value?.trim();
    try {
      await fetch('/api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text || '' }) });
      focusInput.value = '';
      loadFocus();
    } catch (err) {}
  }
  if (focusSave) focusSave.addEventListener('click', saveFocus);
  if (focusInput) focusInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveFocus(); } });

  // --- Mobile menu ---
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // --- Sortable Widgets + Grid Sizes ---
  const dashboardWidgets = document.getElementById('dashboardWidgets');
  function reorderWidgets(order) {
    if (!dashboardWidgets || !order || !Array.isArray(order)) return;
    const byId = {};
    dashboardWidgets.querySelectorAll('.dashboard-widget').forEach(w => {
      const id = w.getAttribute('data-widget-id');
      if (id) byId[id] = w;
    });
    order.forEach(id => {
      const el = byId[id];
      if (el) dashboardWidgets.appendChild(el);
    });
  }
  function applySizes(sizes) {
    if (!dashboardWidgets || !sizes || typeof sizes !== 'object') return;
    dashboardWidgets.querySelectorAll('.dashboard-widget').forEach(w => {
      const id = w.getAttribute('data-widget-id');
      const size = sizes[id] || w.getAttribute('data-size') || 'medium';
      w.setAttribute('data-size', size);
    });
  }
  function collectSizes() {
    const sizes = {};
    dashboardWidgets.querySelectorAll('.dashboard-widget').forEach(w => {
      const id = w.getAttribute('data-widget-id');
      if (id) sizes[id] = w.getAttribute('data-size') || 'medium';
    });
    return sizes;
  }
  async function saveLayout() {
    const widgets = dashboardWidgets.querySelectorAll('.dashboard-widget');
    const order = Array.from(widgets).map(w => w.getAttribute('data-widget-id')).filter(Boolean);
    const sizes = collectSizes();
    try {
      await fetch('/api/dashboard-layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, sizes })
      });
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  }
  async function initLayout() {
    try {
      const res = await fetch('/api/dashboard-layout');
      const data = await res.json();
      let order = data.order && data.order.length ? data.order : [];
      const existingIds = Array.from(dashboardWidgets.querySelectorAll('.dashboard-widget'))
        .map(w => w.getAttribute('data-widget-id')).filter(Boolean);
      const missing = existingIds.filter(id => !order.includes(id));
      if (missing.length) order = [...order, ...missing];
      if (order.length) reorderWidgets(order);
      if (data.sizes) applySizes(data.sizes);
      else applySizes(collectSizes());
    } catch (err) {
      console.error('Failed to load layout:', err);
    }
  }
  dashboardWidgets?.addEventListener('click', (e) => {
    const resizeBtn = e.target.closest('.widget-resize-btn');
    if (!resizeBtn) return;
    e.preventDefault();
    e.stopPropagation();
    const widget = resizeBtn.closest('.dashboard-widget');
    if (!widget) return;
    const sizes = ['small', 'medium', 'large'];
    const current = widget.getAttribute('data-size') || 'medium';
    const idx = sizes.indexOf(current);
    const next = sizes[(idx + 1) % sizes.length];
    widget.setAttribute('data-size', next);
    saveLayout();
  });
  if (typeof Sortable !== 'undefined' && dashboardWidgets) {
    initLayout().then(() => {
      new Sortable(dashboardWidgets, {
        handle: '.widget-drag-handle',
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: () => saveLayout()
      });
    });
  }

  // --- Daily Brief Expand/Collapse ---
  const dailyBriefHeader = document.getElementById('dailyBriefHeader');
  const dailyBriefBody = document.getElementById('dailyBriefBody');
  const dailyBriefToggle = document.getElementById('dailyBriefToggle');
  const dailyBriefChevron = document.getElementById('dailyBriefChevron');
  const STORAGE_KEY = 'dailyBriefCollapsed';
  function setDailyBriefCollapsed(collapsed) {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch (_) {}
  }
  function getDailyBriefCollapsed() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }
  function applyDailyBriefState() {
    if (!dailyBriefBody || !dailyBriefChevron) return;
    const collapsed = getDailyBriefCollapsed();
    dailyBriefBody.classList.toggle('collapsed', collapsed);
    if (dailyBriefChevron) dailyBriefChevron.textContent = collapsed ? '\u25B6' : '\u25BC';
  }
  if (dailyBriefToggle && dailyBriefHeader) {
    dailyBriefToggle.addEventListener('click', () => {
      const collapsed = !getDailyBriefCollapsed();
      setDailyBriefCollapsed(collapsed);
      applyDailyBriefState();
    });
    dailyBriefHeader.addEventListener('click', (e) => {
      if (!e.target.closest('.daily-brief-add') && !e.target.closest('.daily-brief-toggle')) {
        const collapsed = !getDailyBriefCollapsed();
        setDailyBriefCollapsed(collapsed);
        applyDailyBriefState();
      }
    });
  }
  applyDailyBriefState();

  // --- Init ---
  renderCalendar();
  loadCryptoPrices();
  loadPortfolioSnapshot();
  loadSections();
  loadTodos();
  loadJrTodos();
  loadNotes();
  loadAiInsights();
  loadMorningBriefs();
  loadAffirmation();
  loadOneThing();
  loadGratitude();
  loadFocus();
})();
