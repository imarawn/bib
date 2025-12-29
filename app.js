document.addEventListener('DOMContentLoaded', () => {
  const SUPABASE_URL = 'https://gbscowfidfdiaywktqal.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic2Nvd2ZpZGZkaWF5d2t0cWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNDU0MzUsImV4cCI6MjA3MTcyMTQzNX0.BITW_rG0-goeo8VCgl-ZTSWfa8BDYsmT2xhIg-9055g';
  const STORAGE_BUCKET = 'book-covers';

  const authForm = document.getElementById('auth-form');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const authPanel = document.querySelector('.panel--auth');
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

  if (!window.supabase) {
    showToast('Supabase SDK nicht geladen.');
    throw new Error('Supabase SDK fehlt');
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let currentUser = null;
  let editingId = null;
  let books = [];
  let toastTimer = null;

  authForm.addEventListener('submit', handleAuthSubmit);
  logoutBtn.addEventListener('click', handleLogout);
  bookForm.addEventListener('submit', handleBookSubmit);
  resetFormBtn.addEventListener('click', resetBookForm);
  filterStatus.addEventListener('change', () => {
    loadBooks();
  });

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
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      showToast('Abmelden fehlgeschlagen.');
      return;
    }
    showToast('Abgemeldet.');
  }

  function onAuthChanged(isAuthed) {
    sessionStatus.textContent = isAuthed && currentUser
      ? 'Angemeldet als ' + (currentUser.email || 'User')
      : 'Abgemeldet';
    logoutBtn.hidden = !isAuthed;
    bookPanel.hidden = !isAuthed;
    listPanel.hidden = !isAuthed;
    authPanel.hidden = isAuthed;

    if (isAuthed) {
      loadBooks();
    } else {
      editingId = null;
      books = [];
      bookList.innerHTML = '<p class="muted">Noch keine Bücher. Lege los!</p>';
      bookForm.reset();
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

      if (book.cover_url) {
        const img = document.createElement('img');
        img.src = book.cover_url;
        img.alt = 'Cover von ' + book.title;
        img.className = 'cover';
        card.appendChild(img);
      }

      const statusBadge = document.createElement('span');
      statusBadge.className = 'badge';
      statusBadge.textContent = statusLabel(book.status);
      card.appendChild(statusBadge);

      const titleEl = document.createElement('h3');
      titleEl.className = 'book-card__title';
      titleEl.textContent = book.title;
      card.appendChild(titleEl);

      const meta = document.createElement('div');
      meta.className = 'book-card__meta';
      meta.innerHTML = `
        <span>von ${book.author}</span>
        ${book.rating ? `<span>★ ${book.rating}</span>` : ''}
        ${book.created_at ? `<span>${new Date(book.created_at).toLocaleDateString('de-DE')}</span>` : ''}
      `;
      card.appendChild(meta);

      if (book.tags) {
        const tagWrap = document.createElement('div');
        tagWrap.className = 'tag-list';
        book.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .forEach((tag) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag';
            tagEl.textContent = tag;
            tagWrap.appendChild(tagEl);
          });
        card.appendChild(tagWrap);
      }

      if (book.review) {
        const review = document.createElement('p');
        review.className = 'book-card__review';
        review.textContent = book.review;
        card.appendChild(review);
      }

      const actions = document.createElement('div');
      actions.className = 'card-actions';
      const editBtn = document.createElement('button');
      editBtn.className = 'ghost-btn ghost-btn--small';
      editBtn.textContent = 'Bearbeiten';
      editBtn.addEventListener('click', function () {
        startEdit(book);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'ghost-btn ghost-btn--small';
      deleteBtn.textContent = 'Löschen';
      deleteBtn.addEventListener('click', function () {
        deleteBook(book.id);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      card.appendChild(actions);

      bookList.appendChild(card);
    });
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
