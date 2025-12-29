## Fenjas Bücher-SPA (Supabase)

SPA ohne Build-Tool: `index.html`, `styles.css`, `app.js`. Supabase übernimmt Auth, Datenbank und Storage.

- Nutzer:innen legst du direkt in Supabase an, es gibt keinen Signup-Flow im Frontend.

### Setup
- Trage in `app.js` die Werte für `SUPABASE_URL` und `SUPABASE_ANON_KEY` ein.
- Lege in Supabase die Tabelle und Policies an:
  ```sql
  create table public.books (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users (id) on delete cascade,
    title text not null,
    author text not null,
    status text default 'reading',
    rating numeric,
    tags text,
    review text,
    cover_url text,
    created_at timestamp with time zone default now()
  );

  alter table public.books enable row level security;

  -- Nur eigene Bücher sehen
  create policy "select own books" on public.books
    for select using (auth.uid() = user_id);

  -- Nur eigene Bücher bearbeiten
  create policy "modify own books" on public.books
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  ```
- Storage-Bucket `book-covers` anlegen und öffentlich machen:
  - Supabase > Storage > New Bucket: Name `book-covers`, public.
  - Optional Regel, um Uploads auf angemeldete Nutzer:innen zu beschränken:
    ```sql
    create policy "allow uploads for authenticated" on storage.objects
    for insert to public
    with check (auth.role() = 'authenticated');
    ```

### Nutzung
- Öffne `index.html` lokal oder über ein Static Hosting (Supabase, Netlify, Vercel, S3).
- Registrierung/Anmeldung per E-Mail/Passwort.
- Bücher anlegen, Status setzen, Bewertung/Rezension ergänzen, Tags hinterlegen.
- Cover-Upload landet im Storage, die öffentliche URL wird beim Buch gespeichert.
- Filter nach Status, Bearbeiten/Löschen pro Eintrag.

### Hinweise
- Alle Anfragen gehen direkt vom Browser an Supabase (kein eigener Backend-Server).
- Anon-Key ist nur für den Client gedacht; setze Policies sorgfältig, damit nur eigene Bücher sichtbar/bearbeitbar sind.
