// ---------- Auth + Comments ----------
// Relies on supabaseClient from supabase-config.js

let currentUser = null;
let currentImageId = null;

const authBtn = document.getElementById('authBtn');
const authBtnLabel = document.getElementById('authBtnLabel');
const authBtnMobile = document.getElementById('authBtnMobile');
const authBtnMobileLabel = document.getElementById('authBtnMobileLabel');
const commentsSigninBtn = document.getElementById('commentsSigninBtn');
const commentsList = document.getElementById('commentsList');
const commentsCount = document.getElementById('commentsCount');
const commentsComposeSignedIn = document.getElementById('commentsComposeSignedIn');
const commentsSigninPrompt = document.getElementById('commentsSigninPrompt');
const composerAvatar = document.getElementById('composerAvatar');
const commentInput = document.getElementById('commentInput');
const commentSubmit = document.getElementById('commentSubmit');

function imageIdFromSrc(src){
  // Use just the filename as the stable identifier for a picture, e.g. "g01.jpg"
  return src.split('/').pop();
}

function signInWithGoogle(){
  supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href.split('#')[0] }
  });
}

function signOut(){
  supabaseClient.auth.signOut();
}

const authAvatar = document.getElementById('authAvatar');
const authGoogleIcon = document.getElementById('authGoogleIcon');
const authAvatarMobile = document.getElementById('authAvatarMobile');
const authGoogleIconMobile = document.getElementById('authGoogleIconMobile');

function firstName(user){
  const full = user.user_metadata?.full_name || user.user_metadata?.name;
  if (full) return full.split(' ')[0];
  return user.email ? user.email.split('@')[0] : 'there';
}

function renderAuthUI(){
  const signedIn = !!currentUser;
  authBtnLabel.textContent = signedIn ? `Hi, ${firstName(currentUser)}` : 'Sign In';
  authBtnMobileLabel.textContent = signedIn ? `Hi, ${firstName(currentUser)}` : 'Sign In';
  authBtn.title = signedIn ? 'Click to sign out' : '';
  authBtnMobile.title = authBtn.title;

  const avatarUrl = currentUser?.user_metadata?.avatar_url || '';
  [ [authAvatar, authGoogleIcon], [authAvatarMobile, authGoogleIconMobile] ].forEach(([imgEl, iconEl]) => {
    if (signedIn && avatarUrl) {
      imgEl.src = avatarUrl;
      imgEl.style.display = 'block';
      iconEl.style.display = 'none';
    } else {
      imgEl.style.display = 'none';
      iconEl.style.display = 'block';
    }
  });

  commentsComposeSignedIn.style.display = signedIn ? 'flex' : 'none';
  commentsSigninPrompt.style.display = signedIn ? 'none' : 'flex';
  if (signedIn) {
    composerAvatar.src = currentUser.user_metadata?.avatar_url || 'images/logo.png';
  }

  const galleryEl = document.getElementById('gallery');
  const galleryLockEl = document.getElementById('galleryLock');
  if (galleryEl && galleryLockEl) {
    galleryEl.style.display = signedIn ? '' : 'none';
    galleryLockEl.style.display = signedIn ? 'none' : 'flex';
  }

  const isOwner = signedIn && OWNER_EMAILS.includes(currentUser.email);
  const adminLink = document.getElementById('adminLink');
  if (adminLink) adminLink.style.display = isOwner ? 'inline' : 'none';
  const adminNavItem = document.getElementById('adminNavItem');
  if (adminNavItem) adminNavItem.style.display = isOwner ? 'list-item' : 'none';
  const adminLinkMobile = document.getElementById('adminLinkMobile');
  if (adminLinkMobile) adminLinkMobile.style.display = isOwner ? 'block' : 'none';

  renderAllGalleryLikeStates();
  if (currentImageId) loadLike(currentImageId);
}

const galleryLockBtn = document.getElementById('galleryLockBtn');
if (galleryLockBtn) galleryLockBtn.addEventListener('click', signInWithGoogle);

authBtn.addEventListener('click', () => { currentUser ? signOut() : signInWithGoogle(); });
authBtnMobile.addEventListener('click', () => { currentUser ? signOut() : signInWithGoogle(); });
commentsSigninBtn.addEventListener('click', signInWithGoogle);

async function loadComments(imageId){
  commentsList.innerHTML = '<div class="comments-loading">Loading comments…</div>';
  const { data, error } = await supabaseClient
    .from('comments')
    .select('*')
    .eq('image_id', imageId)
    .order('created_at', { ascending: true });

  if (error) {
    commentsList.innerHTML = '<div class="comments-loading">Couldn\'t load comments.</div>';
    return;
  }

  commentsCount.textContent = data.length;
  if (data.length === 0) {
    commentsList.innerHTML = '<div class="comments-empty">No comments yet — be the first.</div>';
    return;
  }

  commentsList.innerHTML = data.map(c => `
    <div class="comment-item" data-id="${c.id}">
      <img class="comment-avatar" src="${c.user_avatar || 'images/logo.png'}" alt="">
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-name">${escapeHtml(c.user_name)}</span>
          <span class="comment-time">${timeAgo(c.created_at)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
      </div>
      ${currentUser && currentUser.id === c.user_id ? `<button class="comment-delete" data-id="${c.id}" aria-label="Delete comment">×</button>` : ''}
    </div>
  `).join('');

  commentsList.querySelectorAll('.comment-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabaseClient.from('comments').delete().eq('id', btn.dataset.id);
      loadComments(currentImageId);
    });
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(iso){
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const units = [['year',31536000],['month',2592000],['day',86400],['hour',3600],['minute',60]];
  for (const [name, secs] of units) {
    const val = Math.floor(seconds / secs);
    if (val >= 1) return `${val} ${name}${val > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

async function postComment(){
  const content = commentInput.value.trim();
  if (!content || !currentUser) return;
  commentSubmit.disabled = true;
  const { error } = await supabaseClient.from('comments').insert({
    image_id: currentImageId,
    user_id: currentUser.id,
    user_name: currentUser.user_metadata?.full_name || currentUser.email || 'Anonymous',
    user_avatar: currentUser.user_metadata?.avatar_url || null,
    content
  });
  commentSubmit.disabled = false;
  if (!error) {
    commentInput.value = '';
    loadComments(currentImageId);
  }
}

commentSubmit.addEventListener('click', postComment);
commentInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') postComment();
});

// Called by script.js whenever the lightbox image changes
window.onLightboxImageChange = function(src){
  currentImageId = imageIdFromSrc(src);
  loadComments(currentImageId);
  loadLike(currentImageId);
};

// ---------- Likes ----------
const lbLikeBtn = document.getElementById('lbLikeBtn');
const lbLikeIcon = document.getElementById('lbLikeIcon');
const lbLikeCount = document.getElementById('lbLikeCount');

async function getLikeCount(imageId){
  const { count } = await supabaseClient
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('image_id', imageId);
  return count || 0;
}

async function getUserLiked(imageId){
  if (!currentUser) return false;
  const { data } = await supabaseClient
    .from('likes')
    .select('id')
    .eq('image_id', imageId)
    .eq('user_id', currentUser.id)
    .maybeSingle();
  return !!data;
}

async function loadLike(imageId){
  const [count, liked] = await Promise.all([getLikeCount(imageId), getUserLiked(imageId)]);
  lbLikeCount.textContent = count;
  lbLikeBtn.classList.toggle('is-liked', liked);
  const thumbBtn = document.querySelector(`.g-like[data-image-id="${imageId}"]`);
  if (thumbBtn) {
    thumbBtn.querySelector('.g-like-count').textContent = count;
    thumbBtn.classList.toggle('is-liked', liked);
  }
}

async function toggleLike(imageId, btn){
  if (!currentUser) { signInWithGoogle(); return; }
  const liked = btn.classList.contains('is-liked');
  btn.classList.toggle('is-liked', !liked);
  if (liked) {
    await supabaseClient.from('likes').delete().eq('image_id', imageId).eq('user_id', currentUser.id);
  } else {
    await supabaseClient.from('likes').insert({ image_id: imageId, user_id: currentUser.id });
  }
  loadLike(imageId);
}

lbLikeBtn.addEventListener('click', () => {
  if (currentImageId) toggleLike(currentImageId, lbLikeBtn);
});

async function renderAllGalleryLikeStates(){
  document.querySelectorAll('.g-like').forEach(btn => {
    loadLike(btn.dataset.imageId);
  });
}

document.addEventListener('click', (e) => {
  const likeBtn = e.target.closest('.g-like');
  if (likeBtn) toggleLike(likeBtn.dataset.imageId, likeBtn);
});

window.onGalleryRendered = function(){
  renderAllGalleryLikeStates();
};

// ---------- Session bootstrap ----------
supabaseClient.auth.getSession().then(({ data: { session } }) => {
  currentUser = session?.user || null;
  renderAuthUI();
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  renderAuthUI();
  if (currentImageId) loadComments(currentImageId);
});
