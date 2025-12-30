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
  const filterQuery = document.getElementById('filter-query');
  const filterRating = document.getElementById('filter-rating');
  const filterAuthor = document.getElementById('filter-author');
  const filterTag = document.getElementById('filter-tag');
  const sortSelect = document.getElementById('sort-by');
  const filterToggle = document.getElementById('filter-toggle');
  const filterPanel = document.getElementById('filter-panel');
  const authSubmitBtn = document.getElementById('auth-submit');

  const bookForm = document.getElementById('book-form');
  const formTitle = document.getElementById('form-title');
  const resetFormBtn = document.getElementById('reset-form');
  const titleInput = document.getElementById('title');
  const authorInput = document.getElementById('author');
  const statusSelect = document.getElementById('status');
  const ratingInput = document.getElementById('rating');
  const isbnInput = document.getElementById('isbn');
  const isbnFetchBtn = document.getElementById('isbn-fetch-btn');
  const isbnScanBtn = document.getElementById('isbn-scan-btn');
  const scanModal = document.getElementById('scan-modal');
  const scanModalClose = scanModal ? scanModal.querySelector('.modal__close--scan') : null;
  const scanModalBackdrop = scanModal ? scanModal.querySelector('.modal__backdrop') : null;
  const scanVideo = document.getElementById('scan-video');
  const scanStatus = document.getElementById('scan-status');
  const scanStopBtn = document.getElementById('scan-stop-btn');
  const scanQuickToggle = document.getElementById('scan-quick-toggle');
  const scanLast = document.getElementById('scan-last');
  const summaryInput = document.getElementById('summary');
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
  const dragState = { draggingId: null, isDragging: false };
  let scanStream = null;
  let scanDetector = null;
  let scanFrameRequest = null;
  let lastScanValue = null;
  let lastScanClearTimer = null;
  let lastSavedIsbn = null;

  authForm.addEventListener('submit', handleAuthSubmit);
  logoutBtn.addEventListener('click', handleLogout);
  bookForm.addEventListener('submit', handleBookSubmit);
  resetFormBtn.addEventListener('click', resetBookForm);
  filterStatus.addEventListener('change', applyFiltersAndSort);
  if (filterQuery) {
    filterQuery.addEventListener('input', applyFiltersAndSort);
  }
  if (filterRating) {
    filterRating.addEventListener('change', applyFiltersAndSort);
  }
  if (filterAuthor) {
    filterAuthor.addEventListener('change', applyFiltersAndSort);
  }
  if (filterTag) {
    filterTag.addEventListener('change', applyFiltersAndSort);
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', applyFiltersAndSort);
  }
  if (filterToggle && filterPanel) {
    filterToggle.addEventListener('click', toggleFilterPanel);
    document.addEventListener('click', (evt) => {
      if (
        filterPanel.hidden ||
        filterPanel.contains(evt.target) ||
        filterToggle.contains(evt.target)
      ) {
        return;
      }
      filterPanel.hidden = true;
    });
    filterPanel.addEventListener('change', (evt) => {
      if (evt.target.matches('select')) {
        applyFiltersAndSort();
      }
    });
    filterPanel.addEventListener('input', (evt) => {
      if (evt.target.matches('input')) {
        applyFiltersAndSort();
      }
    });
  }
  if (isbnFetchBtn) {
    isbnFetchBtn.addEventListener('click', () => {
      autofillFromIsbn({ showErrors: true });
    });
  }
  if (isbnScanBtn) {
    isbnScanBtn.addEventListener('click', startIsbnScan);
  }
  if (scanModalClose) {
    scanModalClose.addEventListener('click', stopIsbnScan);
  }
  if (scanModalBackdrop) {
    scanModalBackdrop.addEventListener('click', stopIsbnScan);
  }
  if (scanStopBtn) {
    scanStopBtn.addEventListener('click', stopIsbnScan);
  }
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
      if (scanModal && !scanModal.hidden) {
        stopIsbnScan();
      } else {
        closeModal();
      }
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
      isbn: isbnInput.value.trim(),
      summary: summaryInput.value.trim(),
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
      const insertPayload = Object.assign({}, payload, {
        user_id: currentUser.id,
        sort_order: getNextSortOrder()
      });
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
    const { data, error } = await supabaseClient
      .from('books')
      .select('*')
      .order('sort_order', { ascending: true, nullsLast: true })
      .order('created_at', { ascending: false });
    if (error) {
      showToast('Konnte Bücher nicht laden.');
      return;
    }

    books = normalizeSortOrder(data || []);
    updateFilterOptions(books);
    applyFiltersAndSort();
  }

  function renderBooks(items, allowDrag = true) {
    if (!items.length) {
      bookList.innerHTML = '<p class="muted">Noch keine Bücher. Lege los!</p>';
      return;
    }

    bookList.innerHTML = '';
    items.forEach((book) => {
      const card = document.createElement('article');
      card.className = 'book-card';
      card.tabIndex = 0;
      card.dataset.id = book.id;
      card.draggable = allowDrag;

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
      const overlay = document.createElement('div');
      overlay.className = 'book-card__overlay';
      overlay.textContent = book.title || 'Ohne Titel';
      coverBox.appendChild(overlay);

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

      if (allowDrag) {
        attachDragEvents(card, book);
      }

      card.addEventListener('click', () => {
        if (dragState.isDragging) return;
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

  function attachDragEvents(card, book) {
    card.addEventListener('dragstart', (evt) => {
      dragState.draggingId = book.id;
      dragState.isDragging = true;
      card.classList.add('book-card--dragging');
      if (evt.dataTransfer) {
        evt.dataTransfer.effectAllowed = 'move';
        evt.dataTransfer.setData('text/plain', book.id);
      }
    });
    card.addEventListener('dragend', () => {
      dragState.draggingId = null;
      setTimeout(() => {
        dragState.isDragging = false;
      }, 30);
      card.classList.remove('book-card--dragging');
      card.classList.remove('book-card--drop-target');
    });
    card.addEventListener('dragover', (evt) => {
      if (!dragState.draggingId || dragState.draggingId === book.id) return;
      evt.preventDefault();
      card.classList.add('book-card--drop-target');
    });
    card.addEventListener('dragleave', () => {
      card.classList.remove('book-card--drop-target');
    });
    card.addEventListener('drop', (evt) => {
      evt.preventDefault();
      card.classList.remove('book-card--drop-target');
      const sourceId = dragState.draggingId;
      if (!sourceId || sourceId === book.id) return;
      reorderBooks(sourceId, book.id);
    });
  }

  function reorderBooks(sourceId, targetId) {
    const next = [...books];
    const fromIndex = next.findIndex((b) => b.id === sourceId);
    const toIndex = next.findIndex((b) => b.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    assignSortOrder(next);
    books = next;
    applyFiltersAndSort();
    persistSortOrder(next);
  }

  function assignSortOrder(list) {
    list.forEach((item, index) => {
      item.sort_order = index + 1;
    });
  }

  async function persistSortOrder(list) {
    const updates = list.map((item) =>
      supabaseClient
        .from('books')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
        .eq('user_id', currentUser.id)
    );
    const results = await Promise.all(updates);
    const firstError = results.find((res) => res.error)?.error;
    if (firstError) {
      showToast('Konnte Reihenfolge nicht speichern.');
    }
  }

  function normalizeSortOrder(list) {
    if (!list.length) return [];
    const sorted = [...list].sort((a, b) => {
      if (a.sort_order == null && b.sort_order == null) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (a.sort_order == null) return 1;
      if (b.sort_order == null) return -1;
      return a.sort_order - b.sort_order;
    });
    assignSortOrder(sorted);
    return sorted;
  }

  function getNextSortOrder() {
    if (!books.length) return 1;
    const maxOrder = Math.max(...books.map((b) => b.sort_order || 0));
    return maxOrder + 1;
  }

  function applyFiltersAndSort(returnOnly = false) {
    const statusFilter = filterStatus ? filterStatus.value : 'all';
    const search = filterQuery ? filterQuery.value.trim().toLowerCase() : '';
    const ratingVal = filterRating ? filterRating.value : 'any';
    const authorVal = filterAuthor ? filterAuthor.value : 'any';
    const tagVal = filterTag ? filterTag.value : 'any';
    const allowDrag = shouldAllowDrag();

    let filtered = [...books];
    if (statusFilter !== 'all') {
      filtered = filtered.filter((book) => book.status === statusFilter);
    }
    if (ratingVal !== 'any') {
      const min = Number(ratingVal);
      filtered = filtered.filter((book) => (book.rating || 0) >= min);
    }
    if (authorVal !== 'any') {
      filtered = filtered.filter(
        (book) => (book.author || '').trim().toLowerCase() === authorVal.toLowerCase()
      );
    }
    if (tagVal !== 'any') {
      filtered = filtered.filter((book) => {
        const tags = (book.tags || '')
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean);
        return tags.includes(tagVal.toLowerCase());
      });
    }
    if (search) {
      filtered = filtered.filter((book) => {
        const haystack = `${book.title || ''} ${book.author || ''} ${book.tags || ''}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    const sorted = sortBooks(filtered);
    if (returnOnly) return sorted;

    renderBooks(sorted, allowDrag);
    return sorted;
  }

  function sortBooks(list) {
    const mode = sortSelect ? sortSelect.value : 'manual';
    const sorted = [...list];
    switch (mode) {
      case 'title_asc':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de', { sensitivity: 'base' }));
        break;
      case 'rating_desc':
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'date_desc':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'manual':
      default:
        sorted.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        break;
    }
    return sorted;
  }

  function shouldAllowDrag() {
    const manual = sortSelect ? sortSelect.value === 'manual' : true;
    const hasSearch = filterQuery ? !!filterQuery.value.trim() : false;
    const hasRatingFilter = filterRating ? filterRating.value !== 'any' : false;
    const hasAuthorFilter = filterAuthor ? filterAuthor.value !== 'any' : false;
    const hasTagFilter = filterTag ? filterTag.value !== 'any' : false;
    return manual && !hasSearch && !hasRatingFilter && !hasAuthorFilter && !hasTagFilter;
  }

  async function startIsbnScan() {
    if (!('BarcodeDetector' in window)) {
      showToast('Barcode-Scan wird nicht unterstützt. Bitte ISBN eingeben.');
      return;
    }
    if (!scanVideo || !scanModal) return;
    stopIsbnScan();
    try {
      scanDetector = new window.BarcodeDetector({ formats: ['ean_13', 'code_128'] });
    } catch (err) {
      showToast('Scanner konnte nicht initialisiert werden.');
      return;
    }
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      scanVideo.srcObject = scanStream;
      await scanVideo.play();
      showScanModal();
      if (scanStatus) scanStatus.textContent = 'Scannen... halte den Strichcode ins Bild.';
      detectLoop();
    } catch (err) {
      showToast('Kamera nicht verfügbar.');
      stopIsbnScan();
    }
  }

  function stopIsbnScan() {
    if (scanFrameRequest) {
      cancelAnimationFrame(scanFrameRequest);
      scanFrameRequest = null;
    }
    if (scanStream) {
      scanStream.getTracks().forEach((t) => t.stop());
      scanStream = null;
    }
    if (scanVideo) {
      scanVideo.srcObject = null;
    }
    if (scanStatus) {
      scanStatus.textContent = 'Scan gestoppt.';
    }
    hideScanModal();
  }

  async function detectLoop() {
    if (!scanDetector || !scanVideo || scanVideo.readyState < 2) {
      scanFrameRequest = requestAnimationFrame(detectLoop);
      return;
    }
    try {
      const codes = await scanDetector.detect(scanVideo);
      if (codes && codes.length) {
        const value = codes[0].rawValue;
        if (value === lastScanValue) {
          scanFrameRequest = requestAnimationFrame(detectLoop);
          return;
        }
        lastScanValue = value;
        if (lastScanClearTimer) clearTimeout(lastScanClearTimer);
        lastScanClearTimer = setTimeout(() => {
          lastScanValue = null;
        }, 1200);
        if (value && isbnInput) {
          if (value === lastSavedIsbn) {
            showToast('Schon gescannt.');
            scanFrameRequest = requestAnimationFrame(detectLoop);
            return;
          }
          isbnInput.value = value;
          showToast('ISBN übernommen.');
          const quickMode = scanQuickToggle ? scanQuickToggle.checked : false;
          const info = await autofillFromIsbn({ showErrors: false, returnInfo: true });
          if (quickMode) {
            const ok = await maybeQuickSave(info, value);
            if (ok) {
              scanFrameRequest = requestAnimationFrame(detectLoop);
              return;
            }
          }
          stopIsbnScan();
          return;
        }
      }
    } catch (err) {
      // ignore detection errors and keep scanning
    }
    scanFrameRequest = requestAnimationFrame(detectLoop);
  }

  function showScanModal() {
    if (!scanModal) return;
    scanModal.hidden = false;
    scanModal.classList.add('is-open');
    requestAnimationFrame(() => scanModal.classList.add('is-visible'));
  }

  function hideScanModal() {
    if (!scanModal) return;
    scanModal.classList.remove('is-visible');
    setTimeout(() => {
      scanModal.classList.remove('is-open');
      scanModal.hidden = true;
    }, 160);
  }

  async function maybeQuickSave(info, isbnValue) {
    const quickMode = scanQuickToggle ? scanQuickToggle.checked : false;
    if (!quickMode) return false;

    const hasInfo = info && info.title && info.authors && info.authors.length;
    if (!hasInfo) {
      showToast('Keine Daten gefunden, bitte ergänzen.');
      return false;
    }

    const exists = books.some((b) => (b.isbn || '').trim() === isbnValue);
    if (exists) {
      showToast('Schon vorhanden.');
      lastSavedIsbn = isbnValue;
      updateLastScan(info.title, isbnValue);
      return true;
    }

    const payload = {
      title: info.title,
      author: info.authors.join(', '),
      isbn: isbnValue,
      status: statusSelect ? statusSelect.value : 'wishlist',
      rating: null,
      summary: '',
      tags: '',
      review: '',
      user_id: currentUser.id,
      sort_order: getNextSortOrder()
    };

    const { error } = await supabaseClient.from('books').insert(payload);
    if (error) {
      showToast('Konnte Buch nicht speichern.');
      return false;
    }
    showToast('Gespeichert: ' + info.title);
    resetBookForm();
    if (isbnInput) isbnInput.value = '';
    loadBooks();
    lastSavedIsbn = isbnValue;
    updateLastScan(info.title, isbnValue);
    return true;
  }

  function updateLastScan(title, isbn) {
    if (!scanLast) return;
    scanLast.textContent = `Letzter Scan: ${title || 'Ohne Titel'} (${isbn || '–'})`;
  }

  async function autofillFromIsbn(options) {
    const opts = Object.assign({ showErrors: true, returnInfo: false }, options);
    if (!isbnInput) return;
    const isbn = isbnInput.value.trim();
    if (!isbn) {
      if (opts.showErrors) showToast('Bitte ISBN eingeben.');
      return;
    }

    const btn = opts.showErrors ? isbnFetchBtn : null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Lädt...';
    }
    try {
      const resp = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
      if (!resp.ok) throw new Error('Suche fehlgeschlagen');
      const data = await resp.json();
      const volume = data.items && data.items[0];
      const info = volume ? volume.volumeInfo : null;
      if (!info) {
        if (opts.showErrors) showToast('Keine Daten zur ISBN gefunden.');
        return opts.returnInfo ? null : undefined;
      }
      if (info.title && !titleInput.value.trim()) {
        titleInput.value = info.title;
      }
      if (info.authors && info.authors.length && !authorInput.value.trim()) {
        authorInput.value = info.authors.join(', ');
      }
      if (opts.showErrors) showToast('Titel/Autor ausgefüllt (falls leer).');
      if (opts.returnInfo) return info;
      return;
    } catch (err) {
      if (opts.showErrors) showToast('Konnte ISBN nicht abfragen.');
      if (opts.returnInfo) return null;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Aus ISBN übernehmen';
      }
    }
  }

  function toggleFilterPanel() {
    if (!filterPanel) return;
    filterPanel.hidden = !filterPanel.hidden;
  }

  function updateFilterOptions(list) {
    const authors = Array.from(
      new Set(
        list
          .map((b) => (b.author || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));

    const tagsSet = new Set();
    list.forEach((b) => {
      (b.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => tagsSet.add(t));
    });
    const tags = Array.from(tagsSet).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));

    populateSelect(filterAuthor, authors);
    populateSelect(filterTag, tags);
  }

  function populateSelect(selectEl, values) {
    if (!selectEl) return;
    const current = selectEl.value;
    selectEl.innerHTML = '';
    const anyOpt = document.createElement('option');
    anyOpt.value = 'any';
    anyOpt.textContent = 'Alle';
    selectEl.appendChild(anyOpt);
    values.forEach((val) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      selectEl.appendChild(opt);
    });
    if (values.includes(current)) {
      selectEl.value = current;
    } else {
      selectEl.value = 'any';
    }
  }

  function startEdit(book) {
    editingId = book.id;
    formTitle.textContent = 'Bearbeite ' + book.title;
    titleInput.value = book.title || '';
    authorInput.value = book.author || '';
    statusSelect.value = book.status || 'reading';
    ratingInput.value = book.rating != null ? book.rating : '';
    isbnInput.value = book.isbn || '';
    summaryInput.value = book.summary || '';
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
    if (view !== 'form') {
      stopIsbnScan();
    }
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
    const summaryHtml = book.summary ? `<p class="book-card__summary">${book.summary}</p>` : '';
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
          <div class="book-card__meta book-card__meta--stacked">
            <span>von ${book.author}</span>
            ${book.isbn ? `<span>ISBN ${book.isbn}</span>` : ''}
            ${book.created_at ? `<span>${new Date(book.created_at).toLocaleDateString('de-DE')}</span>` : ''}
            ${book.rating ? `<span>★ ${book.rating}</span>` : ''}
          </div>
        </div>
        ${summaryHtml}
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
