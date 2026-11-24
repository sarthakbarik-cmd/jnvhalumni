import { addDoc, collection, doc, getDocsFromServer, limit, orderBy, query, serverTimestamp, setDoc, startAfter, where } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const pageSize = 25;
const tools = {
  members: { label: 'Member registrations', collection: 'registrations' },
  reunion: { label: 'Reunion registrations', collection: 'contactMessages' },
  gallery: { label: 'Curated gallery', collection: 'galleryPhotos', order: 'createdAt' },
  events: { label: 'Events', collection: 'events', order: 'date' }
};

function describe(record, tool) {
  const data = record.data();
  const date = data.date?.toDate?.();
  const formattedDate = date?.toLocaleDateString('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' });
  switch (tool) {
    case 'members': return [data.name || 'Member', data.batch, data.email, data.phone, data.city];
    case 'reunion': return [data.name || 'Attendee', data.message];
    case 'gallery': return [data.description || 'Gallery photo', data.event, data.isHighlight ? 'Featured' : ''];
    case 'events': return [data.title || 'Event', formattedDate, data.description];
  }
}

export function createAdminDashboard(app, db, auth) {
  const workspace = document.querySelector('#admin-workspace');
  const title = document.querySelector('#admin-tool-title');
  const result = document.querySelector('#admin-result');
  const records = document.querySelector('#admin-records');
  const more = document.querySelector('#admin-more');
  const gallery = document.querySelector('#admin-gallery');
  const events = document.querySelector('#admin-events');
  const cards = [...document.querySelectorAll('.admin-card')];
  let user;
  let active;
  let cursor;
  let revision = 0;
  let pendingPhoto;

  function clear() {
    revision += 1;
    user = active = cursor = pendingPhoto = undefined;
    workspace.hidden = true;
    gallery.reset();
    events.reset();
    result.textContent = '';
    records.replaceChildren();
    more.hidden = true;
    for (const card of cards) card.setAttribute('aria-pressed', 'false');
  }

  function canContinue(run) {
    return revision === run && user && auth.currentUser === user;
  }

  async function load() {
    if (!active || !user || auth.currentUser !== user) return;
    const run = revision;
    const selected = active;
    const config = tools[selected];
    const constraints = [];
    if (selected === 'reunion') constraints.push(where('eventDate', '==', '2026-12-27'));
    if (config.order) constraints.push(orderBy(config.order, 'desc'));
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(pageSize));
    result.textContent = 'Loading records…';
    more.disabled = true;
    try {
      const page = await getDocsFromServer(query(collection(db, config.collection), ...constraints));
      if (!canContinue(run)) return;
      for (const record of page.docs) {
        const [name, ...details] = describe(record, selected);
        const item = document.createElement('article');
        item.className = 'admin-record';
        const heading = document.createElement('strong');
        heading.textContent = name;
        item.append(heading);
        for (const detail of details.filter(Boolean)) {
          const line = document.createElement('p');
          line.textContent = detail;
          item.append(line);
        }
        records.append(item);
      }
      cursor = page.docs.at(-1) ?? cursor;
      more.hidden = page.size < pageSize;
      result.textContent = records.childElementCount ? '' : 'No records found.';
    } catch {
      if (canContinue(run)) result.textContent = 'Could not load these records. Select the card to try again.';
    } finally {
      if (canContinue(run)) more.disabled = false;
    }
  }

  function select(tool) {
    revision += 1;
    active = tool;
    cursor = undefined;
    title.textContent = tools[tool].label;
    workspace.hidden = false;
    gallery.hidden = tool !== 'gallery';
    events.hidden = tool !== 'events';
    more.hidden = true;
    records.replaceChildren();
    for (const card of cards) card.setAttribute('aria-pressed', String(card.dataset.tool === tool));
    load();
  }

  for (const card of cards) card.addEventListener('click', () => select(card.dataset.tool));
  more.addEventListener('click', load);

  async function save(event, tool, write) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    if (!user || auth.currentUser !== user || active !== tool || button.disabled) return;
    const run = revision;
    button.disabled = true;
    result.textContent = 'Saving to Firebase…';
    try {
      await write(new FormData(form));
      if (!canContinue(run)) return;
      form.reset();
      select(tool);
    } catch (error) {
      if (canContinue(run)) result.textContent = error.message === 'invalid-input'
        ? 'Check the required fields and choose a JPEG, PNG, or WebP photo up to 5 MB when uploading.'
        : 'Could not save. Check Firebase access and try again.';
    } finally {
      button.disabled = false;
    }
  }

  gallery.addEventListener('submit', (event) => save(event, 'gallery', async (data) => {
    const originalUser = user;
    const file = data.get('photo');
    const description = data.get('caption').trim();
    const album = data.get('album').trim();
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    if (!description || !album || !extensions[file.type] || !file.size || file.size > 5 * 1024 * 1024) throw new Error('invalid-input');
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js');
    if (!originalUser || auth.currentUser !== originalUser) throw new Error('session-ended');
    if (pendingPhoto?.file !== file && !(pendingPhoto?.file.name === file.name && pendingPhoto.file.size === file.size && pendingPhoto.file.lastModified === file.lastModified)) {
      pendingPhoto = { file, record: doc(collection(db, 'galleryPhotos')) };
    }
    const draft = pendingPhoto;
    const object = ref(getStorage(app), `gallery/${draft.record.id}.${extensions[file.type]}`);
    if (!draft.imageUrl) {
      await uploadBytes(object, file, { contentType: file.type });
      draft.imageUrl = await getDownloadURL(object);
    }
    if (auth.currentUser !== originalUser) throw new Error('session-ended');
    await setDoc(draft.record, { description, event: album, isHighlight: data.has('featured'), imageUrl: draft.imageUrl, createdAt: serverTimestamp() });
    if (pendingPhoto === draft) pendingPhoto = undefined;
  }));

  events.addEventListener('submit', (event) => save(event, 'events', async (data) => {
    const title = data.get('title').trim();
    const description = data.get('description').trim();
    const date = new Date(`${data.get('date')}T00:00:00+05:30`);
    if (!title || !description || Number.isNaN(date.getTime())) throw new Error('invalid-input');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    await addDoc(collection(db, 'events'), { title, description, date, isUpcoming: data.get('date') >= today, imageUrl: '', schedule: [] });
  }));

  return { open(admin) { user = admin; }, clear };
}
