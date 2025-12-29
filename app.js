document.addEventListener('DOMContentLoaded', () => {
  const SUPABASE_URL = 'https://gbscowfidfdiaywktqal.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic2Nvd2ZpZGZkaWF5d2t0cWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNDU0MzUsImV4cCI6MjA3MTcyMTQzNX0.BITW_rG0-goeo8VCgl-ZTSWfa8BDYsmT2xhIg-9055g';
  const STORAGE_BUCKET = 'book-covers';

  const authForm = document.getElementById('auth-form');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const authPanel = document.querySelector('.panel--auth');
  const viewNav = document.getElementById('view-nav');
  const viewButtons = viewNav ? Array.from(viewNav.querySelectorAll('[data-view]')) : [];
  const logoutBtn = document.getElementById('logout-btn');
  const sessionStatus = document.getElementById('session-status');
  const bookPanel = document.getElementById('book-panel');
  const listPanel = document.getElementById('list-panel');
  const toastEl = document.getElementById('toast');
  const filterStatus = document.getElementById('filter-status');
  const authSubmitBtn = document.getElementById('auth-submit');

  const bookForm = document.getElementById('book-form');
  const formTitle = document.getElementById('form-title');
  const resetFormBtn = document.getElementById('reset-form');
  const titleInput = document.getElementById('title');
  const authorInput = document.getElementById('author');
  const statusSelect = document.getElementById('status');
  const ratingInput = document.getElementById('rating');
  const tagsInput = document.getElementById('tags');
  const reviewInput = document.getElementById('review');
  const coverInput = document.getElementById('cover');
  const bookSubmitBtn = document.getElementById('book-submit');
  const bookList = document.getElementById('book-list');
  const ambient = document.getElementById('ambient-light');
  const lightToggle = document.getElementById('light-toggle');
  const LIGHT_PREF_KEY = 'ambient-light';
  const modal = document.getElementById('book-modal');
  const modalInner = document.getElementById('modal-inner');
  const modalCloseBtn = modal ? modal.querySelector('.modal__close') : null;
  const modalBackdrop = modal ? modal.querySelector('.modal__backdrop') : null;

  if (!window.supabase) {
    showToast('Supabase SDK nicht geladen.');
    throw new Error('Supabase SDK fehlt');
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let currentUser = null;
  let editingId = null;
  let books = [];
  let toastTimer = null;
  let currentView = 'list';
  let modalHideTimer = null;
  let isLightOn = false;

  authForm.addEventListener('submit', handleAuthSubmit);
  logoutBtn.addEventListener('click', handleLogout);
  bookForm.addEventListener('submit', handleBookSubmit);
  resetFormBtn.addEventListener('click', resetBookForm);
  filterStatus.addEventListener('change', () => {
    loadBooks();
  });
  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  if (lightToggle) {
    lightToggle.addEventListener('click', toggleAmbientLight);
  }
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', closeModal);
  }
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') {
      closeModal();
    }
  });

  initLightPreference();
  initAuth();

  async function initAuth() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      showToast('Konnte Session nicht laden.');
    }
    currentUser = data?.session?.user || null;
    onAuthChanged(!!currentUser);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      onAuthChanged(!!currentUser);
    });
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      showToast('E-Mail und Passwort eingeben.');
      return;
    }

    setAuthLoading(true);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    setAuthLoading(false);

    if (error) {
      showToast(error.message || 'Login fehlgeschlagen.');
      return;
    }

    showToast('Angemeldet.');
  }

  async function handleLogout() {
    const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
    if (error) {
      showToast(error.message || 'Abmelden fehlgeschlagen.');
    } else {
      showToast('Abgemeldet.');
    }
  }

  function onAuthChanged(isAuthed) {
    sessionStatus.textContent = isAuthed ? 'Angemeldet' : 'Abgemeldet';
    logoutBtn.hidden = !isAuthed;
    authPanel.hidden = isAuthed;
    if (viewNav) {
      viewNav.hidden = !isAuthed;
      viewNav.classList.toggle('is-hidden', !isAuthed);
    }
    if (viewButtons.length) {
      viewButtons.forEach((btn) => {
        btn.disabled = !isAuthed;
      });
    }

    if (isAuthed) {
      switchView(currentView || 'list');
      loadBooks();
    } else {
      editingId = null;
      books = [];
      bookForm.reset();
      bookPanel.hidden = true;
      listPanel.hidden = true;
      if (bookList) {
        bookList.innerHTML = '<p class="muted">Noch keine Bücher. Lege los!</p>';
      }
    }
  }

  async function handleBookSubmit(event) {
    event.preventDefault();
    if (!currentUser) {
      showToast('Bitte zuerst anmelden.');
      return;
    }

    const payload = {
      title: titleInput.value.trim(),
      author: authorInput.value.trim(),
      status: statusSelect.value,
      rating: ratingInput.value ? Number(ratingInput.value) : null,
      tags: tagsInput.value.trim(),
      review: reviewInput.value.trim()
    };

    if (!payload.title || !payload.author) {
      showToast('Titel und Autor:in sind Pflicht.');
      return;
    }

    setBookLoading(true);
    let coverUrl = null;
    const file = coverInput.files && coverInput.files[0];
    if (file) {
      try {
        coverUrl = await uploadCover(file);
      } catch (err) {
        showToast(err.message || 'Fehler beim Upload.');
        setBookLoading(false);
        return;
      }
    }

    if (coverUrl) {
      payload.cover_url = coverUrl;
    }

    let error = null;
    if (editingId) {
      const response = await supabaseClient.from('books').update(payload).eq('id', editingId);
      error = response.error;
      if (!error) {
        showToast('Buch aktualisiert.');
      }
    } else {
      const insertPayload = Object.assign({}, payload, { user_id: currentUser.id });
      const response = await supabaseClient.from('books').insert(insertPayload);
      error = response.error;
      if (!error) {
        showToast('Buch gespeichert.');
      }
    }

    setBookLoading(false);

    if (error) {
      showToast(error.message || 'Speichern fehlgeschlagen.');
      return;
    }

    resetBookForm();
    switchView('list');
    loadBooks();
  }

  function setAuthLoading(isLoading) {
    authSubmitBtn.disabled = isLoading;
    authSubmitBtn.textContent = isLoading ? 'Wird angemeldet...' : 'Anmelden';
  }

  function setBookLoading(isLoading) {
    bookSubmitBtn.disabled = isLoading;
    bookSubmitBtn.textContent = isLoading ? 'Speichert...' : 'Speichern';
  }

  async function loadBooks() {
    if (!currentUser) return;
    const statusFilter = filterStatus.value;
    let query = supabaseClient
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      showToast('Konnte Bücher nicht laden.');
      return;
    }

    books = data || [];
    renderBooks(books);
  }

  function renderBooks(items) {
    if (!items.length) {
      bookList.innerHTML = '<p class="muted">Noch keine Bücher. Lege los!</p>';
      return;
    }

    bookList.innerHTML = '';
    items.forEach((book) => {
      const card = document.createElement('article');
      card.className = 'book-card';
      card.tabIndex = 0;

      const inner = document.createElement('div');
      inner.className = 'book-card__inner';

      const coverBox = document.createElement('div');
      coverBox.className = 'book-card__cover';
      if (book.cover_url) {
        const img = document.createElement('img');
        img.src = book.cover_url;
        img.alt = 'Cover von ' + book.title;
        img.className = 'cover';
        coverBox.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'cover cover--placeholder';
        placeholder.textContent = book.title ? book.title.charAt(0).toUpperCase() : 'B';
        coverBox.appendChild(placeholder);
      }

      const body = document.createElement('div');
      body.className = 'book-card__body';
      body.innerHTML = `
        <div class="book-card__top">
          <span class="badge badge--overlay">${statusLabel(book.status)}</span>
        </div>
      `;

      inner.appendChild(coverBox);
      inner.appendChild(body);
      card.appendChild(inner);

      card.addEventListener('click', () => {
        openModal(book);
      });
      card.addEventListener('keypress', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          openModal(book);
        }
      });

      bookList.appendChild(card);
    });
  }

  function renderTags(raw) {
    const tags = raw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!tags.length) return '';
    return `
      <div class="tag-list">
        ${tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
      </div>
    `;
  }

  function startEdit(book) {
    editingId = book.id;
    formTitle.textContent = 'Bearbeite ' + book.title;
    titleInput.value = book.title || '';
    authorInput.value = book.author || '';
    statusSelect.value = book.status || 'reading';
    ratingInput.value = book.rating != null ? book.rating : '';
    tagsInput.value = book.tags || '';
    reviewInput.value = book.review || '';
    switchView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetBookForm() {
    editingId = null;
    formTitle.textContent = 'Neuer Eintrag';
    bookForm.reset();
  }

  async function deleteBook(id) {
    if (!confirm('Buch wirklich löschen?')) return;
    const { error } = await supabaseClient.from('books').delete().eq('id', id);
    if (error) {
      showToast('Konnte Buch nicht löschen.');
      return;
    }
    showToast('Gelöscht.');
    loadBooks();
  }

  function statusLabel(status) {
    switch (status) {
      case 'reading':
        return 'Am Lesen';
      case 'finished':
        return 'Gelesen';
      case 'wishlist':
        return 'Merkliste';
      default:
        return 'Unbekannt';
    }
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('toast--show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('toast--show');
    }, 3200);
  }

  function switchView(view) {
    if (!currentUser) return;
    currentView = view;
    if (viewButtons.length) {
      viewButtons.forEach((btn) => {
        btn.classList.toggle('tab-btn--active', btn.dataset.view === view);
      });
    }
    if (bookPanel && listPanel) {
      bookPanel.hidden = view !== 'form';
      listPanel.hidden = view !== 'list';
    }
  }

  function toggleAmbientLight() {
    const next = !isLightOn;
    applyLightState(next);
    persistLightState(next);
    if (lightToggle) {
      lightToggle.classList.add('is-pulled');
      setTimeout(() => lightToggle.classList.remove('is-pulled'), 350);
    }
  }

  function applyLightState(on) {
    isLightOn = !!on;
    if (ambient) {
      ambient.classList.toggle('is-on', isLightOn);
    }
    document.body.classList.toggle('light-on', isLightOn);
  }

  function persistLightState(on) {
    try {
      localStorage.setItem(LIGHT_PREF_KEY, on ? 'on' : 'off');
    } catch (_) {
      // ignore
    }
  }

  function initLightPreference() {
    try {
      const saved = localStorage.getItem(LIGHT_PREF_KEY);
      if (saved === 'on' || saved === 'off') {
        applyLightState(saved === 'on');
        return;
      }
    } catch (_) {
      // ignore
    }
    applyLightState(false);
  }

  function openModal(book) {
    if (!modal || !modalInner) return;
    const coverHtml = book.cover_url
      ? `<img src="${book.cover_url}" alt="Cover von ${book.title}" class="cover">`
      : `<div class="cover cover--placeholder">${book.title ? book.title.charAt(0).toUpperCase() : 'B'}</div>`;
    const tagsHtml = book.tags ? renderTags(book.tags) : '';
    const reviewHtml = book.review ? `<p class="book-card__review">${book.review}</p>` : '';
    modalInner.innerHTML = `
      <div class="modal__cover-block">
        ${coverHtml}
        <span class="badge badge--overlay">${statusLabel(book.status)}</span>
      </div>
      <div class="modal__body">
        <div class="back-header">
          <span class="badge">${statusLabel(book.status)}</span>
          <h3 class="book-card__title">${book.title}</h3>
          <div class="book-card__meta">
            <span>von ${book.author}</span>
            ${book.rating ? `<span>★ ${book.rating}</span>` : ''}
            ${book.created_at ? `<span>${new Date(book.created_at).toLocaleDateString('de-DE')}</span>` : ''}
          </div>
        </div>
        ${tagsHtml}
        ${reviewHtml}
        <div class="card-actions">
          <button class="ghost-btn ghost-btn--small js-edit">Bearbeiten</button>
          <button class="ghost-btn ghost-btn--small js-delete">Löschen</button>
        </div>
      </div>
    `;
    modal.hidden = false;
    modal.classList.add('is-open');
    requestAnimationFrame(() => {
      modal.classList.add('is-visible');
      modalInner.classList.add('is-flipped');
    });
    const editBtn = modalInner.querySelector('.js-edit');
    const deleteBtn = modalInner.querySelector('.js-delete');
    if (editBtn) {
      editBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        closeModal();
        startEdit(book);
      });
    }
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (evt) => {
        evt.stopPropagation();
        closeModal();
        await deleteBook(book.id);
      });
    }
  }

  function closeModal() {
    if (!modal || !modalInner) return;
    if (modalHideTimer) {
      clearTimeout(modalHideTimer);
    }
    modal.classList.remove('is-visible');
    modalInner.classList.remove('is-flipped');
    modalHideTimer = setTimeout(() => {
      modal.classList.remove('is-open');
      modal.hidden = true;
    }, 280);
  }

  async function uploadCover(file) {
    if (!currentUser) throw new Error('Nicht angemeldet.');
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${currentUser.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const { error: uploadError } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
});
