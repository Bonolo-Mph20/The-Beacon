// One-time script: uploads the existing images/ folder into Supabase Storage
// and creates matching rows in gallery_images, so the live site starts
// serving everything from the bucket instead of the repo.
//
// HOW TO RUN THIS (do this on your own computer, never paste your service
// role key into a chat with anyone, including Claude):
//
// 1. Make sure Node.js is installed (node -v to check).
// 2. In this project folder, run:  npm install @supabase/supabase-js
// 3. Get your SERVICE ROLE key (not the anon key) from:
//    Supabase Dashboard -> Settings -> API -> "service_role" (secret) key.
//    This key bypasses all security rules, so keep it private and only use
//    it locally for this one-off script.
// 4. Run it like this, filling in your own values:
//
//    SUPABASE_URL="https://syswfuuosozomnfnwaiv.supabase.co" \
//    SUPABASE_SERVICE_ROLE_KEY="paste-your-service-role-key-here" \
//    node migrate-images.js
//
// 5. When it finishes, check the "gallery" bucket and the gallery_images
//    table in Supabase — you should see all your existing photos there.
// 6. You can delete this file afterwards, it's only needed once.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. See the comment at the top of this file for instructions.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Same order as the site's original static list, so the gallery keeps
// looking the way it did before migration.
const files = [
  'g01.jpg','g02.jpg','g03.jpg','g04.jpg','g05.jpg','hero.jpg',
  'g06.jpg','g07.jpg','g08.jpg','g09.jpg','g10.jpg','g11.jpg',
  'g12.jpg','g13.jpg','g14.jpg','g15.jpg','g16.jpg','about.jpg'
];

async function run(){
  const imagesDir = path.join(__dirname, 'images');
  let order = 1;

  for (const filename of files) {
    const filePath = path.join(imagesDir, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${filename} (not found in images/)`);
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `seed-${Date.now()}-${filename}`;
    const ext = path.extname(filename).slice(1).toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const { error: uploadError } = await supabase.storage
      .from('gallery')
      .upload(storagePath, fileBuffer, { contentType });

    if (uploadError) {
      console.error(`Failed to upload ${filename}:`, uploadError.message);
      continue;
    }

    const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(storagePath);

    const { error: insertError } = await supabase.from('gallery_images').insert({
      image_url: urlData.publicUrl,
      storage_path: storagePath,
      caption: null,
      sort_order: order
    });

    if (insertError) {
      console.error(`Failed to insert row for ${filename}:`, insertError.message);
      continue;
    }

    console.log(`Migrated ${filename} (order ${order})`);
    order++;
  }

  console.log('Done. Check the gallery bucket and gallery_images table in Supabase.');
}

run();
