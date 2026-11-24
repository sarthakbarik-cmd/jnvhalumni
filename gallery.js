const endpoint = 'https://firestore.googleapis.com/v1/projects/studio-8216248509-d2d60/databases/(default)/documents/galleryPhotos';
const photos = document.querySelector('#gallery-photos');
const status = document.querySelector('#gallery-status');
const more = document.querySelector('#gallery-more');
const groups = new Map();
let pageToken = '';
let photoCount = 0;

function addPhoto({ fields = {} }) {
  const imageUrl = fields.imageUrl?.stringValue;
  if (!imageUrl) return;

  let url;
  try {
    url = new URL(imageUrl);
  } catch {
    return;
  }
  if (url.protocol !== 'https:' || !['firebasestorage.googleapis.com', 'storage.googleapis.com'].includes(url.hostname)) return;

  const event = fields.event?.stringValue?.trim() || 'General';
  const caption = fields.description?.stringValue?.trim();
  let grid = groups.get(event);
  if (!grid) {
    const heading = document.createElement('h3');
    heading.textContent = event;
    grid = document.createElement('div');
    grid.className = 'photo-grid';
    photos.append(heading, grid);
    groups.set(event, grid);
  }

  const figure = document.createElement('figure');
  const image = document.createElement('img');
  image.alt = caption || 'Alumni gallery photo';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('error', () => {
    const unavailable = document.createElement('p');
    unavailable.className = 'photo-unavailable';
    unavailable.textContent = 'Photo unavailable';
    image.replaceWith(unavailable);
  }, { once: true });
  image.src = url.href;
  figure.append(image);
  if (caption) {
    const label = document.createElement('figcaption');
    label.textContent = caption;
    figure.append(label);
  }
  grid.append(figure);
  photoCount += 1;
}

async function loadPhotos() {
  more.disabled = true;
  status.textContent = photoCount ? 'Loading more photos…' : 'Loading gallery photos…';
  const url = new URL(endpoint);
  url.searchParams.set('pageSize', '12');
  url.searchParams.set('orderBy', 'createdAt desc');
  for (const field of ['imageUrl', 'description', 'event']) {
    url.searchParams.append('mask.fieldPaths', field);
  }
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Gallery request failed');
    const page = await response.json();
    (page.documents ?? []).forEach(addPhoto);
    pageToken = page.nextPageToken ?? '';
    status.textContent = photoCount
      ? `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} shown.`
      : pageToken ? 'More gallery photos may be available.' : 'No gallery photos are available yet.';
    more.hidden = !pageToken;
    more.textContent = 'Load more photos';
  } catch {
    status.textContent = 'Gallery photos could not be loaded. Please try again.';
    more.hidden = false;
    more.textContent = 'Try again';
  } finally {
    more.disabled = false;
  }
}

more.addEventListener('click', loadPhotos);
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    loadPhotos();
  }, { rootMargin: '300px' });
  observer.observe(document.querySelector('#gallery'));
} else {
  loadPhotos();
}
