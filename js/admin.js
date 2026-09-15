// ---------- Admin gallery management ----------
let adminUser = null;
let currentImages = []; // in-memory ordered list: {id, image_url, caption, storage_path, sort_order}
let orderDirty = false;
let dragSrcId = null;

const adminSignedOut = document.getElementById('adminSignedOut');
const adminUnauthorized = document.getElementById('adminUnauthorized');
const adminPanel = document.getElementById('adminPanel');
const adminSigninBtn = document.getElementById('adminSigninBtn');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const captionInput = document.getElementById('captionInput');
const uploadStatus = document.getElementById('uploadStatus');
const adminGrid = document.getElementById('adminGrid');
const emptyNote = document.getElementById('emptyNote');
const saveOrderBtn = document.getElementById('saveOrderBtn');
const orderStatus = document.getElementById('orderStatus');

adminSigninBtn.addEventListener('click', () => {
  supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href.split('#')[0] }
  });
});

function renderAdminState(){
  adminSignedOut.style.display = 'none';
  adminUnauthorized.style.display = 'none';
  adminPanel.style.display = 'none';

  if (!adminUser) {
    adminSignedOut.style.display = 'block';
    return;
  }
  if (!OWNER_EMAILS.includes(adminUser.email)) {
    adminUnauthorized.style.display = 'block';
    return;
  }
  adminPanel.style.display = 'block';
  loadGalleryImages();
}

async function loadGalleryImages(){
  const { data, error } = await supabaseClient
    .from('gallery_images')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    adminGrid.innerHTML = '';
    emptyNote.style.display = 'block';
    emptyNote.textContent = "Couldn't load photos.";
    saveOrderBtn.style.display = 'none';
    return;
  }

  currentImages = data || [];
  orderDirty = false;
  renderAdminGrid();
}

function renderAdminGrid(){
  if (!currentImages.length) {
    adminGrid.innerHTML = '';
    emptyNote.style.display = 'block';
    emptyNote.textContent = 'No uploaded photos yet.';
    saveOrderBtn.style.display = 'none';
    return;
  }
  emptyNote.style.display = 'none';
  saveOrderBtn.style.display = orderDirty ? 'block' : 'none';

  adminGrid.innerHTML = currentImages.map((img, i) => `
    <div class="admin-photo" draggable="true" data-id="${img.id}">
      <div class="admin-photo-img">
        <img src="${img.image_url}" alt="${img.caption || ''}">
        <span class="order-badge">${i + 1}</span>
        <button class="del-btn" aria-label="Delete photo">×</button>
      </div>
      <input type="text" class="admin-photo-caption" placeholder="Add a caption…" value="${(img.caption || '').replace(/"/g, '&quot;')}" data-id="${img.id}">
    </div>
  `).join('');

  adminGrid.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('.admin-photo');
      const id = card.dataset.id;
      const img = currentImages.find(i => i.id === id);
      if (!img || !confirm('Delete this photo? This cannot be undone.')) return;
      btn.disabled = true;
      await supabaseClient.storage.from('gallery').remove([img.storage_path]);
      await supabaseClient.from('gallery_images').delete().eq('id', id);
      loadGalleryImages();
    });
  });

  adminGrid.querySelectorAll('.admin-photo-caption').forEach(input => {
    input.addEventListener('change', async () => {
      const id = input.dataset.id;
      await supabaseClient.from('gallery_images').update({ caption: input.value.trim() || null }).eq('id', id);
      const img = currentImages.find(i => i.id === id);
      if (img) img.caption = input.value.trim() || null;
    });
  });

  setupDragAndDrop();
}

function setupDragAndDrop(){
  const cards = adminGrid.querySelectorAll('.admin-photo');
  cards.forEach(card => {
    card.addEventListener('dragstart', () => {
      dragSrcId = card.dataset.id;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      cards.forEach(c => c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (card.dataset.id !== dragSrcId) card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetId = card.dataset.id;
      if (!dragSrcId || dragSrcId === targetId) return;

      const fromIndex = currentImages.findIndex(i => i.id === dragSrcId);
      const toIndex = currentImages.findIndex(i => i.id === targetId);
      const [moved] = currentImages.splice(fromIndex, 1);
      currentImages.splice(toIndex, 0, moved);

      orderDirty = true;
      renderAdminGrid();
    });
  });
}

saveOrderBtn.addEventListener('click', async () => {
  saveOrderBtn.disabled = true;
  orderStatus.textContent = 'Saving order…';
  const updates = currentImages.map((img, i) =>
    supabaseClient.from('gallery_images').update({ sort_order: i + 1 }).eq('id', img.id)
  );
  await Promise.all(updates);
  currentImages.forEach((img, i) => { img.sort_order = i + 1; });
  orderDirty = false;
  saveOrderBtn.disabled = false;
  orderStatus.textContent = 'Order saved — the live site now reflects this arrangement.';
  renderAdminGrid();
  setTimeout(() => { orderStatus.textContent = ''; }, 4000);
});

async function uploadFiles(files){
  if (!files.length) return;
  uploadStatus.textContent = `Uploading ${files.length} photo${files.length > 1 ? 's' : ''}…`;

  // New uploads always go to the back of the current order.
  let nextOrder = currentImages.reduce((max, img) => Math.max(max, img.sort_order || 0), 0) + 1;

  let successCount = 0;
  for (const file of files) {
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const { error: uploadError } = await supabaseClient.storage.from('gallery').upload(path, file);
    if (uploadError) continue;

    const { data: urlData } = supabaseClient.storage.from('gallery').getPublicUrl(path);
    const { error: insertError } = await supabaseClient.from('gallery_images').insert({
      image_url: urlData.publicUrl,
      storage_path: path,
      caption: captionInput.value.trim() || null,
      sort_order: nextOrder
    });
    if (!insertError) { successCount++; nextOrder++; }
  }

  uploadStatus.textContent = successCount === files.length
    ? `Uploaded ${successCount} photo${successCount > 1 ? 's' : ''} to the end of the gallery.`
    : `Uploaded ${successCount} of ${files.length}. Some failed — try again.`;
  captionInput.value = '';
  fileInput.value = '';
  loadGalleryImages();
}

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => uploadFiles(Array.from(fileInput.files)));
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  uploadFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
});

supabaseClient.auth.getSession().then(({ data: { session } }) => {
  adminUser = session?.user || null;
  renderAdminState();
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
  adminUser = session?.user || null;
  renderAdminState();
});
