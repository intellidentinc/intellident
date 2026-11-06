import { supabase } from '@/lib/supabase';

export async function ensurePrivateBucket(bucket) {
  let result = await supabase.storage.getBucket(bucket);
  if (result.error) {
    const created = await supabase.storage.createBucket(bucket, { public: false });
    if (created.error) throw new Error('Private storage is unavailable');
    result = await supabase.storage.getBucket(bucket);
  }
  if (result.error || !result.data) throw new Error('Private storage is unavailable');
  if (result.data.public) {
    const updated = await supabase.storage.updateBucket(bucket, { public: false });
    if (updated.error) throw new Error('Private storage is unavailable');
    result = await supabase.storage.getBucket(bucket);
  }
  if (result.error || result.data?.public !== false) throw new Error('Private storage is unavailable');
}

export async function removeStorageObjects(bucket, paths) {
  for (let offset = 0; offset < paths.length; offset += 100) {
    const result = await supabase.storage.from(bucket).remove(paths.slice(offset, offset + 100));
    if (result.error) throw new Error('Storage deletion failed');
  }
}
