'use strict';

const STORAGE_KEY = 'atelier.personal.v1';
// GitHub Pages edition: no server-side routes exist; external public APIs are called directly from the browser.
const GITHUB_PAGES_STATIC = true;
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
let musicResults = [];
let musicNextPageToken = '';
let musicCurrentQuery = '';
let musicActiveIndex = -1;
let musicSearchRequestId = 0;
let musicTrackRequestId = 0;
const musicSearchCache = new Map();
const musicTrackCache = new Map();
const MUSIC_SEARCH_STORAGE_KEY = 'atelier.internet-archive.search-cache.v2';
const MUSIC_SEARCH_CACHE_TTL = 6 * 60 * 60 * 1000;
// Art Institute metadata is synchronized at build time by GitHub Actions into a static JSON snapshot.
// IIIF images are loaded directly from the museum; Commons remains an explicitly attributed fallback.
let iiifBase = 'https://www.artic.edu/iiif/2';
let articSnapshotPromise = null;
let articSnapshotCache = null;
let discoverResults = [];
let discoverOffset = 0;
let discoverQuery = 'Sandro Botticelli';
let discoverSource = 'artic';
let favoritesMode = false;
let activeResourceFilter = 'all';
let activeArtistEra = 'all';
let toastTimer = null;
let spotlightIndex = 0;
let spotlightTimer = null;
const artistImageCache = new Map();
const artistImagePromises = new Map();
const artistImageChecked = new Set();
const commonsArtworkFallbackCache = new Map();

// Curated in chronological order. Each card links back to a public source.
const ARTIST_CATALOG = [
  { id:'botticelli', name:'Sandro Botticelli', fa:'ساندرو بوتیچلی', years:'1445–1510', yearsFa:'۱۴۴۵–۱۵۱۰', sortYear:1445, era:'renaissance', eraLabel:'رنسانس آغازین', query:'Sandro Botticelli The Birth of Venus painting', wiki:'https://en.wikipedia.org/wiki/Sandro_Botticelli', description:'از چهره‌های شاخص رنسانس فلورانس؛ خطوط روان، اسطوره‌های کلاسیک و ترکیب‌بندی شاعرانه در آثارش برجسته‌اند.' },
  { id:'michelangelo', name:'Michelangelo', fa:'میکل‌آنژ', years:'1475–1564', yearsFa:'۱۴۷۵–۱۵۶۴', sortYear:1475, era:'renaissance', eraLabel:'رنسانس والا', query:'Michelangelo Sistine Chapel Creation of Adam painting', wiki:'https://en.wikipedia.org/wiki/Michelangelo', description:'مجسمه‌ساز، نقاش و معمار رنسانس؛ شناخت آناتومی و پیکره‌های پرقدرت از ویژگی‌های شناخته‌شده‌ی آثار اوست.' },
  { id:'caravaggio', name:'Caravaggio', fa:'کاراواجو', years:'1571–1610', yearsFa:'۱۵۷۱–۱۶۱۰', sortYear:1571, era:'baroque', eraLabel:'باروک آغازین', query:'Caravaggio The Calling of Saint Matthew painting', wiki:'https://en.wikipedia.org/wiki/Caravaggio', description:'نقاش باروک که با نورپردازی نمایشی، کنتراست شدید و شخصیت‌های واقع‌گرا شناخته می‌شود.' },
  { id:'artemisia', name:'Artemisia Gentileschi', fa:'آرتمیزیا جنتیلسکی', years:'1593–c. 1656', yearsFa:'۱۵۹۳–حدود ۱۶۵۶', sortYear:1593, era:'baroque', eraLabel:'باروک', query:'Artemisia Gentileschi Judith Holofernes painting', wiki:'https://en.wikipedia.org/wiki/Artemisia_Gentileschi', description:'نقاش برجسته‌ی باروک؛ روایت‌های پرتنش، ژست‌های نیرومند و شخصیت‌های زن در بسیاری از آثارش مرکز توجه‌اند.' },
  { id:'sarah-goodridge', name:'Sarah Goodridge', fa:'سارا گودریج', years:'1788–1853', yearsFa:'۱۷۸۸–۱۸۵۳', sortYear:1788, era:'nineteenth', eraLabel:'آمریکا · سده‌ی ۱۹', query:'Sarah Goodridge Beauty Revealed miniature portrait', wiki:'https://en.wikipedia.org/wiki/Sarah_Goodridge', description:'نقاش آمریکاییِ مینیاتور پرتره؛ آثار کوچک و دقیق او نمونه‌ای از هنر پرتره‌نگاری اوایل قرن نوزدهم‌اند.' },
  { id:'anna-lea-merritt', name:'Anna Lea Merritt', fa:'آنا لی مریت', years:'1844–1930', yearsFa:'۱۸۴۴–۱۹۳۰', sortYear:1844, era:'nineteenth', eraLabel:'سده‌ی ۱۹', query:'Anna Lea Merritt Love Locked Out painting', wiki:'https://en.wikipedia.org/wiki/Anna_Lea_Merritt', description:'نقاش آمریکایی‌ـ‌بریتانیایی که با نقاشی‌های روایی و پرتره‌هایش در فضای هنری اواخر قرن نوزدهم شناخته می‌شود.' },
  { id:'modigliani', name:'Amedeo Modigliani', fa:'آمادئو مودیلیانی', years:'1884–1920', yearsFa:'۱۸۸۴–۱۹۲۰', sortYear:1884, era:'modern', eraLabel:'مدرنیسم', query:'Amedeo Modigliani portrait painting', wiki:'https://en.wikipedia.org/wiki/Amedeo_Modigliani', description:'هنرمند مدرنیست ایتالیایی؛ پرتره‌ها و پیکره‌های کشیده‌اش با خطوط ساده و چهره‌های بسیار متمایز شناخته می‌شوند.' },
  { id:'jesus-helguera', name:'Jesús Helguera', fa:'ژِسوس هلگوئرا', years:'1910–1971', yearsFa:'۱۹۱۰–۱۹۷۱', sortYear:1910, era:'modern', eraLabel:'هنر مکزیک در سده‌ی ۲۰', query:'Jesus Helguera La Leyenda de los Volcanes painting', wiki:'https://en.wikipedia.org/wiki/Jes%C3%BAs_Helguera', description:'نقاش و تصویرگر مکزیکی؛ آثارش اغلب از تاریخ، افسانه‌ها و هویت تصویری مکزیک الهام می‌گیرند.' }
];

const defaultState = () => ({ artworks: [], ideas: [], resources: [], sessions: [], favorites: [] });
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return defaultState();
    return {
      artworks: Array.isArray(saved.artworks) ? saved.artworks : [],
      ideas: Array.isArray(saved.ideas) ? saved.ideas : [],
      resources: Array.isArray(saved.resources) ? saved.resources : [],
      sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
      favorites: Array.isArray(saved.favorites) ? saved.favorites : []
    };
  } catch (error) {
    console.warn('Could not read Atelier data:', error);
    return defaultState();
  }
}
let state = loadState();

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const faNum = value => Number(value || 0).toLocaleString('fa-IR');
const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function formatDate(value, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!value) return '—';
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return escapeHTML(value);
  return new Intl.DateTimeFormat('fa-IR', options).format(d);
}
function toLocalDay(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function safeHttpUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
function persistState(showMessage = false) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (showMessage) showToast('تغییرات در همین مرورگر ذخیره شد.');
    return true;
  } catch (error) {
    console.error('Could not save Atelier data:', error);
    showToast('فضای ذخیره‌سازی مرورگر پر شده است. تصویر کوچک‌تری انتخاب کن یا نسخه‌ی پشتیبان بگیر.');
    return false;
  }
}
function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
function openPage(name, options = {}) {
  const page = $(`[data-page-content="${name}"]`);
  if (!page) return;
  $$('.page').forEach(node => node.classList.toggle('active', node === page));
  $$('[data-page]').forEach(node => node.classList.toggle('active', node.dataset.page === name));
  const labels = { home: 'Home', timeline: 'Timeline', history: 'History', artists: 'Artists', discover: 'Artworks', music: 'Listen', facts: 'Facts', studio: 'My Atelier', library: 'Study Shelf', progress: 'My Progress' };
  if ($('#page-crumb')) $('#page-crumb').textContent = labels[name] || 'Atelier';
  const sidebar = $('#sidebar'); if (sidebar) sidebar.classList.remove('open');
  const personalMenu = $('.personal-menu'); if (personalMenu) personalMenu.open = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'studio') renderStudio();
  if (name === 'library') renderLibrary();
  if (name === 'progress') renderProgress();
  if (name === 'home') renderHome();
  if (name === 'discover' && discoverResults.length === 0 && options.loadDiscover !== false) searchArtworks(discoverQuery);
  if (name === 'artists') { renderArtistDirectory(); hydrateArtistImages(); }
}
function updateHeader() {
  $('#today-label').textContent = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  $('#nav-art-count').textContent = faNum(state.artworks.length);
  $('#nav-resource-count').textContent = faNum(state.resources.length);
}
function updateStats() {
  const minutes = state.sessions.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
  $('#stat-artworks').textContent = faNum(state.artworks.length);
  $('#stat-ideas').textContent = faNum(state.ideas.length);
  $('#stat-resources').textContent = faNum(state.resources.length);
  $('#stat-minutes').textContent = faNum(minutes);
  $('#works-tab-count').textContent = faNum(state.artworks.length);
  $('#ideas-tab-count').textContent = faNum(state.ideas.length);
  $('#favorite-count').textContent = faNum(state.favorites.length);
}

const prompts = [
  { title: 'پیش از کشیدن، خوب نگاه کن.', copy: 'یک شیء ساده انتخاب کن. دو دقیقه فقط به شکل کلی، نور و سایه‌اش نگاه کن؛ بعد بدون پاک‌کن طرح اولیه را بکش.' },
  { title: 'امروز فقط با سه تُن کار کن.', copy: 'یک سوژه‌ی ساده انتخاب کن و آن را با روشن، میانه و تیره بساز. فعلاً رنگ و جزئیات را کنار بگذار.' },
  { title: 'یک اثر را از نو ببین.', copy: 'به یکی از آثار گنجینه سر بزن. سه چیز بنویس: چشم اول کجا می‌رود، نور از کجاست و هنرمند چه چیزی را حذف کرده؟' },
  { title: 'خطوط را دنبال کن.', copy: 'در اطرافت یک ترکیب پیدا کن و فقط خطوط اصلی آن را بکش. از سایه‌زنی و جزئیات صرف‌نظر کن.' },
  { title: 'یک رنگ، چند حس.', copy: 'یک رنگ انتخاب کن و با تغییر تیرگی و روشنی آن، سه حال‌وهوای متفاوت در یک صفحه بساز.' },
  { title: 'از حافظه طراحی کن.', copy: 'یک شیء آشنا را یک دقیقه نگاه کن، کنار بگذار و از حافظه بکش. بعد تفاوت‌های تصویر ذهنی و واقعیت را یادداشت کن.' },
  { title: 'اثر را به پرسش تبدیل کن.', copy: 'یک نقاشی تاریخی انتخاب کن و به‌جای خواندن توضیحات، سه سؤال درباره‌ی آن بساز. سپس دنبال پاسخ بگرد.' }
];
function todaysPrompt() {
  const d = new Date();
  const dayIndex = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000) % prompts.length;
  return { ...prompts[(dayIndex + prompts.length) % prompts.length], number: (dayIndex + 1).toString().padStart(2, '0') };
}
function renderHome() {
  updateStats();
  updateHeader();
  const prompt = todaysPrompt();
  $('#prompt-number').textContent = faNum(prompt.number);
  $('#prompt-title').textContent = prompt.title;
  $('#prompt-copy').textContent = prompt.copy;

  const recentWorks = [...state.artworks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 3);
  $('#recent-works').innerHTML = recentWorks.length ? recentWorks.map(work => `
    <div class="recent-row">
      ${work.imageData ? `<img class="recent-thumb" src="${escapeHTML(work.imageData)}" alt="" loading="lazy">` : `<div class="recent-thumb empty-thumb">✳</div>`}
      <button class="recent-details text-button" data-own-open="${escapeHTML(work.id)}" type="button"><strong>${escapeHTML(work.title)}</strong><span>${escapeHTML(work.medium || 'بدون تکنیک ثبت‌شده')}</span></button>
      <span class="recent-date">${formatDate(work.date || work.createdAt)}</span>
    </div>`).join('') : '<div class="empty-inline">هنوز اثری ثبت نکرده‌ای. اولین طرح تو می‌تواند همین‌جا باشد.</div>';

  const recentResources = [...state.resources].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 3);
  $('#home-resources').innerHTML = recentResources.length ? recentResources.map(resource => `
    <div class="home-resource-row"><span class="resource-kind-icon">${resourceIcon(resource.type)}</span><div class="home-resource-copy"><strong>${escapeHTML(resource.title)}</strong><span><i class="status-dot ${resource.status === 'done' ? 'done' : resource.status === 'progress' ? 'progress' : ''}"></i>${resourceStatusLabel(resource.status)} · ${resourceTypeLabel(resource.type)}</span></div><button class="mini-action" data-resource-open="${escapeHTML(resource.id)}" type="button">دیدن</button></div>`).join('') : '<div class="empty-inline">پادکست‌ها، مستندها و مقاله‌هایی را که می‌خواهی ببینی اینجا نگه دار.</div>';
}

function directIiifUrl(art, size = '843,') {
  if (!art || !art.image_id) return '';
  return `${iiifBase}/${encodeURIComponent(art.image_id)}/full/${size}/0/default.jpg`;
}
function proxiedIiifUrl(imageId, size = '843,') {
  // GitHub Pages cannot run /api/iiif. Image tags can load the IIIF image URL directly.
  if (!imageId || !['200,', '400,', '600,', '843,', '1686,'].includes(size)) return '';
  return `${iiifBase}/${encodeURIComponent(imageId)}/full/${size}/0/default.jpg`;
}
function directIiifFromUrl(value) {
  const match = String(value || '').match(/\/iiif\/2\/([a-f0-9-]{12,64})\/full\/(200,|400,|600,|843,|1686,)\/0\/default\.jpg/i);
  return match ? `${iiifBase}/${encodeURIComponent(match[1])}/full/${match[2]}/0/default.jpg` : '';
}
function iiifUrl(art, size = '843,') {
  if (!art || !art.image_id) return '';
  // GitHub Pages has no same-origin image proxy; use the official IIIF image URL directly.
  return directIiifUrl(art, size);
}
// Image requests may fail even when museum metadata loads: the IIIF host is a separate service.
// Try the official direct IIIF URL, then an explicitly attributed Wikimedia Commons image search.
function addImageFailurePlaceholder(img) {
  img.onerror = null;
  img.style.display = 'none';
  const container = img.closest('.art-card-image') || img.parentElement;
  if (container) {
    container.classList.add('image-failed');
    if (!container.querySelector('.image-placeholder')) {
      const placeholder = document.createElement('span');
      placeholder.className = 'image-placeholder';
      placeholder.textContent = 'تصویر در دسترس نیست';
      container.appendChild(placeholder);
    }
  }
}
function setCommonsImageAttribution(img, fallback) {
  const card = img.closest('.art-card');
  if (!card) return;
  const sourceLabel = card.querySelector('.art-card-meta span:first-child');
  if (sourceLabel) sourceLabel.textContent = 'اطلاعات موزه · تصویر از Commons';
  let note = card.querySelector('.image-fallback-attribution');
  if (!note) {
    note = document.createElement('p');
    note.className = 'image-fallback-attribution';
    const body = card.querySelector('.art-card-body');
    const actions = body?.querySelector('.card-actions');
    if (body) body.insertBefore(note, actions || null);
  }
  note.replaceChildren();
  const label = document.createElement('span');
  label.textContent = `تصویر جایگزین از Wikimedia Commons${fallback.license ? ` · مجوز: ${fallback.license}` : ' · مجوز را در منبع بررسی کن'} `;
  note.appendChild(label);
  const link = document.createElement('a');
  link.href = fallback.sourceUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'منبع تصویر ↗';
  note.appendChild(link);
}
async function findCommonsArtworkFallback(title, artist) {
  const queries = [`"${title}" ${artist} painting`, `"${title}" painting`, `${title} ${artist}`];
  for (const query of queries) {
    const key = query.toLocaleLowerCase();
    try {
      let promise = commonsArtworkFallbackCache.get(key);
      if (!promise) {
        promise = searchCommonsImages(query, 8);
        commonsArtworkFallbackCache.set(key, promise);
      }
      const items = await promise;
      if (items.length) return items[0];
    } catch (error) {
      console.warn('Commons artwork image fallback failed for query:', query, error);
    }
  }
  return null;
}
async function atelierHandleImageError(img) {
  if (!img) return;
  const stage = img.dataset.imageFallbackStage || (img.dataset.directSrc ? 'proxy' : 'commons');
  const directSrc = img.dataset.directSrc || '';
  if (stage === 'proxy' && directSrc && img.src !== directSrc) {
    img.dataset.imageFallbackStage = 'direct';
    img.src = directSrc;
    return;
  }
  if (stage === 'commons') {
    addImageFailurePlaceholder(img);
    return;
  }
  if (stage !== 'commons-search') {
    img.dataset.imageFallbackStage = 'commons-search';
    const card = img.closest('.art-card');
    const title = img.dataset.artTitle || img.alt || card?.querySelector('h3')?.textContent || '';
    const artist = img.dataset.artArtist || card?.querySelector('.artist')?.textContent || '';
    const fallback = await findCommonsArtworkFallback(title, artist);
    if (fallback?.imageUrl && fallback.sourceUrl) {
      const id = img.dataset.artId;
      const artwork = discoverResults.find(item => String(item.id) === String(id)) || state.favorites.find(item => String(item.id) === String(id));
      const savedFallback = {
        imageUrl: fallback.imageUrl,
        sourceUrl: fallback.sourceUrl,
        title: fallback.title,
        license: fallback.license || '',
        credit: fallback.credit || ''
      };
      if (artwork) {
        artwork.imageFallback = savedFallback;
        if (state.favorites.includes(artwork)) persistState();
      }
      img.dataset.imageFallbackStage = 'commons';
      img.dataset.directSrc = '';
      img.src = fallback.imageUrl;
      setCommonsImageAttribution(img, fallback);
      return;
    }
  }
  addImageFailurePlaceholder(img);
}
window.atelierHandleImageError = atelierHandleImageError;
function artCard(art, mode = 'discover') {
  const fav = state.favorites.some(item => String(item.id) === String(art.id));
  let imageUrl;
  if (art.imageData) imageUrl = art.imageData;
  else if (art.imageFallback?.imageUrl) imageUrl = art.imageFallback.imageUrl;
  else if (art.sourceType === 'commons') imageUrl = art.imageUrl || '';
  else if (art.image_id) imageUrl = iiifUrl(art, '843,');
  else imageUrl = proxiedIiifUrl((directIiifFromUrl(art.imageUrl).match(/\/iiif\/2\/([^/]+)/) || [])[1]) || art.imageUrl || '';
  const directImageUrl = art.sourceType === 'commons' ? '' : (art.image_id ? directIiifUrl(art, '843,') : directIiifFromUrl(art.imageUrl));
  const title = art.title || 'اثر بدون عنوان';
  const artist = art.artist || art.artist_title || art.artist_display || 'هنرمند نامشخص';
  const date = art.date || art.date_display || '';
  if (mode === 'own') {
    return `<article class="art-card" data-artwork-card="${escapeHTML(art.id)}">
      <button class="art-card-image" data-own-open="${escapeHTML(art.id)}" type="button" aria-label="دیدن ${escapeHTML(title)}">
        ${imageUrl ? `<img class="own-card-preview" src="${escapeHTML(imageUrl)}" alt="${escapeHTML(title)}" loading="lazy">` : `<div class="own-card-no-image"><strong>✳</strong><span>یادداشتی در دفتر</span></div>`}
      </button>
      <div class="art-card-body"><div class="art-card-meta"><span>دفتر شخصی</span><span>${formatDate(art.date || art.createdAt, { year: 'numeric', month: 'short' })}</span></div><h3>${escapeHTML(title)}</h3><p class="artist">${escapeHTML(art.medium || 'تکنیک ثبت نشده')}</p><div class="card-actions"><button class="mini-action" data-own-open="${escapeHTML(art.id)}" type="button">جزئیات</button><button class="mini-action card-delete" data-delete-art="${escapeHTML(art.id)}" type="button">حذف</button></div></div>
    </article>`;
  }
  return `<article class="art-card">
    <button class="art-card-image" data-discover-open="${escapeHTML(art.id)}" type="button" aria-label="جزئیات ${escapeHTML(title)}">
      ${imageUrl ? `<img src="${escapeHTML(imageUrl)}" data-art-id="${escapeHTML(art.id)}" data-art-title="${escapeHTML(title)}" data-art-artist="${escapeHTML(artist)}" data-image-fallback-stage="${art.imageFallback || art.sourceType === 'commons' ? 'commons' : (directImageUrl ? 'proxy' : 'commons')}" ${directImageUrl ? `data-direct-src="${escapeHTML(directImageUrl)}"` : ''} alt="${escapeHTML(title)}" loading="lazy" onerror="atelierHandleImageError(this)">` : `<span class="image-placeholder">✳</span>`}
    </button>
    <div class="art-card-body"><div class="art-card-meta"><span>${art.imageFallback ? 'اطلاعات موزه · تصویر از Commons' : (art.sourceType === 'commons' ? 'Wikimedia Commons' : 'Art Institute of Chicago')}</span><span>${art.sourceType === 'commons' ? 'تصویر آرشیوی' : `شناسه ${escapeHTML(art.id)}`}</span></div><h3 title="${escapeHTML(title)}">${escapeHTML(title)}</h3><p class="artist" title="${escapeHTML(artist)}">${escapeHTML(artist)}</p><span class="work-date">${escapeHTML(date || (art.sourceType === 'commons' ? 'اطلاعات تاریخ در صفحه‌ی منبع' : 'تاریخ نامشخص'))}</span>${art.imageFallback ? `<p class="image-fallback-attribution">تصویر جایگزین از Wikimedia Commons · ${escapeHTML(art.imageFallback.license || 'مجوز را در منبع بررسی کن')} · <a href="${escapeHTML(art.imageFallback.sourceUrl)}" target="_blank" rel="noopener noreferrer">منبع تصویر ↗</a></p>` : (art.sourceType === 'commons' && art.license ? `<span class="art-license">مجوز: ${escapeHTML(art.license)}</span>` : '')}<div class="card-actions"><button class="mini-action ${fav ? 'favorite' : ''}" data-toggle-favorite="${escapeHTML(art.id)}" type="button">${fav ? '♥ ذخیره‌شده' : '♡ ذخیره در گنجینه'}</button><button class="mini-action" data-discover-open="${escapeHTML(art.id)}" type="button">جزئیات</button></div></div>
  </article>`;
}
function renderStudio() {
  updateStats();
  const filter = ($('#my-art-search')?.value || '').trim().toLocaleLowerCase('fa');
  const works = [...state.artworks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).filter(work => !filter || `${work.title} ${work.medium || ''} ${work.notes || ''}`.toLocaleLowerCase('fa').includes(filter));
  $('#my-art-grid').innerHTML = works.length ? works.map(work => artCard(work, 'own')).join('') : emptyState('✳', filter ? 'چیزی پیدا نشد' : 'دفترت هنوز سفید است', filter ? 'عبارت دیگری جست‌وجو کن.' : 'اولین اثر یا طرح خودت را اینجا ثبت کن.', filter ? '' : '<button class="button button-primary" data-open-modal="artwork" type="button">＋ ثبت اولین اثر</button>');
  const ideas = [...state.ideas].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  $('#ideas-list').innerHTML = ideas.length ? ideas.map(idea => `
    <article class="idea-card ${idea.done ? 'is-done' : ''}"><div class="idea-top"><span>${formatDate(idea.createdAt)}</span><span class="tag-chip">${idea.done ? 'به پایان رسیده' : 'ایده‌ی در انتظار'}</span></div><h3>${escapeHTML(idea.title)}</h3><p>${escapeHTML(idea.notes || 'برای این ایده هنوز توضیحی ننوشته‌ای.')}</p>${idea.tags ? `<div><span class="tag-chip">${escapeHTML(idea.tags)}</span></div>` : ''}<div class="idea-actions"><button class="mini-action" data-toggle-idea="${escapeHTML(idea.id)}" type="button">${idea.done ? 'بازگرداندن به فهرست' : 'علامت‌گذاری به‌عنوان انجام‌شده'}</button><button class="mini-action card-delete" data-delete-idea="${escapeHTML(idea.id)}" type="button">حذف</button></div></article>`).join('') : emptyState('✎', 'هنوز ایده‌ای اینجا نیست', 'هر فکر کوچک می‌تواند شروع یک کار تازه باشد.', '<button class="button button-outline" data-open-modal="idea" type="button">＋ ثبت ایده</button>');
}
function emptyState(symbol, title, copy, action = '') {
  return `<div class="empty-state"><div class="empty-symbol">${symbol}</div><h3>${title}</h3><p>${copy}</p>${action}</div>`;
}
function resourceTypeLabel(type) { return ({ podcast: 'پادکست', documentary: 'مستند', article: 'مقاله و سایت', other: 'سایر' })[type] || 'سایر'; }
function resourceIcon(type) { return ({ podcast: '♫', documentary: '▣', article: '▤', other: '✧' })[type] || '✧'; }
function resourceStatusLabel(status) { return ({ todo: 'برای بعد', progress: 'در حال دنبال‌کردن', done: 'تمام‌شده' })[status] || 'برای بعد'; }
function renderLibrary() {
  updateStats();
  const query = ($('#resource-search')?.value || '').toLocaleLowerCase('fa').trim();
  const filtered = [...state.resources].sort((a, b) => {
    const order = { progress: 0, todo: 1, done: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1) || (b.createdAt || '').localeCompare(a.createdAt || '');
  }).filter(r => (activeResourceFilter === 'all' || r.type === activeResourceFilter) && (!query || `${r.title} ${r.creator || ''} ${r.notes || ''}`.toLocaleLowerCase('fa').includes(query)));
  const done = state.resources.filter(r => r.status === 'done').length;
  const inProgress = state.resources.filter(r => r.status === 'progress').length;
  $('#library-summary').innerHTML = `<span><strong>${faNum(state.resources.length)}</strong> مورد در قفسه</span><span><strong>${faNum(inProgress)}</strong> در حال دنبال‌کردن</span><span><strong>${faNum(done)}</strong> تمام‌شده</span>`;
  $('#resource-list').innerHTML = filtered.length ? filtered.map(resource => {
    const url = safeHttpUrl(resource.url);
    return `<article class="resource-card"><div class="resource-type-icon">${resourceIcon(resource.type)}</div><div class="resource-info"><h3>${escapeHTML(resource.title)}</h3><div class="resource-subtitle">${escapeHTML(resource.creator || 'سازنده ثبت نشده')} · ${resourceTypeLabel(resource.type)} · افزوده‌شده در ${formatDate(resource.createdAt)}</div>${resource.notes ? `<p class="resource-note">${escapeHTML(resource.notes)}</p>` : ''}<span class="resource-status ${resource.status === 'done' ? 'done' : resource.status === 'progress' ? 'progress' : ''}"><i class="status-dot ${resource.status === 'done' ? 'done' : resource.status === 'progress' ? 'progress' : ''}"></i>${resourceStatusLabel(resource.status)}</span></div><div class="resource-actions">${url ? `<a class="resource-open" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">باز کردن منبع ↗</a>` : ''}<button class="mini-action" data-resource-status="${escapeHTML(resource.id)}" type="button">تغییر وضعیت</button><button class="mini-action card-delete" data-delete-resource="${escapeHTML(resource.id)}" type="button">حذف</button></div></article>`;
  }).join('') : emptyState('▤', query || activeResourceFilter !== 'all' ? 'موردی پیدا نشد' : 'قفسه‌ات منتظر اولین منبع است', query || activeResourceFilter !== 'all' ? 'فیلتر یا عبارت جست‌وجو را تغییر بده.' : 'لینک یک پادکست، مستند یا مقاله را ذخیره کن.', query || activeResourceFilter !== 'all' ? '' : '<button class="button button-primary" data-open-modal="resource" type="button">＋ افزودن منبع</button>');
}
function renderProgress() {
  const totalMinutes = state.sessions.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const recentCutoff = new Date(); recentCutoff.setDate(recentCutoff.getDate() - 6); recentCutoff.setHours(0, 0, 0, 0);
  const recent = state.sessions.filter(s => new Date(`${s.date}T12:00:00`) >= recentCutoff);
  const recentMinutes = recent.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  $('#progress-overview').innerHTML = `<div class="progress-stat"><span>کل زمان تمرین</span><strong>${faNum(totalMinutes)} <small>دقیقه</small></strong><small>از تمام جلسه‌های ثبت‌شده</small></div><div class="progress-stat"><span>جلسه‌های ثبت‌شده</span><strong>${faNum(state.sessions.length)}</strong><small>هر ثبت، بخشی از مسیر است</small></div><div class="progress-stat"><span>تمرین در هفت روز اخیر</span><strong>${faNum(recentMinutes)} <small>دقیقه</small></strong><small>${faNum(recent.length)} جلسه در این بازه</small></div>`;
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = toLocalDay(d); const value = state.sessions.filter(s => s.date === key).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0); days.push({ key, day: new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(d), value, today: key === todayISO() }); }
  const max = Math.max(30, ...days.map(d => d.value));
  $('#weekly-chart').innerHTML = days.map(d => `<div class="chart-day"><span class="chart-value">${d.value ? faNum(d.value) : '–'}</span><div class="chart-bar-wrap"><div class="chart-bar ${d.today ? 'today' : ''}" style="height:${Math.max(d.value ? 5 : 2, d.value / max * 100)}%" title="${faNum(d.value)} دقیقه"></div></div><span class="chart-label">${escapeHTML(d.day)}</span></div>`).join('');
  const sessions = [...state.sessions].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8);
  $('#session-list').innerHTML = sessions.length ? sessions.map(s => {
    const d = new Date(`${s.date}T12:00:00`);
    return `<div class="session-row"><div class="session-datebox"><strong>${new Intl.DateTimeFormat('fa-IR', { day: 'numeric' }).format(d)}</strong><span>${new Intl.DateTimeFormat('fa-IR', { month: 'short' }).format(d)}</span></div><div class="session-info"><strong>${escapeHTML(s.focus || 'جلسه‌ی تمرین')}</strong><p>${escapeHTML(s.notes || 'بدون یادداشت')}</p></div><div class="session-minutes">${faNum(s.minutes)} دقیقه <button class="mini-action card-delete" data-delete-session="${escapeHTML(s.id)}" type="button" aria-label="حذف جلسه">×</button></div></div>`;
  }).join('') : emptyState('◷', 'هنوز جلسه‌ای ثبت نشده', 'حتی ده دقیقه تمرین هم ارزش ثبت‌کردن دارد.', '<button class="button button-outline" data-open-modal="session" type="button">＋ ثبت جلسه‌ی اول</button>');
}

function openModal(kind, recordId = null) {
  const dialog = $('#app-modal');
  const body = $('#modal-body');
  const title = $('#modal-title');
  const eyebrow = $('#modal-eyebrow');
  let html = '';
  if (kind === 'artwork') {
    title.textContent = 'ثبت اثر در آتلیه'; eyebrow.textContent = 'گالری خصوصی تو';
    html = `<form class="modal-form" id="artwork-form"><div class="form-grid">
      <div class="field full"><label for="art-title">عنوان اثر *</label><input id="art-title" name="title" required maxlength="140" placeholder="مثلاً مطالعه‌ی دست‌ها، طرح شماره‌ی ۲"></div>
      <div class="field"><label for="art-date">تاریخ اثر</label><input id="art-date" name="date" type="date" value="${todayISO()}"></div>
      <div class="field"><label for="art-medium">تکنیک یا ابزار</label><input id="art-medium" name="medium" maxlength="100" placeholder="مداد، آبرنگ، زغال..."></div>
      <div class="field full"><label for="art-image-url">پیوند تصویر (اختیاری)</label><input id="art-image-url" name="imageUrl" type="url" placeholder="https://..."><span class="field-hint">یا به‌جای لینک، یک تصویر از دستگاه انتخاب کن.</span></div>
      <div class="field full"><label for="art-file" class="file-upload"><span style="font-size:22px">＋</span><span><strong>انتخاب تصویر از دستگاه</strong><span id="art-file-name">تصویر برای نگهداری در دفتر محلی فشرده می‌شود.</span></span><input id="art-file" name="image" type="file" accept="image/*"></label></div>
      <div class="field full"><label for="art-notes">یادداشت تو</label><textarea id="art-notes" name="notes" maxlength="5000" placeholder="چه چیزی خوب پیش رفت؟ دفعه‌ی بعد چه چیزی را امتحان می‌کنی؟"></textarea></div>
    </div><div class="form-actions"><button class="button button-primary" type="submit">ذخیره در آتلیه</button><button class="button button-outline" type="button" data-close-modal>انصراف</button></div></form>`;
  } else if (kind === 'idea') {
    title.textContent = 'نگه‌داشتن یک ایده'; eyebrow.textContent = 'دفتر ایده‌ها';
    html = `<form class="modal-form" id="idea-form"><div class="form-grid"><div class="field full"><label for="idea-title">عنوان ایده *</label><input id="idea-title" name="title" required maxlength="140" placeholder="مثلاً پرتره با نور پنجره"></div><div class="field full"><label for="idea-notes">توضیحات</label><textarea id="idea-notes" name="notes" maxlength="5000" placeholder="رنگ‌ها، ترکیب‌بندی یا چیزی که می‌خواهی امتحان کنی..."></textarea></div><div class="field full"><label for="idea-tags">برچسب‌ها (اختیاری)</label><input id="idea-tags" name="tags" maxlength="100" placeholder="پرتره، نور، تمرین"></div></div><div class="form-actions"><button class="button button-primary" type="submit">ثبت ایده</button><button class="button button-outline" type="button" data-close-modal>انصراف</button></div></form>`;
  } else if (kind === 'resource') {
    title.textContent = 'افزودن به قفسه'; eyebrow.textContent = 'تماشا، شنیدن و خواندن';
    html = `<form class="modal-form" id="resource-form"><div class="form-grid"><div class="field full"><label for="resource-title">عنوان منبع *</label><input id="resource-title" name="title" required maxlength="180" placeholder="نام پادکست، مستند یا مقاله"></div><div class="field"><label for="resource-type">نوع منبع</label><select id="resource-type" name="type"><option value="podcast">پادکست</option><option value="documentary">مستند</option><option value="article">مقاله و سایت</option><option value="other">سایر</option></select></div><div class="field"><label for="resource-creator">سازنده / گوینده</label><input id="resource-creator" name="creator" maxlength="120" placeholder="نام کانال یا سازنده"></div><div class="field full"><label for="resource-url">پیوند منبع (اختیاری)</label><input id="resource-url" name="url" type="url" placeholder="https://..."></div><div class="field"><label for="resource-status">وضعیت</label><select id="resource-status" name="status"><option value="todo">برای بعد</option><option value="progress">در حال دنبال‌کردن</option><option value="done">تمام‌شده</option></select></div><div class="field"><label for="resource-notes">یادداشت کوتاه</label><input id="resource-notes" name="notes" maxlength="500" placeholder="چرا می‌خواهی سراغش بروی؟"></div></div><div class="form-actions"><button class="button button-primary" type="submit">افزودن به قفسه</button><button class="button button-outline" type="button" data-close-modal>انصراف</button></div></form>`;
  } else if (kind === 'session') {
    const prompt = todaysPrompt();
    title.textContent = 'ثبت جلسه‌ی تمرین'; eyebrow.textContent = 'هر دقیقه حساب می‌شود';
    html = `<form class="modal-form" id="session-form"><div class="form-grid"><div class="field"><label for="session-date">تاریخ *</label><input id="session-date" name="date" type="date" value="${todayISO()}" required></div><div class="field"><label for="session-minutes">مدت (دقیقه) *</label><input id="session-minutes" name="minutes" type="number" min="1" max="1440" step="1" required placeholder="مثلاً ۳۰"></div><div class="field full"><label for="session-focus">موضوع جلسه</label><input id="session-focus" name="focus" maxlength="140" value="${escapeHTML(prompt.title)}" placeholder="مثلاً تمرین سایه‌روشن"></div><div class="field full"><label for="session-notes">یادداشت</label><textarea id="session-notes" name="notes" maxlength="2000" placeholder="روی چه چیزی کار کردی؟"></textarea></div></div><div class="form-actions"><button class="button button-primary" type="submit">ثبت جلسه</button><button class="button button-outline" type="button" data-close-modal>انصراف</button></div></form>`;
  } else if (kind === 'own-detail') {
    const art = state.artworks.find(item => item.id === recordId);
    if (!art) return;
    title.textContent = art.title; eyebrow.textContent = 'از گالری خصوصی تو';
    html = `${art.imageData ? `<img class="detail-modal-art" src="${escapeHTML(art.imageData)}" alt="${escapeHTML(art.title)}">` : art.imageUrl && safeHttpUrl(art.imageUrl) ? `<img class="detail-modal-art" src="${escapeHTML(safeHttpUrl(art.imageUrl))}" alt="${escapeHTML(art.title)}">` : ''}<div class="detail-meta">${formatDate(art.date || art.createdAt)}${art.medium ? ` · ${escapeHTML(art.medium)}` : ''}</div><div class="detail-copy">${escapeHTML(art.notes || 'هنوز یادداشتی برای این اثر ثبت نکرده‌ای.')}</div><div class="detail-actions"><button class="button button-danger-quiet" data-delete-art="${escapeHTML(art.id)}" type="button">حذف اثر</button><button class="button button-outline" data-close-modal type="button">بستن</button></div>`;
  } else if (kind === 'discover-detail') {
    const art = recordId && (discoverResults.find(item => String(item.id) === String(recordId)) || state.favorites.find(item => String(item.id) === String(recordId)));
    if (!art) return;
    const image = art.imageFallback?.imageUrl || (art.sourceType === 'commons' ? (art.imageUrl || '') : (art.image_id ? iiifUrl(art, '843,') : (directIiifFromUrl(art.imageUrl) ? proxiedIiifUrl((directIiifFromUrl(art.imageUrl).match(/\/iiif\/2\/([^/]+)/) || [])[1]) : (art.imageUrl || ''))));
    const directImage = art.sourceType === 'commons' ? '' : (art.image_id ? directIiifUrl(art, '843,') : directIiifFromUrl(art.imageUrl));
    const fav = state.favorites.some(item => String(item.id) === String(art.id));
    const artTitle = art.title || 'اثر بدون عنوان';
    const artist = art.artist || art.artist_title || art.artist_display || 'هنرمند نامشخص';
    const source = safeHttpUrl(art.sourceUrl || art.web_url);
    title.textContent = artTitle; eyebrow.textContent = art.sourceType === 'commons' ? 'تصویر از Wikimedia Commons' : 'از مجموعه‌ی مؤسسه‌ی هنر شیکاگو';
    html = `${image ? `<img class="detail-modal-art" src="${escapeHTML(image)}" data-art-id="${escapeHTML(art.id)}" data-art-title="${escapeHTML(artTitle)}" data-art-artist="${escapeHTML(artist)}" data-image-fallback-stage="${art.imageFallback || art.sourceType === 'commons' ? 'commons' : (directImage ? 'proxy' : 'commons')}" ${directImage ? `data-direct-src="${escapeHTML(directImage)}"` : ''} alt="${escapeHTML(artTitle)}" onerror="atelierHandleImageError(this)">` : ''}<div class="detail-meta">${escapeHTML(artist)}${art.date || art.date_display ? ` · ${escapeHTML(art.date || art.date_display)}` : ''}</div>${(art.medium_display || art.place_of_origin) ? `<p class="detail-meta">${escapeHTML([art.medium_display, art.place_of_origin].filter(Boolean).join(' · '))}</p>` : ''}${art.imageFallback ? `<p class="detail-attribution">تصویر جایگزین از Wikimedia Commons · ${escapeHTML(art.imageFallback.credit || '')}${art.imageFallback.license ? ` · مجوز: ${escapeHTML(art.imageFallback.license)}` : ''} · <a href="${escapeHTML(art.imageFallback.sourceUrl)}" target="_blank" rel="noopener noreferrer">منبع تصویر ↗</a></p>` : (art.sourceType === 'commons' && (art.license || art.credit) ? `<p class="detail-attribution">${art.credit ? `اعتبار: ${escapeHTML(String(art.credit).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim())}` : ''}${art.credit && art.license ? ' · ' : ''}${art.license ? `مجوز: ${escapeHTML(art.license)}` : ''}</p>` : '')}<div class="detail-copy">${escapeHTML(art.short_description || art.description || 'توضیح کوتاهی برای این اثر از پاسخ فعلی موزه دریافت نشد. برای اطلاعات کامل‌تر صفحه‌ی رسمی اثر را ببین.')}</div><div class="detail-actions"><button class="button ${fav ? 'button-outline' : 'button-primary'}" data-toggle-favorite="${escapeHTML(art.id)}" type="button">${fav ? '♥ حذف از گنجینه' : '♡ ذخیره در گنجینه'}</button>${source ? `<a class="button button-outline" href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">صفحه‌ی رسمی اثر ↗</a>` : ''}<button class="button button-outline" data-close-modal type="button">بستن</button></div>`;
  } else if (kind === 'resource-detail') {
    const resource = state.resources.find(item => item.id === recordId);
    if (!resource) return;
    title.textContent = resource.title; eyebrow.textContent = 'قفسه‌ی مطالعه';
    const url = safeHttpUrl(resource.url);
    html = `<div class="detail-meta">${resourceTypeLabel(resource.type)} · ${escapeHTML(resource.creator || 'سازنده ثبت نشده')} · ${resourceStatusLabel(resource.status)}</div><div class="detail-copy">${escapeHTML(resource.notes || 'برای این منبع یادداشتی ثبت نشده است.')}</div><div class="detail-actions">${url ? `<a class="button button-primary" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">باز کردن منبع ↗</a>` : ''}<button class="button button-outline" data-resource-status="${escapeHTML(resource.id)}" type="button">تغییر وضعیت</button><button class="button button-outline" data-close-modal type="button">بستن</button></div>`;
  } else return;
  body.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
function closeModal() { const dialog = $('#app-modal'); if (dialog.open) dialog.close(); }

async function compressImage(file) {
  if (!file) return '';
  if (!file.type.startsWith('image/')) throw new Error('فایل انتخاب‌شده تصویر نیست.');
  const imageUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('خواندن تصویر ناموفق بود.')); reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('بازکردن تصویر ناموفق بود.')); img.src = imageUrl;
  });
  const max = 1500;
  const ratio = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

async function handleModalSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const fd = new FormData(form);
  const submitButton = $('button[type="submit"]', form);
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'در حال ذخیره…'; }
  try {
    if (form.id === 'artwork-form') {
      const file = fd.get('image');
      let imageData = '';
      if (file instanceof File && file.size > 0) imageData = await compressImage(file);
      const imageUrl = safeHttpUrl(String(fd.get('imageUrl') || '').trim());
      if (String(fd.get('imageUrl') || '').trim() && !imageUrl) throw new Error('پیوند تصویر باید با http یا https شروع شود.');
      state.artworks.push({ id: id(), title: String(fd.get('title')).trim(), date: String(fd.get('date') || todayISO()), medium: String(fd.get('medium') || '').trim(), imageUrl, imageData, notes: String(fd.get('notes') || '').trim(), createdAt: new Date().toISOString() });
      persistState(); closeModal(); renderAll(); showToast('اثر به دفتر آتلیه اضافه شد.');
    } else if (form.id === 'idea-form') {
      state.ideas.push({ id: id(), title: String(fd.get('title')).trim(), notes: String(fd.get('notes') || '').trim(), tags: String(fd.get('tags') || '').trim(), done: false, createdAt: new Date().toISOString() });
      persistState(); closeModal(); renderAll(); openPage('studio'); $$('.studio-tab').forEach(b => b.classList.toggle('active', b.dataset.studioTab === 'ideas')); $('#studio-works-view').classList.remove('active'); $('#studio-ideas-view').classList.add('active'); showToast('ایده در دفترت نگه داشته شد.');
    } else if (form.id === 'resource-form') {
      const rawUrl = String(fd.get('url') || '').trim(); const url = safeHttpUrl(rawUrl);
      if (rawUrl && !url) throw new Error('پیوند منبع باید با http یا https شروع شود.');
      state.resources.push({ id: id(), title: String(fd.get('title')).trim(), type: String(fd.get('type')), creator: String(fd.get('creator') || '').trim(), url, status: String(fd.get('status') || 'todo'), notes: String(fd.get('notes') || '').trim(), createdAt: new Date().toISOString() });
      persistState(); closeModal(); renderAll(); openPage('library'); showToast('منبع به قفسه اضافه شد.');
    } else if (form.id === 'session-form') {
      const minutes = Number(fd.get('minutes'));
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) throw new Error('مدت جلسه باید بین ۱ تا ۱۴۴۰ دقیقه باشد.');
      state.sessions.push({ id: id(), date: String(fd.get('date') || todayISO()), minutes: Math.round(minutes), focus: String(fd.get('focus') || '').trim(), notes: String(fd.get('notes') || '').trim(), createdAt: new Date().toISOString() });
      persistState(); closeModal(); renderAll(); openPage('progress'); showToast('جلسه‌ی تمرین ثبت شد؛ آفرین که برای هنر وقت گذاشتی.');
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || 'ذخیره انجام نشد. لطفاً دوباره تلاش کن.');
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = ({ 'artwork-form': 'ذخیره در آتلیه', 'idea-form': 'ثبت ایده', 'resource-form': 'افزودن به قفسه', 'session-form': 'ثبت جلسه' })[form.id] || 'ذخیره'; }
  }
}

function toggleFavorite(rawId) {
  const art = discoverResults.find(item => String(item.id) === String(rawId)) || state.favorites.find(item => String(item.id) === String(rawId));
  if (!art) return;
  const idx = state.favorites.findIndex(item => String(item.id) === String(rawId));
  if (idx >= 0) { state.favorites.splice(idx, 1); showToast('اثر از گنجینه‌ی شخصی برداشته شد.'); }
  else {
    state.favorites.push({ id: art.id, title: art.title || 'اثر بدون عنوان', artist: art.artist || art.artist_title || art.artist_display || '', date: art.date || art.date_display || '', imageUrl: art.imageFallback?.imageUrl || art.imageUrl || iiifUrl(art, '843,'), imageFallback: art.imageFallback || null, image_id: art.image_id || '', sourceUrl: art.sourceUrl || art.web_url || '', sourceType: art.sourceType || 'artic', medium_display: art.medium_display || '', place_of_origin: art.place_of_origin || '', short_description: art.short_description || art.description || '', license: art.license || '', credit: art.credit || '' });
    showToast('اثر به گنجینه‌ی شخصی‌ات اضافه شد.');
  }
  persistState(); updateStats();
  if (favoritesMode) renderDiscoverFavorites(); else renderDiscoverGrid();
  if ($('#app-modal').open && $('#modal-title').textContent) {
    // Refresh the details button label while keeping the chosen artwork in view.
    const detailButton = $('[data-toggle-favorite]', $('#modal-body'));
    if (detailButton && String(detailButton.dataset.toggleFavorite) === String(rawId)) {
      const current = state.favorites.some(item => String(item.id) === String(rawId));
      detailButton.textContent = current ? '♥ حذف از گنجینه' : '♡ ذخیره در گنجینه';
      detailButton.classList.toggle('button-primary', !current); detailButton.classList.toggle('button-outline', current);
    }
  }
}

function renderDiscoverGrid() {
  $('#discover-grid').innerHTML = discoverResults.length ? discoverResults.map(art => artCard(art, 'discover')).join('') : emptyState('✧', 'اثری برای نمایش نیست', 'عبارت جست‌وجو را عوض کن یا دوباره تلاش کن.');
  $('#discover-count').textContent = `${faNum(discoverResults.length)} اثر در این صفحه`;
  $('#load-more-btn').hidden = discoverResults.length === 0 || (window.__atelierTotal != null && discoverResults.length >= window.__atelierTotal);
  $('#favorite-count').textContent = faNum(state.favorites.length);
}
function renderDiscoverFavorites() {
  $('#discover-heading').textContent = 'گنجینه‌ی شخصی تو';
  $('#discover-status').textContent = state.favorites.length ? 'آثاری که برای بازگشت و مطالعه ذخیره کرده‌ای.' : 'هنوز اثری ذخیره نکرده‌ای. از میان آثار کشف‌شده یک مورد انتخاب کن.';
  $('#discover-status').classList.remove('error', 'warning');
  $('#discover-grid').innerHTML = state.favorites.length ? state.favorites.map(art => artCard(art, 'discover')).join('') : emptyState('♡', 'گنجینه هنوز خالی است', 'روی «ذخیره در گنجینه» کنار هر اثر بزن تا بعداً پیدایش کنی.', '<button class="button button-outline" id="back-to-discover" type="button">بازگشت به آثار</button>');
  $('#discover-count').textContent = `${faNum(state.favorites.length)} اثر ذخیره‌شده`;
  $('#load-more-btn').hidden = true;
}
// GitHub Pages cannot run a server-side API proxy. Instead, GitHub Actions periodically
// fetches public-domain records from the official Art Institute API and publishes them as
// data/artic-artworks.json. The site searches this snapshot locally, avoiding browser CORS.
async function fetchJsonWithTimeout(url, timeoutMs = 14000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal, mode: 'cors', cache: 'no-store' });
    const isJson = (response.headers.get('content-type') || '').includes('json');
    let body = null;
    try { body = isJson ? await response.json() : await response.text(); } catch (_) {}
    return { response, body };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('مهلت پاسخ تمام شد (timeout).');
    throw error;
  } finally { clearTimeout(timer); }
}
function validateApiPayload(json, response) {
  if (!response.ok) {
    const details = json?.errors?.map?.(item => item.message || item).join('; ') || json?.error || json?.message || (typeof json === 'string' ? json.slice(0,120) : '');
    throw new Error(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}${details ? ` — ${details}` : ''}`);
  }
  if (!json || typeof json !== 'object') throw new Error('پاسخ API از نوع JSON معتبر نیست.');
  if (json.error || json.errors?.length) throw new Error(String(json.error || json.errors.map(item => item.message || item).join('; ')));
  return json;
}
function normalizeSearchText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
async function loadArticSnapshot() {
  if (articSnapshotCache) return articSnapshotCache;
  if (!articSnapshotPromise) {
    articSnapshotPromise = (async () => {
      const url = new URL('data/artic-artworks.json', document.baseURI);
      const { response, body } = await fetchJsonWithTimeout(url.href, 12000);
      if (!response.ok) throw new Error(`فهرست همگام‌سازی‌شده‌ی موزه در دسترس نیست (HTTP ${response.status}). بررسی کن GitHub Actions با موفقیت اجرا شده باشد.`);
      if (!body || !Array.isArray(body.works)) throw new Error('فایل داده‌ی موزه ساختار معتبری ندارد.');
      if (!body.works.length) throw new Error('فهرست آثار موزه هنوز با GitHub Actions دریافت نشده یا همگام‌سازی ناموفق بوده است. صفحه‌ی Actions مخزن را بررسی کن.');
      articSnapshotCache = body;
      return body;
    })().catch(error => { articSnapshotPromise = null; throw error; });
  }
  return articSnapshotPromise;
}
function artistTitleMatches(title, wanted) {
  const candidate = normalizeSearchText(title);
  const target = normalizeSearchText(wanted);
  if (!candidate || !target) return false;
  if (candidate === target) return true;
  // Some museum records use Michelangelo Buonarroti instead of Michelangelo.
  return target === 'michelangelo' && candidate.startsWith('michelangelo ');
}
async function museumFetch(path, params = {}) {
  if (path === '/agents/search') {
    const q = normalizeSearchText(params.q || '');
    return { data: ARTIST_CATALOG.filter(artist => !q || normalizeSearchText(`${artist.name} ${artist.fa}`).includes(q)).map(artist => ({ id: artist.id, title: artist.name, description: artist.description, is_artist: true })) };
  }
  if (path !== '/artworks/search') throw new Error(`مسیر موزه در نسخه‌ی استاتیک پشتیبانی نمی‌شود: ${path}`);
  const snapshot = await loadArticSnapshot();
  const allWorks = Array.isArray(snapshot.works) ? snapshot.works : [];
  const artistQuery = params.query?.term?.['artist_title.keyword'] || '';
  const freeQuery = normalizeSearchText(params.q || '');
  let matches = allWorks;
  if (artistQuery) {
    matches = matches.filter(item => artistTitleMatches(item.artist_title || '', artistQuery));
  } else if (freeQuery) {
    const terms = freeQuery.split(/\s+/).filter(Boolean);
    matches = matches.filter(item => {
      const haystack = normalizeSearchText([item.title, item.artist_title, item.date_display, item.medium_display, item.place_of_origin, item.short_description, item.description, item.style_title, item.classification_title, ...(Array.isArray(item.term_titles) ? item.term_titles : [])].join(' '));
      return terms.every(term => haystack.includes(term));
    });
  }
  matches = matches.filter(item => item && item.id != null && item.image_id && item.is_public_domain === true);
  const offset = Math.max(0, Number(params.from || 0));
  const size = Math.max(1, Math.min(100, Number(params.size || params.limit || 12)));
  const pageItems = matches.slice(offset, offset + size);
  return { data: pageItems, pagination: { total: matches.length, limit: size, offset, current_page: Math.floor(offset / size) + 1, total_pages: Math.ceil(matches.length / size) }, snapshot: { generatedAt: snapshot.generatedAt, successfulQueries: snapshot.successfulQueries } };
}
function showApiError(error) {
  const detail = error?.message || String(error || 'خطای ناشناخته');
  console.error('Atelier gallery request failed:', error);
  return `دریافت تصاویر از آرشیو ناموفق بود: ${detail}`;
}
async function searchCommonsImages(query, limit = 12) {
  const params = new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '6', gsrlimit: String(Math.min(Math.max(limit, 1), 20)),
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '760', format: 'json', formatversion: '2', origin: '*'
  });
  const { response, body } = await fetchJsonWithTimeout(`${COMMONS_API}?${params.toString()}`, 16000);
  if (!response.ok) throw new Error(`Wikimedia Commons HTTP ${response.status}`);
  if (!body || body.error) throw new Error(body?.error?.info || 'پاسخ قابل‌خواندن از Wikimedia Commons دریافت نشد.');
  const pages = Array.isArray(body.query?.pages) ? body.query.pages : Object.values(body.query?.pages || {});
  return pages.map(page => {
    const info = page.imageinfo?.[0] || {};
    const cleanTitle = String(page.title || '').replace(/^File:/i, '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      id: `commons:${page.pageid || page.title}`,
      title: cleanTitle || 'اثر بدون عنوان', artist: query, date: '', imageUrl: info.thumburl || info.url || '',
      sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page.title || '').replace(/ /g, '_'))}`,
      sourceType: 'commons', license: info.extmetadata?.LicenseShortName?.value || '',
      credit: String(info.extmetadata?.Artist?.value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), medium_display: '', place_of_origin: ''
    };
  }).filter(item => item.imageUrl && item.sourceUrl);
}
async function loadArtistImage(artist) {
  if (artistImageCache.has(artist.id)) return artistImageCache.get(artist.id);
  if (artistImagePromises.has(artist.id)) return artistImagePromises.get(artist.id);
  const promise = (async () => {
    try {
      const items = await searchCommonsImages(artist.query, 8);
      const surname = artist.name.split(' ').slice(-1)[0].toLowerCase();
      const ranked = items.map(item => {
        const title = item.title.toLowerCase();
        let score = 0;
        if (title.includes(surname)) score += 5;
        if (/painting|portrait|fresco|birth of venus|creation of adam|judith|love locked out|beauty revealed|leyenda/i.test(title)) score += 2;
        if (/museum|exhibition|gallery view|book cover|poster/i.test(title)) score -= 2;
        if (/portrait|painting|fresco|art project/i.test(title)) score += 1;
        return { item, score };
      }).sort((a,b) => b.score - a.score);
      const image = ranked[0]?.item || items[0] || null;
      if (image) artistImageCache.set(artist.id, image);
      return image;
    } catch (error) {
      console.warn(`Could not load Commons image for ${artist.name}:`, error);
      return null;
    } finally { artistImagePromises.delete(artist.id); artistImageChecked.add(artist.id); }
  })();
  artistImagePromises.set(artist.id, promise);
  return promise;
}
function artistById(idValue) { return ARTIST_CATALOG.find(item => item.id === idValue) || ARTIST_CATALOG[0]; }
function initials(name) { return String(name || '').split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
function renderHeroArtistList() {
  const list = $('#hero-artist-list');
  if (!list) return;
  const selected = ARTIST_CATALOG[spotlightIndex];
  const ids = [selected, ...ARTIST_CATALOG.filter(a => a.id !== selected.id)].slice(0,4);
  list.innerHTML = ids.map((artist, index) => `<li class="${artist.id === selected.id ? 'active' : ''}"><button type="button" data-spotlight-id="${artist.id}"><span>${escapeHTML(artist.name)}</span><small>${escapeHTML(artist.years)}</small></button></li>`).join('');
}
function renderHomeArtistRail() {
  const rail = $('#home-featured-artists');
  if (!rail) return;
  rail.innerHTML = ARTIST_CATALOG.map((artist, index) => {
    const image = artistImageCache.get(artist.id);
    return `<button class="artist-rail-card ${index === spotlightIndex ? 'active' : ''}" type="button" data-spotlight-id="${artist.id}" aria-label="نمایش ${escapeHTML(artist.fa)}">
      <span class="artist-rail-image">${image ? `<img src="${escapeHTML(image.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="artist-rail-placeholder">${escapeHTML(initials(artist.name))}</span>`}<span class="artist-rail-index">${String(index+1).padStart(2,'0')}</span></span>
      <span class="artist-rail-meta"><strong>${escapeHTML(artist.fa)}</strong><small>${escapeHTML(artist.eraLabel)}</small></span>
    </button>`;
  }).join('');
}
function renderArtistDirectory() {
  const grid = $('#artists-grid');
  if (!grid) return;
  const query = ($('#artist-query')?.value || '').trim().toLocaleLowerCase('fa');
  const items = ARTIST_CATALOG.filter(artist => (activeArtistEra === 'all' || artist.era === activeArtistEra) && (!query || `${artist.name} ${artist.fa} ${artist.eraLabel} ${artist.years} ${artist.description}`.toLocaleLowerCase('fa').includes(query)));
  grid.innerHTML = items.map((artist, index) => {
    const image = artistImageCache.get(artist.id);
    return `<article class="artist-card" data-artist-card="${artist.id}">
      <div class="artist-card-poster ${image ? 'has-image' : (artistImageChecked.has(artist.id) ? 'image-failed' : 'is-loading')}">
        <div class="artist-image-placeholder"><span class="artist-placeholder-monogram">${escapeHTML(initials(artist.name))}</span><span class="artist-placeholder-label">${artistImageChecked.has(artist.id) ? 'تصویر پیدا نشد' : 'در حال جست‌وجوی اثر…'}</span></div>
        ${image ? `<img class="artist-card-image" src="${escapeHTML(image.imageUrl)}" alt="${escapeHTML(image.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.parentElement.classList.add('image-failed')">` : ''}
        <span class="artist-era-stamp">${escapeHTML(artist.eraLabel)}</span>
        ${image?.sourceUrl ? `<a class="artist-image-source" href="${escapeHTML(image.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="منبع تصویر ${escapeHTML(artist.name)}" title="منبع تصویر">↗</a>` : ''}
      </div>
      <div class="artist-card-content"><div class="artist-card-topline"><span class="movement-no">${String(ARTIST_CATALOG.findIndex(a => a.id === artist.id)+1).padStart(2,'0')}</span><span class="artist-dates">${escapeHTML(artist.yearsFa)}</span></div>
        <h2>${escapeHTML(artist.fa)}</h2><p class="artist-english-name">${escapeHTML(artist.name)}</p><p class="artist-description">${escapeHTML(artist.description)}</p>
        <div class="artist-card-actions"><button class="text-link" type="button" data-artist-search="${artist.id}">دیدن آثار <span>↗</span></button><a class="artist-bio-link" href="${escapeHTML(artist.wiki)}" target="_blank" rel="noopener noreferrer">زندگی‌نامه ↗</a></div>
      </div>
    </article>`;
  }).join('') || emptyState('✦', 'هنرمندی پیدا نشد', 'عبارت یا دوره‌ی دیگری را امتحان کن.');
  const status = $('#artists-status');
  if (status) status.textContent = query || activeArtistEra !== 'all' ? `نمایش ${faNum(items.length)} هنرمند از ${faNum(ARTIST_CATALOG.length)} هنرمند منتخب.` : 'هشت هنرمند منتخب بر اساس ترتیب تاریخی مرتب شده‌اند؛ تصاویر آثار از آرشیو عمومی دریافت می‌شوند.';
}
async function hydrateArtistImages() {
  // Fetch in parallel so cards fill as soon as each public-source request completes.
  await Promise.allSettled(ARTIST_CATALOG.map(async artist => {
    if (!artistImageCache.has(artist.id)) await loadArtistImage(artist);
    renderHomeArtistRail(); renderArtistDirectory();
    if (ARTIST_CATALOG[spotlightIndex]?.id === artist.id) updateSpotlightImage(artist, artistImageCache.get(artist.id));
  }));
}
function updateSpotlightImage(artist, image) {
  const mainImg = $('#featured-artwork-img');
  const placeholder = $('#featured-art-placeholder');
  const mainLink = $('#featured-open-link');
  if (image && mainImg) {
    mainImg.onload = () => { mainImg.hidden = false; mainImg.classList.add('loaded'); if (placeholder) placeholder.hidden = true; };
    mainImg.onerror = () => { mainImg.hidden = true; mainImg.classList.remove('loaded'); if (placeholder) { placeholder.hidden = false; const strong = placeholder.querySelector('strong'); if (strong) strong.textContent = 'تصویر این هنرمند در این آرشیو پیدا نشد'; const p = placeholder.querySelector('p'); if (p) p.textContent = 'صفحه‌ی منبع را باز کن یا هنرمند دیگری را انتخاب کن.'; const spinner = placeholder.querySelector('.loading-orbit'); if (spinner) spinner.hidden = true; } };
    if (mainImg.src !== image.imageUrl) mainImg.src = image.imageUrl;
    mainImg.alt = `${image.title} — ${artist.name}`;
    if (mainImg.complete && mainImg.naturalWidth > 0) { mainImg.hidden = false; mainImg.classList.add('loaded'); if (placeholder) placeholder.hidden = true; }
    if (mainLink) mainLink.href = image.sourceUrl;
    if (mainLink) mainLink.setAttribute('aria-label', `دیدن صفحه‌ی منبع ${image.title}`);
    $('#featured-artwork-title').textContent = image.title;
    $('#featured-caption-kicker').textContent = artist.eraLabel.toUpperCase();
    $('#featured-artwork-byline').textContent = `${artist.name} · ${artist.years}`;
  } else {
    if (mainImg) mainImg.hidden = true;
    if (placeholder) {
      placeholder.hidden = false;
      const strong = placeholder.querySelector('strong'); if (strong) strong.textContent = `${artist.fa}؛ یک مسیر تازه برای دیدن هنر`;
      const p = placeholder.querySelector('p'); const spinner = placeholder.querySelector('.loading-orbit');
      const pending = artistImagePromises.has(artist.id);
      if (p) p.textContent = pending ? 'تصویر از آرشیو عمومی در حال دریافت است.' : 'تصویر در این درخواست پیدا نشد؛ با انتخاب هنرمند دوباره تلاش کن.';
      if (spinner) spinner.hidden = !pending;
    }
    $('#featured-artwork-title').textContent = artist.name;
    $('#featured-caption-kicker').textContent = artist.eraLabel.toUpperCase();
    $('#featured-artwork-byline').textContent = `${artist.years} · artwork archive`;
  }
}
async function selectSpotlight(idValue, resetTimer = true) {
  const index = Math.max(0, ARTIST_CATALOG.findIndex(artist => artist.id === idValue));
  spotlightIndex = index;
  const artist = ARTIST_CATALOG[spotlightIndex];
  const next = ARTIST_CATALOG[(spotlightIndex + 1) % ARTIST_CATALOG.length];
  renderHeroArtistList(); renderHomeArtistRail();
  const activeImage = artistImageCache.get(artist.id);
  if (activeImage) updateSpotlightImage(artist, activeImage);
  else {
    const activePromise = loadArtistImage(artist);
    updateSpotlightImage(artist, null);
    activePromise.then(image => { if (ARTIST_CATALOG[spotlightIndex]?.id === artist.id) updateSpotlightImage(artist, image); renderHeroArtistList(); renderHomeArtistRail(); renderArtistDirectory(); });
  }
  const sideImage = artistImageCache.get(next.id);
  const sideImg = $('#featured-side-img');
  const sidePlaceholder = $('#featured-side-placeholder');
  if (sideImage && sideImg) {
    sideImg.onload = () => { sideImg.hidden = false; if (sidePlaceholder) sidePlaceholder.hidden = true; };
    sideImg.onerror = () => { sideImg.hidden = true; if (sidePlaceholder) sidePlaceholder.hidden = false; };
    sideImg.src = sideImage.imageUrl; sideImg.alt = `${sideImage.title} — ${next.name}`;
    if (sideImg.complete && sideImg.naturalWidth > 0) { sideImg.hidden = false; if (sidePlaceholder) sidePlaceholder.hidden = true; }
    $('#featured-side-link').href = sideImage.sourceUrl;
  } else { if (sideImg) sideImg.hidden = true; if (sidePlaceholder) sidePlaceholder.hidden = false; }
  $('#featured-side-title').textContent = next.name;
  $('#featured-side-copy').textContent = next.description;
  $('#featured-side-index').innerHTML = `${String((spotlightIndex+2)).padStart(2,'0')} <small>/ ${String(ARTIST_CATALOG.length).padStart(2,'0')}</small>`;
  $('#featured-slide-count').textContent = `${String(spotlightIndex+1).padStart(2,'0')} / ${String(ARTIST_CATALOG.length).padStart(2,'0')}`;
  if (!artistImageCache.has(next.id)) loadArtistImage(next).then(image => { if (ARTIST_CATALOG[(spotlightIndex+1)%ARTIST_CATALOG.length]?.id === next.id && image && $('#featured-side-img')) { $('#featured-side-img').src = image.imageUrl; $('#featured-side-img').hidden = false; $('#featured-side-placeholder').hidden = true; $('#featured-side-link').href = image.sourceUrl; } renderHomeArtistRail(); renderArtistDirectory(); });
  if (!spotlightTimer) spotlightTimer = setInterval(() => { if (document.visibilityState === 'visible' && $('#page-home')?.classList.contains('active')) selectSpotlight(ARTIST_CATALOG[(spotlightIndex + 1) % ARTIST_CATALOG.length].id, false); }, 9000);
}

async function searchArtworks(query, append = false) {
  if (favoritesMode) { favoritesMode = false; $('#show-favorites-btn').classList.remove('active'); }
  discoverQuery = query || 'Sandro Botticelli';
  const normalizedQuery = String(discoverQuery).trim().toLocaleLowerCase();
  const catalogArtist = ARTIST_CATALOG.find(artist =>
    artist.name.toLocaleLowerCase() === normalizedQuery || artist.fa.toLocaleLowerCase() === normalizedQuery
  );
  // For a curated artist, search the exact artist_title field. A free-text q=Caravaggio
  // also matches artists such as "Polidoro da Caravaggio", which is not what the user asked for.
  const commonsQuery = catalogArtist?.query || `${discoverQuery} painting artwork`;
  if (!append) { discoverOffset = 0; discoverResults = []; window.__atelierTotal = null; $('#discover-grid').innerHTML = ''; }
  $('#discover-heading').textContent = `جست‌وجو: ${catalogArtist?.fa || discoverQuery}`;
  $('#discover-status').textContent = 'در حال جست‌وجو در داده‌های همگام‌سازی‌شده‌ی API رسمی Art Institute of Chicago…';
  $('#discover-status').classList.remove('error', 'warning');
  $('#load-more-btn').disabled = true;
  try {
    const fields = ['id','title','artist_title','date_display','image_id','is_public_domain','short_description','medium_display','place_of_origin','web_url','description'];
    const params = catalogArtist ? {
      query: { term: { 'artist_title.keyword': catalogArtist.name } },
      size: 30, from: discoverOffset, fields
    } : {
      q: discoverQuery,
      query: { term: { is_public_domain: true } },
      size: 12, from: discoverOffset, fields
    };
    const json = await museumFetch('/artworks/search', params);
    const receivedItems = Array.isArray(json.data) ? json.data : [];
    // Keep artist-specific results precise and only use works that have an image and are marked public domain.
    const rawItems = catalogArtist
      ? receivedItems.filter(item => artistTitleMatches(item.artist_title || '', catalogArtist.name) && item.is_public_domain === true && item.image_id)
      : receivedItems;
    const items = rawItems.filter(item => item && item.id != null).map(item => ({ ...item, sourceType: 'artic', sourceUrl: item.web_url || `https://www.artic.edu/artworks/${item.id}`, imageUrl: item.image_id ? iiifUrl(item, '843,') : '' }));
    if (!items.length && !append) {
      const commonsItems = await searchCommonsImages(commonsQuery, 12);
      if (commonsItems.length) {
        discoverResults = commonsItems.map(item => ({ ...item, artist: catalogArtist?.name || discoverQuery, sourceType: 'commons' }));
        discoverSource = 'commons'; window.__atelierTotal = discoverResults.length;
        $('#discover-status').textContent = catalogArtist
          ? `در مجموعه‌ی عمومی Art Institute اثر قابل‌نمایشی با انتساب دقیق به ${catalogArtist.fa} پیدا نشد؛ ${faNum(commonsItems.length)} تصویر مرتبط از Wikimedia Commons نمایش داده شده‌اند. این آثار متعلق به مجموعه‌ی موزه نیستند؛ اطلاعات مجوز و اعتبار را در صفحه‌ی منبع بررسی کن.`
          : `در مجموعه‌ی Art Institute نتیجه‌ای پیدا نشد؛ ${faNum(commonsItems.length)} تصویر مرتبط از Wikimedia Commons نمایش داده شده‌اند. برای مجوز و اعتبار، صفحه‌ی منبع هر تصویر را باز کن.`;
        $('#discover-status').classList.add('warning'); renderDiscoverGrid(); $('#load-more-btn').hidden = true; return;
      }
    }
    if (append) discoverResults = discoverResults.concat(items); else discoverResults = items;
    discoverSource = 'artic';
    discoverOffset += receivedItems.length;
    window.__atelierTotal = catalogArtist ? Number(json.pagination?.total ?? discoverResults.length) : Number(json.pagination?.total ?? (json.pagination?.total_pages != null ? json.pagination.total_pages * (json.pagination.limit || 12) : discoverResults.length));
    const snapshotDate = json.snapshot?.generatedAt ? new Date(json.snapshot.generatedAt).toLocaleDateString('fa-IR') : '';
    $('#discover-status').textContent = items.length
      ? (catalogArtist
          ? `نمایش ${faNum(items.length)} اثر با انتساب دقیق به ${catalogArtist.fa} از مجموعه‌ی عمومی Art Institute of Chicago؛ داده‌ها با GitHub Actions همگام‌سازی شده‌اند${snapshotDate ? ` · آخرین همگام‌سازی: ${snapshotDate}` : ''}.`
          : `نمایش ${faNum(items.length)} اثر از مجموعه‌ی عمومی Art Institute of Chicago؛ داده‌های API در مرحله‌ی انتشار همگام‌سازی شده‌اند${snapshotDate ? ` · آخرین همگام‌سازی: ${snapshotDate}` : ''}.`)
      : 'در فهرست همگام‌سازی‌شده‌ی Art Institute برای این عبارت اثر قابل‌نمایشی پیدا نشد. در حال بررسی منبع جایگزین…';
    renderDiscoverGrid();
    $('#load-more-btn').hidden = items.length < 1 || discoverResults.length >= window.__atelierTotal || Boolean(catalogArtist && receivedItems.length < 30);
  } catch (museumError) {
    console.warn('Art Institute request failed; trying Commons fallback.', museumError);
    try {
      const commonsItems = await searchCommonsImages(commonsQuery, 12);
      if (!commonsItems.length) throw new Error('برای این عبارت تصویری در Wikimedia Commons پیدا نشد.');
      const normalized = commonsItems.map((item, index) => ({ ...item, id: item.id || `commons:${index}`, artist: catalogArtist?.name || discoverQuery, sourceType: 'commons' }));
      discoverResults = append ? discoverResults.concat(normalized) : normalized;
      discoverSource = 'commons'; window.__atelierTotal = discoverResults.length;
      $('#discover-status').textContent = `در داده‌های همگام‌سازی‌شده‌ی Art Institute نتیجه‌ای برای این عبارت موجود نیست یا فایل همگام‌سازی در دسترس نیست؛ ${faNum(normalized.length)} تصویر جایگزین از Wikimedia Commons نمایش داده شده‌اند. این آثار لزوماً متعلق به مجموعه‌ی موزه نیستند؛ منبع و مجوز را در صفحه‌ی هر تصویر بررسی کن. علت: ${museumError.message || museumError}`;
      $('#discover-status').classList.add('warning');
      renderDiscoverGrid(); $('#load-more-btn').hidden = true;
    } catch (fallbackError) {
      const message = showApiError(museumError);
      $('#discover-status').textContent = `${message} | منبع جایگزین هم پاسخ نداد: ${fallbackError.message || fallbackError}`;
      $('#discover-status').classList.add('error');
      if (!append) $('#discover-grid').innerHTML = emptyState('⌁', 'گالری فعلاً در دسترس نیست', 'اتصال به Wikimedia Commons را بررسی کن یا عبارت دیگری جست‌وجو کن.', '<button class="button button-outline" id="retry-discover-btn" type="button">تلاش دوباره</button>');
      $('#discover-count').textContent = 'اتصال ناموفق'; $('#load-more-btn').hidden = true;
    }
  } finally { $('#load-more-btn').disabled = false; }
}
async function testMuseumConnection() {
  const button = $('#api-test-btn'); const status = $('#discover-status');
  button.disabled = true; button.textContent = 'در حال آزمایش…'; status.classList.remove('error', 'warning');
  status.textContent = 'در حال بررسی فهرست آثار همگام‌سازی‌شده‌ی Art Institute…';
  try {
    const snapshot = await loadArticSnapshot();
    const updated = snapshot.generatedAt ? new Date(snapshot.generatedAt).toLocaleString('fa-IR') : 'نامشخص';
    status.textContent = `اتصال موفق است: ${faNum(snapshot.works.length)} اثر از API رسمی Art Institute در فهرست استاتیک موجود است. آخرین همگام‌سازی: ${updated}. برای جست‌وجوی تازه، GitHub Actions را اجرا کن.`;
    status.classList.remove('error', 'warning');
  } catch (error) {
    status.textContent = `${error.message || error} در GitHub → Actions، اجرای «Atelier Pages + Art Institute data» را بررسی کن.`;
    status.classList.add('error');
  } finally { button.disabled = false; button.textContent = 'بررسی فهرست موزه'; }
}
async function searchArtists(query = 'Michelangelo') {
  const json = await museumFetch('/agents/search', { q: query, size: 12, from: 0 });
  return Array.isArray(json.data) ? json.data : [];
}
// The home hero is a live carousel driven by a curated list of eight artists. Artist images are loaded from Commons.

function exportBackup() {
  const payload = { app: 'Atelier', schemaVersion: 1, exportedAt: new Date().toISOString(), data: state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `atelier-backup-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('نسخه‌ی پشتیبان آماده شد. آن را در جای امنی نگه دار.');
}
async function importBackup(file) {
  if (!file) return;
  try {
    const content = JSON.parse(await file.text());
    const data = content.data || content;
    if (!data || !['artworks', 'ideas', 'resources', 'sessions', 'favorites'].every(key => Array.isArray(data[key]))) throw new Error('ساختار فایل با نسخه‌ی پشتیبان آتلیه سازگار نیست.');
    if (!confirm('بازیابی، داده‌های فعلی این مرورگر را جایگزین می‌کند. ادامه می‌دهی؟')) return;
    state = { artworks: data.artworks, ideas: data.ideas, resources: data.resources, sessions: data.sessions, favorites: data.favorites };
    if (persistState()) { renderAll(); showToast('نسخه‌ی پشتیبان بازیابی شد.'); }
  } catch (error) { showToast(error.message || 'فایل پشتیبان خوانده نشد.'); }
  finally { $('#import-file').value = ''; }
}
function renderAll() { updateHeader(); updateStats(); renderHome(); renderStudio(); renderLibrary(); renderProgress(); }

// Navigation and page actions.
$$('[data-page]:not([data-search-term])').forEach(button => button.addEventListener('click', () => openPage(button.dataset.page)));
document.addEventListener('click', event => {
  const spotlight = event.target.closest('[data-spotlight-id]');
  if (spotlight) { selectSpotlight(spotlight.dataset.spotlightId); return; }
  const artistSearch = event.target.closest('[data-artist-search]');
  if (artistSearch) { const artist = artistById(artistSearch.dataset.artistSearch); if ($('#discover-query')) $('#discover-query').value = artist.name; openPage('discover', { loadDiscover: false }); searchArtworks(artist.name); return; }
  const searchTrigger = event.target.closest('[data-search-term]');
  if (searchTrigger) {
    const term = searchTrigger.dataset.searchTerm;
    if ($('#discover-query')) $('#discover-query').value = term;
    openPage('discover', { loadDiscover: false });
    searchArtworks(term);
    return;
  }
  const go = event.target.closest('[data-go-page]'); if (go) { openPage(go.dataset.goPage); return; }
  const open = event.target.closest('[data-open-modal]'); if (open) { openModal(open.dataset.openModal); return; }
  if (event.target.closest('[data-close-modal]') || event.target.id === 'modal-close') { closeModal(); return; }
  const ownOpen = event.target.closest('[data-own-open]'); if (ownOpen) { openModal('own-detail', ownOpen.dataset.ownOpen); return; }
  const artOpen = event.target.closest('[data-discover-open]'); if (artOpen) { openModal('discover-detail', artOpen.dataset.discoverOpen); return; }
  const fav = event.target.closest('[data-toggle-favorite]'); if (fav) { toggleFavorite(fav.dataset.toggleFavorite); return; }
  const ideaToggle = event.target.closest('[data-toggle-idea]'); if (ideaToggle) { const item = state.ideas.find(i => i.id === ideaToggle.dataset.toggleIdea); if (item) { item.done = !item.done; persistState(); renderStudio(); showToast(item.done ? 'ایده به فهرست انجام‌شده‌ها رفت.' : 'ایده به فهرست فعال برگشت.'); } return; }
  const delArt = event.target.closest('[data-delete-art]'); if (delArt) { const key = delArt.dataset.deleteArt; if (confirm('این اثر از دفترت حذف شود؟')) { state.artworks = state.artworks.filter(a => a.id !== key); persistState(); closeModal(); renderAll(); showToast('اثر حذف شد.'); } return; }
  const delIdea = event.target.closest('[data-delete-idea]'); if (delIdea) { const key = delIdea.dataset.deleteIdea; if (confirm('این ایده حذف شود؟')) { state.ideas = state.ideas.filter(i => i.id !== key); persistState(); renderAll(); showToast('ایده حذف شد.'); } return; }
  const delResource = event.target.closest('[data-delete-resource]'); if (delResource) { const key = delResource.dataset.deleteResource; if (confirm('این منبع از قفسه حذف شود؟')) { state.resources = state.resources.filter(r => r.id !== key); persistState(); closeModal(); renderAll(); showToast('منبع حذف شد.'); } return; }
  const changeStatus = event.target.closest('[data-resource-status]'); if (changeStatus) { const item = state.resources.find(r => r.id === changeStatus.dataset.resourceStatus); if (item) { item.status = ({ todo: 'progress', progress: 'done', done: 'todo' })[item.status] || 'todo'; persistState(); closeModal(); renderAll(); showToast(`وضعیت منبع: ${resourceStatusLabel(item.status)}`); } return; }
  const delSession = event.target.closest('[data-delete-session]'); if (delSession) { const key = delSession.dataset.deleteSession; if (confirm('این جلسه از تاریخچه حذف شود؟')) { state.sessions = state.sessions.filter(s => s.id !== key); persistState(); renderAll(); showToast('جلسه حذف شد.'); } return; }
  const resOpen = event.target.closest('[data-resource-open]'); if (resOpen) { openModal('resource-detail', resOpen.dataset.resourceOpen); return; }
  if (event.target.id === 'back-to-discover') { favoritesMode = false; $('#show-favorites-btn').classList.remove('active'); searchArtworks(discoverQuery); return; }
  if (event.target.id === 'retry-discover-btn') { searchArtworks(discoverQuery); return; }
});

$('#top-add-btn').addEventListener('click', () => openModal('artwork'));
$('#modal-body').addEventListener('submit', handleModalSubmit);
$('#modal-close').addEventListener('click', closeModal);
$('#app-modal').addEventListener('click', event => { if (event.target === $('#app-modal')) closeModal(); });
if ($('#menu-toggle')) $('#menu-toggle').addEventListener('click', () => { const sidebar = $('#sidebar'); if (sidebar) sidebar.classList.toggle('open'); });
$('#header-export-btn')?.addEventListener('click', exportBackup);
$('#header-import-btn')?.addEventListener('click', () => $('#import-file').click());
$('#api-test-btn')?.addEventListener('click', testMuseumConnection);
$('#artist-search-form')?.addEventListener('submit', event => { event.preventDefault(); renderArtistDirectory(); });
$('#artist-query')?.addEventListener('input', renderArtistDirectory);
$$('[data-artist-era]').forEach(button => button.addEventListener('click', () => { activeArtistEra = button.dataset.artistEra; $$('[data-artist-era]').forEach(b => b.classList.toggle('active', b === button)); renderArtistDirectory(); }));
$('#featured-prev')?.addEventListener('click', () => selectSpotlight(ARTIST_CATALOG[(spotlightIndex - 1 + ARTIST_CATALOG.length) % ARTIST_CATALOG.length].id));
$('#featured-next')?.addEventListener('click', () => selectSpotlight(ARTIST_CATALOG[(spotlightIndex + 1) % ARTIST_CATALOG.length].id));
$('#log-prompt-btn').addEventListener('click', () => openModal('session'));
$('#art-image-input').addEventListener('change', () => {});

$$('.studio-tab').forEach(button => button.addEventListener('click', () => {
  const showIdeas = button.dataset.studioTab === 'ideas';
  $$('.studio-tab').forEach(b => b.classList.toggle('active', b === button));
  $('#studio-works-view').classList.toggle('active', !showIdeas); $('#studio-ideas-view').classList.toggle('active', showIdeas);
}));
$('#my-art-search').addEventListener('input', renderStudio);
$('#discover-search-form').addEventListener('submit', event => { event.preventDefault(); searchArtworks($('#discover-query').value.trim() || 'Impressionism'); });

$('#show-favorites-btn').addEventListener('click', () => {
  favoritesMode = !favoritesMode;
  $('#show-favorites-btn').classList.toggle('active', favoritesMode);
  if (favoritesMode) renderDiscoverFavorites(); else searchArtworks(discoverQuery);
});
$('#load-more-btn').addEventListener('click', () => searchArtworks(discoverQuery, true));
$$('[data-resource-filter]').forEach(button => button.addEventListener('click', () => {
  activeResourceFilter = button.dataset.resourceFilter;
  $$('[data-resource-filter]').forEach(b => b.classList.toggle('active', b === button));
  renderLibrary();
}));
$('#resource-search').addEventListener('input', renderLibrary);
$('#export-btn').addEventListener('click', exportBackup);
$('#privacy-export-btn').addEventListener('click', exportBackup);
$('#import-btn').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', event => importBackup(event.target.files?.[0]));
$('#clear-data-btn').addEventListener('click', () => {
  if (!confirm('همه‌ی آثار، ایده‌ها، منابع، جلسه‌ها و گنجینه‌ی ذخیره‌شده از این مرورگر پاک شوند؟ این کار قابل برگشت نیست؛ پیش از آن می‌توانی پشتیبان بگیری.')) return;
  state = defaultState(); persistState(); renderAll(); showToast('دفتر آتلیه پاک شد.');
});

// GitHub Pages static implementation of the Internet Archive APIs (no /api server routes).
// Keep search queries narrow and avoid expensive description-field searches and server-side sorting.
const IA_SEARCH_ENDPOINT = 'https://archive.org/advancedsearch.php';
const IA_SCRAPE_ENDPOINT = 'https://archive.org/services/search/v1/scrape';
const IA_METADATA_ENDPOINT = 'https://archive.org/metadata/';
const IA_STOP_WORDS = new Set(['the','and','for','from','with','full','performance','recording','classical','music','complete','version','live','audio','high','quality','official','track','de','of','in','a','an','op']);
const IA_AUDIO_PRIORITY = {'.mp3':100,'.m4a':95,'.aac':90,'.ogg':88,'.oga':87,'.opus':85,'.wav':80,'.flac':75,'.aiff':65,'.aif':64};

function readPersistentMusicSearch(cacheKey) {
  try {
    const all = JSON.parse(localStorage.getItem(MUSIC_SEARCH_STORAGE_KEY) || '{}');
    const entry = all && typeof all === 'object' ? all[cacheKey] : null;
    return entry && entry.data && Array.isArray(entry.data.items) ? entry : null;
  } catch (_) { return null; }
}
function savePersistentMusicSearch(cacheKey, entry) {
  try {
    const all = JSON.parse(localStorage.getItem(MUSIC_SEARCH_STORAGE_KEY) || '{}');
    all[cacheKey] = { savedAt: entry.savedAt || Date.now(), data: entry.data };
    const keys = Object.keys(all).sort((a,b) => Number(all[b]?.savedAt || 0) - Number(all[a]?.savedAt || 0));
    for (const key of keys.slice(24)) delete all[key];
    localStorage.setItem(MUSIC_SEARCH_STORAGE_KEY, JSON.stringify(all));
  } catch (_) { /* Private browsing or full storage must not break search. */ }
}

async function fetchInternetArchiveJSON(url, timeoutMs = 22000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-cache',
      headers: { Accept: 'application/json' }, signal: controller.signal
    });
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(payload?.error || payload?.message || `Internet Archive HTTP ${response.status}`);
      error.code = `IA_HTTP_${response.status}`;
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('پاسخ جست‌وجوی Internet Archive دیر رسید. درخواست سبک‌تر را هم امتحان می‌کنم.');
      timeoutError.code = 'IA_TIMEOUT';
      throw timeoutError;
    }
    if (error instanceof TypeError) {
      const networkError = new Error('اتصال مرورگر به Internet Archive برقرار نشد؛ ممکن است شبکه یا سرویس موقتاً در دسترس نباشد.');
      networkError.code = 'IA_NETWORK';
      throw networkError;
    }
    throw error;
  } finally { clearTimeout(timer); }
}

function buildIAQuery(query, loose = false) {
  const terms = (String(query || '').normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((term, i, all) => term.length > 2 && !IA_STOP_WORDS.has(term) && all.indexOf(term) === i)
    .slice(0, 4);
  if (!terms.length) throw new Error('نام قطعه یا آهنگ‌ساز را با حداقل دو نویسه وارد کن.');
  // The old query searched descriptions for every token and sorted all matches by downloads.
  // That can be slow on the public archive. Search only title/creator/subject and let relevance rank results.
  const clauses = terms.map(term => `(title:${term} OR creator:${term} OR subject:${term})`);
  const joiner = loose ? ' OR ' : ' AND ';
  return `mediatype:audio AND (${clauses.join(joiner)})`;
}

function normalizeIAItems(docs) {
  const toText = value => Array.isArray(value) ? value.filter(Boolean).map(String).join(', ') : (value == null ? '' : String(value));
  return (Array.isArray(docs) ? docs : []).map(doc => {
    const identifier = archiveIdentifier(doc.identifier);
    if (!identifier) return null;
    return {
      identifier,
      title: toText(doc.title) || 'اجرای بدون عنوان',
      creator: toText(doc.creator) || 'اجراکننده در فراداده ثبت نشده',
      description: toText(doc.description).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 350),
      date: toText(doc.date || doc.year),
      subject: toText(doc.subject),
      licenseUrl: toText(doc.licenseurl),
      thumbnail: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
      itemUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
      source: 'Internet Archive'
    };
  }).filter(Boolean);
}

async function searchInternetArchiveScrape(query, cursor = '', maxResults = 12, loose = true) {
  const params = new URLSearchParams();
  params.set('q', buildIAQuery(query, loose));
  params.set('fields', 'identifier,title,creator,date,subject,licenseurl,mediatype,year');
  params.set('count', '100'); // Scraping API minimum count is 100; only render a small first slice.
  if (cursor) params.set('cursor', cursor);
  const payload = await fetchInternetArchiveJSON(`${IA_SCRAPE_ENDPOINT}?${params.toString()}`, 14000);
  const allItems = normalizeIAItems(payload?.items || []);
  return {
    items: allItems.slice(0, Math.max(1, Math.min(12, Number(maxResults) || 12))),
    nextPageToken: payload?.cursor ? `scrape:${payload.cursor}` : '',
    totalResults: Number(payload?.total || allItems.length),
    source: 'Internet Archive Scraping API',
    licenseNote: 'مجوز و شرایط استفاده برای هر فایل متفاوت است؛ صفحه‌ی منبع را بررسی کن.'
  };
}

async function searchInternetArchiveStatic(query, pageToken = '', maxResults = 12) {
  const q = String(query || '').trim().slice(0, 180);
  if (q.length < 2) throw new Error('نام قطعه یا آهنگ‌ساز را با حداقل دو نویسه وارد کن.');
  const rows = Math.max(1, Math.min(12, Number.parseInt(maxResults, 10) || 12));
  const token = String(pageToken || '');
  if (token.startsWith('scrape:')) {
    return searchInternetArchiveScrape(q, token.slice(7), rows, true);
  }
  const startAt = Math.max(0, Math.min(10000, Number.parseInt(token, 10) || 0));
  const runAdvanced = async (loose, timeoutMs) => {
    const params = new URLSearchParams();
    params.set('q', buildIAQuery(q, loose));
    // Keep the payload small. Descriptions are fetched only for the selected recording.
    for (const field of ['identifier','title','creator','date','subject','licenseurl','mediatype','year']) params.append('fl[]', field);
    params.set('rows', String(rows));
    params.set('start', String(startAt));
    params.set('output', 'json');
    // Intentionally no downloads sort: sorting the entire matching set made queries slower.
    return fetchInternetArchiveJSON(`${IA_SEARCH_ENDPOINT}?${params.toString()}`, timeoutMs);
  };

  let payload;
  try {
    payload = await runAdvanced(false, 20000);
    let response = payload?.response || {};
    if (!(response.docs || []).length && startAt === 0) payload = await runAdvanced(true, 12000);
    response = payload?.response || {};
    const docs = Array.isArray(response.docs) ? response.docs : [];
    const items = normalizeIAItems(docs);
    if (!items.length && startAt === 0) {
      try {
        const scrapeFallback = await searchInternetArchiveScrape(q, '', rows, true);
        if (scrapeFallback.items.length) return scrapeFallback;
      } catch (scrapeError) {
        console.info('Internet Archive returned no Advanced Search results and Scraping fallback was unavailable.', scrapeError);
      }
    }
    const total = Number(response.numFound || 0);
    const next = startAt + docs.length;
    return {
      items, nextPageToken: next < total && next <= 10000 ? String(next) : '',
      totalResults: total, source: 'Internet Archive Advanced Search API',
      licenseNote: 'مجوز و شرایط استفاده برای هر فایل متفاوت است؛ صفحه‌ی منبع را بررسی کن.'
    };
  } catch (primaryError) {
    console.warn('Internet Archive Advanced Search failed; trying the lighter Scraping API.', primaryError);
    try {
      // This is the documented public fallback endpoint and avoids the slow sorted Advanced Search request.
      return await searchInternetArchiveScrape(q, '', rows, true);
    } catch (fallbackError) {
      fallbackError.code = fallbackError.code || primaryError.code || 'IA_SEARCH_FAILED';
      fallbackError.message = 'جست‌وجوی Internet Archive پاسخ نداد؛ مسیر جایگزین هم موفق نشد. اگر این عبارت قبلاً جست‌وجو شده، نتیجه‌ی ذخیره‌شده نمایش داده می‌شود. در غیر این صورت چند لحظه بعد دوباره امتحان کن.';
      throw fallbackError;
    }
  }
}

async function resolveInternetArchiveTrackStatic(identifier) {
  const id = archiveIdentifier(identifier);
  if (!id) throw new Error('شناسه‌ی اجرای موسیقی معتبر نیست.');
  const metadata = await fetchInternetArchiveJSON(`${IA_METADATA_ENDPOINT}${encodeURIComponent(id)}`, 22000);
  const record = metadata?.metadata || {};
  if (!Object.keys(record).length) throw new Error('اطلاعات این اجرا در Internet Archive پیدا نشد.');
  const audioFiles = (Array.isArray(metadata.files) ? metadata.files : []).map(file => {
    const name = String(file?.name || '');
    const extension = name.match(/\.[^.\/]+$/)?.[0]?.toLowerCase() || '';
    const priority = IA_AUDIO_PRIORITY[extension] || 0;
    if (!name || !priority || file.private === true || file.private === 'true' || /(metadata|thumbnail|cover|item tile|torrent|text)/i.test(String(file.format || ''))) return null;
    return { file, name, extension, priority };
  }).filter(Boolean).sort((a,b) => b.priority - a.priority);
  const chosen = audioFiles[0] || null;
  const toText = value => Array.isArray(value) ? value.filter(Boolean).map(String).join(', ') : (value == null ? '' : String(value));
  const licenseUrl = toText(record.licenseurl || record.license_url || '');
  const result = { identifier: id, title: toText(record.title) || id, creator: toText(record.creator || record.artist || record.album_artist) || 'اجراکننده در فراداده ثبت نشده', description: toText(record.description).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 800), date: toText(record.date || record.year), licenseUrl: /^https?:\/\//i.test(licenseUrl) ? licenseUrl : '', rights: toText(record.rights || record.license), thumbnail: `https://archive.org/services/img/${encodeURIComponent(id)}`, itemUrl: `https://archive.org/details/${encodeURIComponent(id)}`, source: 'Internet Archive', embedUrl: `https://archive.org/embed/${encodeURIComponent(id)}` };
  if (chosen) {
    const safePath = chosen.name.split('/').map(part => encodeURIComponent(part)).join('/');
    result.audioUrl = `https://archive.org/download/${encodeURIComponent(id)}/${safePath}`;
    result.fileName = chosen.name;
    result.format = toText(chosen.file.format) || chosen.extension.toUpperCase().slice(1);
    result.mimeType = ({'.mp3':'audio/mpeg','.m4a':'audio/mp4','.aac':'audio/aac','.ogg':'audio/ogg','.oga':'audio/ogg','.opus':'audio/ogg','.wav':'audio/wav','.flac':'audio/flac','.aiff':'audio/aiff','.aif':'audio/aiff'})[chosen.extension] || 'application/octet-stream';
    result.playbackMode = 'audio';
  } else result.playbackMode = 'archive-player';
  return result;
}

// Classical Listening Room — Internet Archive public audio search and playback.
// This GitHub Pages edition requests the public JSON APIs directly from the browser.
function musicMessageForError(payload, status) {
  const code = payload?.code || '';
  if (code === 'QUERY_TOO_SHORT') return 'نام قطعه یا آهنگ‌ساز را با حداقل دو نویسه وارد کن.';
  if (code === 'ARCHIVE_ITEM_NOT_FOUND') return 'اطلاعات این اجرا در آرشیو پیدا نشد؛ یک اجرای دیگر را امتحان کن.';
  if (status === 429) return 'درخواست‌های جست‌وجو زیاد شده‌اند؛ کمی بعد دوباره امتحان کن.';
  if (status === 502 || status === 504) return payload?.detail
    ? `اتصال سرور به Internet Archive ناموفق بود: ${payload.detail}`
    : 'اتصال به Internet Archive ناموفق بود. اتصال اینترنت سرور را بررسی کن.';
  return payload?.error || `درخواست موسیقی ناموفق بود (HTTP ${status || 'نامشخص'}).`;
}

function archiveIdentifier(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9._-]{1,80}$/.test(id) ? id : '';
}

function resetMusicPlayer() {
  const audio = $('#music-player-audio');
  const frame = $('#music-player-frame');
  audio.pause();
  audio.removeAttribute('src');
  audio.dataset.archiveEmbedUrl = '';
  audio.dataset.archiveEmbedUsed = 'false';
  audio.load();
  audio.hidden = true;
  frame.src = 'about:blank';
  frame.hidden = true;
  $('#music-player-cover').hidden = true;
  $('#music-player-empty').hidden = false;
  $('#music-player-empty p').textContent = 'اتاق شنیدن';
  $('#music-player-empty small').textContent = 'برای پخش، یکی از اجراها را انتخاب کن.';
  $('#music-now-title').textContent = 'هنوز اجرایی انتخاب نشده';
  $('#music-now-channel').textContent = 'از نتایج یک اجرا را انتخاب کن.';
  $('#music-license-info').textContent = 'اطلاعات مجوز پس از انتخاب اجرا نمایش داده می‌شود.';
  $('#music-license-link').hidden = true;
  $('#music-open-archive').hidden = true;
  $('#music-player-index').textContent = '—';
  $('#music-queue-count').textContent = musicResults.length ? `${faNum(musicResults.length)} اجرا در صف` : 'صف پخش خالی است';
  $('#music-prev-track').disabled = true;
  $('#music-next-track').disabled = musicResults.length < 2;
}

function renderMusicResults() {
  const grid = $('#music-results');
  if (!grid) return;
  if (!musicResults.length) {
    grid.innerHTML = '<div class="music-empty-state"><span class="music-note-mark">♫</span><strong>نتیجه‌ای نمایش داده نشده</strong><p>عبارت دیگری امتحان کن؛ مثلاً نام آهنگ‌ساز به‌همراه نام قطعه.</p></div>';
    $('#music-results-count').textContent = '۰ اجرا';
    $('#music-load-more').hidden = !musicNextPageToken;
    return;
  }
  grid.innerHTML = musicResults.map((item, index) => {
    const active = index === musicActiveIndex;
    const thumbnail = safeHttpUrl(item.thumbnail) || '';
    const title = escapeHTML(item.title || 'Untitled recording');
    const creator = escapeHTML(item.creator || 'اجراکننده ثبت نشده');
    const description = escapeHTML((item.description || item.subject || '').replace(/\s+/g, ' ').slice(0, 145));
    const sourceUrl = safeHttpUrl(item.itemUrl) || `https://archive.org/details/${encodeURIComponent(item.identifier)}`;
    return `<article class="music-track-card${active ? ' active' : ''}">
      <button class="music-track-select" type="button" data-music-index="${index}" aria-label="انتخاب ${title}">
        <span class="music-track-thumb">${thumbnail ? `<img src="${escapeHTML(thumbnail)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<span class="music-thumb-placeholder">♫</span>'}<span class="music-play-overlay" aria-hidden="true">▶</span></span>
        <span class="music-track-copy"><span class="music-track-overline">INTERNET ARCHIVE · ${String(index + 1).padStart(2, '0')}</span><strong>${title}</strong><span class="music-track-channel">${creator}</span><span class="music-track-description">${description || 'برای آماده‌کردن پخش، این اجرا را انتخاب کن.'}</span></span>
      </button>
      <a class="music-track-external" href="${escapeHTML(sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="بازکردن منبع اصلی" title="صفحه‌ی منبع">↗</a>
    </article>`;
  }).join('');
  // Remove broken thumbnails without leaving the browser's broken-image icon visible.
  $$('.music-track-thumb img').forEach(img => img.addEventListener('error', () => img.remove(), { once: true }));
  $('#music-results-count').textContent = `${faNum(musicResults.length)} مورد`;
  $('#music-load-more').hidden = !musicNextPageToken;
  $('#music-load-more').disabled = false;
}

async function selectMusicTrack(index) {
  const item = musicResults[index];
  const id = archiveIdentifier(item?.identifier);
  if (!item || !id) return;
  const requestId = ++musicTrackRequestId;
  musicActiveIndex = index;
  $$('.music-track-card').forEach((card, cardIndex) => card.classList.toggle('active', cardIndex === index));
  const audio = $('#music-player-audio');
  const frame = $('#music-player-frame');
  audio.pause();
  audio.hidden = true;
  frame.src = 'about:blank';
  frame.hidden = true;
  $('#music-player-empty').hidden = false;
  $('#music-player-cover').hidden = true;
  $('#music-player-empty p').textContent = 'در حال آماده‌کردن اجرا…';
  $('#music-player-empty small').textContent = 'داریم فایل صوتی قابل‌پخش را در آرشیو پیدا می‌کنیم.';
  $('#music-now-title').textContent = item.title || 'Untitled recording';
  $('#music-now-channel').textContent = item.creator || 'Internet Archive';
  const openLink = $('#music-open-archive');
  openLink.href = safeHttpUrl(item.itemUrl) || `https://archive.org/details/${encodeURIComponent(id)}`;
  openLink.hidden = false;
  $('#music-player-index').textContent = `${String(index + 1).padStart(2, '0')} / ${String(musicResults.length).padStart(2, '0')}`;
  $('#music-queue-count').textContent = `${faNum(index + 1)} از ${faNum(musicResults.length)} مورد`;
  $('#music-prev-track').disabled = index <= 0;
  $('#music-next-track').disabled = index >= musicResults.length - 1;
  $('#music-status').classList.remove('error', 'warning');
  $('#music-status').textContent = 'در حال بررسی فراداده و آماده‌کردن پخش…';

  try {
    let track = musicTrackCache.get(id);
    if (!track) {
      track = await resolveInternetArchiveTrackStatic(id);
      musicTrackCache.set(id, track);
    }
    if (requestId !== musicTrackRequestId) return;
    $('#music-now-title').textContent = track.title || item.title || 'Untitled recording';
    const creator = track.creator || item.creator || 'Internet Archive';
    const format = track.format ? ` · ${track.format}` : '';
    $('#music-now-channel').textContent = `${creator}${format}`;
    const licenseInfo = $('#music-license-info');
    const licenseLink = $('#music-license-link');
    licenseInfo.textContent = track.rights || (track.licenseUrl ? 'فراداده‌ی مجوز برای این مورد موجود است.' : 'مجوز در فراداده مشخص نشده؛ شرایط را در صفحه‌ی منبع بررسی کن.');
    if (track.licenseUrl && /^https?:\/\//i.test(track.licenseUrl)) { licenseLink.href = track.licenseUrl; licenseLink.hidden = false; }
    else { licenseLink.hidden = true; }
    const cover = $('#music-player-cover');
    const coverUrl = safeHttpUrl(track.thumbnail || item.thumbnail);
    if (coverUrl) {
      cover.src = coverUrl;
      cover.alt = `${track.title || item.title} — تصویر آرشیو`;
      cover.hidden = false;
      cover.addEventListener('error', () => { cover.hidden = true; }, { once: true });
    }
    $('#music-player-empty').hidden = true;
    if (track.audioUrl && safeHttpUrl(track.audioUrl)) {
      audio.dataset.archiveEmbedUrl = safeHttpUrl(track.embedUrl) || '';
      audio.dataset.archiveEmbedUsed = 'false';
      audio.src = track.audioUrl;
      audio.hidden = false;
      audio.load();
      try {
        await audio.play();
        if (requestId !== musicTrackRequestId) return;
        $('#music-status').textContent = 'پخش از فایل صوتی موجود در Internet Archive؛ برای اطلاعات مجوز، صفحه‌ی منبع را بررسی کن.';
      } catch (playError) {
        // Autoplay can be refused by browser policy; native controls remain available.
        if (requestId !== musicTrackRequestId) return;
        $('#music-status').textContent = 'فایل آماده است. برای شروع پخش، دکمه‌ی پخش را در کنترل صوتی بزن.';
      }
    } else if (track.embedUrl && safeHttpUrl(track.embedUrl)) {
      cover.hidden = true;
      frame.src = track.embedUrl;
      frame.title = `${track.title || item.title} — Internet Archive player`;
      frame.hidden = false;
      $('#music-status').textContent = 'این مورد فایل صوتی مستقیم قابل‌پخش نداشت؛ پلیر خود Internet Archive نمایش داده شده است.';
    } else {
      throw new Error('برای این مورد فایل صوتی مناسب یا پلیر تعبیه‌شده پیدا نشد. مورد دیگری را امتحان کن.');
    }
  } catch (error) {
    if (requestId !== musicTrackRequestId) return;
    console.warn('Atelier track preparation failed:', error);
    // If metadata lookup stalls, the archive's own embedded player may still be able to play this item.
    if (error?.code === 'IA_TIMEOUT' || error?.code === 'IA_NETWORK') {
      frame.src = `https://archive.org/embed/${encodeURIComponent(id)}`;
      frame.title = `${item.title || 'Classical recording'} — Internet Archive player`;
      frame.hidden = false;
      $('#music-player-empty').hidden = true;
      $('#music-player-cover').hidden = true;
      $('#music-status').textContent = 'دریافت اطلاعات فایل کند بود؛ پلیر خود Internet Archive را امتحان کن.';
      $('#music-status').classList.add('warning');
      return;
    }
    $('#music-player-empty').hidden = false;
    $('#music-player-empty p').textContent = 'این اجرا فعلاً قابل پخش نیست';
    $('#music-player-empty small').textContent = 'یک نتیجه‌ی دیگر را امتحان کن یا منبع را باز کن.';
    $('#music-player-cover').hidden = true;
    $('#music-status').textContent = error.message || 'آماده‌کردن پخش ناموفق بود.';
    $('#music-status').classList.add('warning');
  }
}

async function searchClassicalMusic(query, { append = false, pageToken = '' } = {}) {
  const cleanedQuery = String(query || '').trim().slice(0, 180);
  if (!cleanedQuery) {
    $('#music-status').textContent = 'نام یک قطعه یا آهنگ‌ساز را وارد کن؛ مثلاً «Clair de Lune Debussy».';
    $('#music-query')?.focus();
    return;
  }
  const requestId = ++musicSearchRequestId;
  musicCurrentQuery = cleanedQuery;
  $('#music-query').value = cleanedQuery;
  $('#music-search-button').disabled = true;
  $('#music-load-more').disabled = true;
  $('#music-status').classList.remove('error', 'warning');
  $('#music-status').textContent = append ? 'در حال دریافت نتایج بیشتر از آرشیو…' : 'در حال جست‌وجوی آرشیو موسیقی…';
  $('#music-results-title').textContent = `جست‌وجو: ${cleanedQuery}`;
  const cacheKey = `${cleanedQuery.toLocaleLowerCase()}|${pageToken}`;
  try {
    let cached = musicSearchCache.get(cacheKey);
    const now = Date.now();
    const diskCached = readPersistentMusicSearch(cacheKey);
    if (!cached || now - cached.savedAt > 5 * 60 * 1000) {
      if (diskCached && now - Number(diskCached.savedAt || 0) < MUSIC_SEARCH_CACHE_TTL) {
        cached = diskCached;
        musicSearchCache.set(cacheKey, cached);
      } else {
        try {
          const data = await searchInternetArchiveStatic(cleanedQuery, pageToken, 12);
          cached = { data, savedAt: Date.now() };
          musicSearchCache.set(cacheKey, cached);
          savePersistentMusicSearch(cacheKey, cached);
        } catch (searchError) {
          // If the public archive is slow today, preserve working results from a previous visit.
          if (diskCached && Array.isArray(diskCached.data?.items) && diskCached.data.items.length) {
            cached = { ...diskCached, staleFallback: true };
            musicSearchCache.set(cacheKey, cached);
          } else {
            throw searchError;
          }
        }
      }
    }
    if (requestId !== musicSearchRequestId) return;
    const data = cached.data || {};
    const items = (Array.isArray(data.items) ? data.items : []).filter(item => archiveIdentifier(item.identifier));
    musicResults = append ? musicResults.concat(items) : items;
    musicNextPageToken = String(data.nextPageToken || '');
    if (!append) {
      musicActiveIndex = -1;
      musicTrackRequestId++;
      resetMusicPlayer();
    }
    renderMusicResults();
    if (cached.staleFallback) {
      $('#music-status').textContent = 'Internet Archive فعلاً کند است؛ نتیجه‌های ذخیره‌شده‌ی قبلی برای همین جست‌وجو نمایش داده شده‌اند.';
      $('#music-status').classList.remove('error');
      $('#music-status').classList.add('warning');
    } else if (musicResults.length) {
      $('#music-status').textContent = `${faNum(musicResults.length)} مورد برای «${cleanedQuery}» در Internet Archive پیدا شد. روی یک مورد بزن تا فایل صوتی آن بررسی و پخش شود.`;
      $('#music-status').classList.remove('error', 'warning');
    } else {
      $('#music-status').textContent = 'نتیجه‌ای پیدا نشد. نام آهنگ‌ساز یا قطعه را کوتاه‌تر یا به انگلیسی جست‌وجو کن.';
      $('#music-status').classList.add('warning');
    }
  } catch (error) {
    if (requestId !== musicSearchRequestId) return;
    console.warn('Atelier music search failed:', error);
    $('#music-status').textContent = error.message || 'جست‌وجوی موسیقی ناموفق بود.';
    $('#music-status').classList.add('error');
    if (!append) {
      musicResults = [];
      musicNextPageToken = '';
      renderMusicResults();
    }
  } finally {
    if (requestId === musicSearchRequestId) {
      $('#music-search-button').disabled = false;
      $('#music-load-more').disabled = false;
    }
  }
}

$('#music-search-form')?.addEventListener('submit', event => {
  event.preventDefault();
  searchClassicalMusic($('#music-query').value);
});
$$('[data-music-query]').forEach(button => button.addEventListener('click', () => searchClassicalMusic(button.dataset.musicQuery)));
$('#music-load-more')?.addEventListener('click', () => {
  if (musicNextPageToken) searchClassicalMusic(musicCurrentQuery, { append: true, pageToken: musicNextPageToken });
});
$('#music-results')?.addEventListener('click', event => {
  const select = event.target.closest('[data-music-index]');
  if (select) selectMusicTrack(Number(select.dataset.musicIndex));
});
$('#music-prev-track')?.addEventListener('click', () => selectMusicTrack(musicActiveIndex - 1));
$('#music-next-track')?.addEventListener('click', () => selectMusicTrack(musicActiveIndex + 1));
$('#music-player-audio')?.addEventListener('error', () => {
  const audio = $('#music-player-audio');
  if (audio.hidden) return;
  const embedUrl = safeHttpUrl(audio.dataset.archiveEmbedUrl || '');
  if (embedUrl && audio.dataset.archiveEmbedUsed !== 'true') {
    audio.dataset.archiveEmbedUsed = 'true';
    audio.pause();
    audio.hidden = true;
    $('#music-player-cover').hidden = true;
    const frame = $('#music-player-frame');
    frame.src = embedUrl;
    frame.title = `${$('#music-now-title').textContent} — Internet Archive player`;
    frame.hidden = false;
    $('#music-player-empty').hidden = true;
    $('#music-status').textContent = 'پخش مستقیم این فایل ناموفق بود؛ پلیر خود Internet Archive جایگزین شده است.';
    $('#music-status').classList.add('warning');
  } else {
    $('#music-status').textContent = 'فایل صوتی مستقیم و پلیر جایگزین در دسترس نیستند؛ منبع را باز کن یا اجرای دیگری را انتخاب کن.';
    $('#music-status').classList.add('warning');
  }
});

// Initialise the personal workspace. Museum API requests are lazy-loaded when
// the user opens Artworks or Artists; the homepage hero remains visually stable.
renderAll();
renderArtistDirectory();
renderHomeArtistRail();
selectSpotlight('botticelli', false);
hydrateArtistImages();
