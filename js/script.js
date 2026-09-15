// ---------- Gallery data ----------
const staticImages = [
  "images/g01.jpg","images/g02.jpg","images/g03.jpg","images/g04.jpg",
  "images/g05.jpg","images/hero.jpg","images/g06.jpg","images/g07.jpg",
  "images/g08.jpg","images/g09.jpg","images/g10.jpg","images/g11.jpg",
  "images/g12.jpg","images/g13.jpg","images/g14.jpg","images/g15.jpg",
  "images/g16.jpg","images/about.jpg"
].map(src => ({ src, caption: null }));

let images = [...staticImages]; // each item: { src, caption }

const gallery = document.getElementById('gallery');

function renderGallery(){
  gallery.innerHTML = '';
  images.forEach((item, i) => {
    const fig = document.createElement('figure');
    fig.className = 'g-item';
    fig.dataset.index = i;
    fig.innerHTML = `
      <img src="${item.src}" alt="${item.caption || `Lesedi Monareng portfolio image ${i+1}`}">
      <button class="g-like" data-image-id="${item.src.split('/').pop()}" aria-label="Like this photo">
        <svg class="g-like-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7.5-4.8-10-9.5C0.3 8 1.8 4 6 4c2.2 0 3.8 1.3 6 4 2.2-2.7 3.8-4 6-4 4.2 0 5.7 4 4 7.5-2.5 4.7-10 9.5-10 9.5z"/></svg>
        <span class="g-like-count">0</span>
      </button>
      <span class="g-plus">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FBF7F1" stroke-width="1.6"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
      </span>
      ${item.caption ? `<span class="g-caption">${item.caption}</span>` : ''}`;
    gallery.appendChild(fig);
  });
  if (window.onGalleryRendered) window.onGalleryRendered();
}

renderGallery();

// Fetch owner-managed photos from Supabase. If any exist, they fully
// replace the static list (which stays in the repo as a fallback only,
// used if Supabase can't be reached).
async function loadDynamicGalleryImages(){
  try {
    const { data, error } = await supabaseClient
      .from('gallery_images')
      .select('image_url, caption')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    if (error || !data || !data.length) return; // keep static fallback already rendered
    images = data.map(row => ({ src: row.image_url, caption: row.caption }));
    renderGallery();
  } catch (e) {
    // Supabase not reachable — keep showing the static fallback set
  }
}
if (typeof supabaseClient !== 'undefined') loadDynamicGalleryImages();

// ---------- Lightbox ----------
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbCaption = document.getElementById('lbCaption');
let currentIndex = 0;

function setLightboxImage(i){
  const item = images[i];
  lbImg.src = item.src;
  if (lbCaption) {
    lbCaption.textContent = item.caption || '';
    lbCaption.style.display = item.caption ? 'block' : 'none';
  }
  const commentsPanelEl = document.getElementById('commentsPanel');
  if (commentsPanelEl) commentsPanelEl.classList.remove('mobile-visible');
  if (window.onLightboxImageChange) window.onLightboxImageChange(item.src);
}

function openLightbox(i){
  currentIndex = i;
  setLightboxImage(i);
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox(){
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}
function showDelta(delta){
  currentIndex = (currentIndex + delta + images.length) % images.length;
  setLightboxImage(currentIndex);
}

gallery.addEventListener('click', (e) => {
  if (e.target.closest('.g-like')) return;
  const item = e.target.closest('.g-item');
  if(item) openLightbox(parseInt(item.dataset.index));
});
document.getElementById('lbClose').addEventListener('click', closeLightbox);
document.getElementById('lbPrev').addEventListener('click', () => showDelta(-1));
document.getElementById('lbNext').addEventListener('click', () => showDelta(1));
lightbox.addEventListener('click', (e) => { if(e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => {
  if(!lightbox.classList.contains('open')) return;
  if(e.key === 'Escape') closeLightbox();
  if(e.key === 'ArrowLeft') showDelta(-1);
  if(e.key === 'ArrowRight') showDelta(1);
});

// ---------- Nav scroll state ----------
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive:true });

// ---------- Mobile menu ----------
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
navToggle.addEventListener('click', () => {
  navToggle.classList.toggle('open');
  mobileMenu.classList.toggle('open');
});
mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  navToggle.classList.remove('open');
  mobileMenu.classList.remove('open');
}));
document.getElementById('mobileMenuClose').addEventListener('click', () => {
  navToggle.classList.remove('open');
  mobileMenu.classList.remove('open');
});

// ---------- Scroll reveal ----------
const revealEls = document.querySelectorAll('.reveal:not(.is-visible)');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    }
  });
}, { threshold:0.15 });
revealEls.forEach(el => io.observe(el));

// ---------- Smooth anchor offset ----------
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', function(e){
    const id = this.getAttribute('href');
    if(id.length < 2) return;
    const target = document.querySelector(id);
    if(!target) return;
    e.preventDefault();
    const offset = 90;
    const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior:'smooth' });
  });
});

// ---------- Booking form (sends real emails via EmailJS) ----------
// EmailJS sends FROM a connected email account (e.g. your Gmail) TO
// whichever recipients the template specifies — so no access to the
// client's inbox is needed. The template itself is configured on
// emailjs.com to send to both admin emails (one as "To", one as "CC").
// Fill in these three values from your EmailJS dashboard:
const EMAILJS_PUBLIC_KEY = "aZuL12vsX12LN1bZnjEiz";
const EMAILJS_SERVICE_ID = "service_rw7q2ql";
const EMAILJS_TEMPLATE_ID = "template_vddmdgk";

emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

const form = document.getElementById('bookingForm');
const note = document.getElementById('formNote');
const submitBtn = form.querySelector('button[type="submit"]');
const defaultNoteText = note.textContent;

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Honeypot: if this hidden checkbox got checked, it's almost certainly a bot.
  if (document.getElementById('botcheck').checked) return;

  const name = document.getElementById('fname').value.trim();
  const email = document.getElementById('femail').value.trim();
  const message = document.getElementById('fmsg').value.trim();

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  note.classList.remove('show', 'is-error');

  try {
    const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      from_name: name,
      from_email: email,
      message
    });

    if (response.status !== 200) throw new Error('EmailJS reported a failed send');

    note.textContent = defaultNoteText;
    note.classList.add('show');
    form.reset();
  } catch (err) {
    console.error('Booking form send failed:', err);
    note.textContent = "Something went wrong sending your inquiry — please email booking@lesedimonareng.com directly instead.";
    note.classList.add('show', 'is-error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Inquiry';
  }
});

// ---------- Mobile lightbox gestures ----------
// Swipe left/right to move between photos, swipe up to reveal the
// comments sheet, swipe down to dismiss it. Only meaningful on touch
// devices at mobile widths — harmless no-op elsewhere.
(function(){
  const stage = document.querySelector('.lightbox-stage');
  const commentsPanelEl = document.getElementById('commentsPanel');
  if (!stage || !commentsPanelEl) return;

  let startX = 0, startY = 0, tracking = false;

  function isMobileViewport(){ return window.innerWidth <= 640; }

  stage.addEventListener('touchstart', (e) => {
    if (!isMobileViewport()) return;
    tracking = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  stage.addEventListener('touchend', (e) => {
    if (!isMobileViewport() || !tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    const threshold = 45;

    if (absX > absY && absX > threshold) {
      if (!commentsPanelEl.classList.contains('mobile-visible')) {
        showDelta(dx < 0 ? 1 : -1);
      }
    } else if (absY > absX && absY > threshold) {
      if (dy < 0) {
        commentsPanelEl.classList.add('mobile-visible');
      } else if (commentsPanelEl.classList.contains('mobile-visible')) {
        commentsPanelEl.classList.remove('mobile-visible');
      } else {
        closeLightbox();
      }
    }
  }, { passive: true });
})();
