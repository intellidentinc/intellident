// Guardrail: this module holds the Supabase service-role key. `server-only` makes any
// accidental client-side import a build error instead of silently shipping a broken
// (undefined-keyed) client to the browser.
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
