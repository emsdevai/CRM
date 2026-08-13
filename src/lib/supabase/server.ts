'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ---------------------------------------------------------------------------
// Demo mock — returned by createClient() when NEXT_PUBLIC_DEMO_MODE=true.
// Every auth call returns a fake admin user; every DB query returns {data:[]}.
// ---------------------------------------------------------------------------
const DEMO_USER = {
  id: 'demo-admin-id',
  email: 'admin@jangirbros.com',
  user_metadata: { name: 'Prashant Hinger' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
}

const DEMO_PROFILE = {
  id: 'demo-admin-id',
  name: 'Prashant Hinger',
  email: 'admin@jangirbros.com',
  role: 'admin',
  manager_id: null,
  phone: '+91 98765 43210',
  annual_target: 5000000,
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

function makeDemoClient() {
  // A chainable query builder that always resolves to empty/demo data
  function queryChain(table?: string, singleData?: unknown) {
    const isSingle = singleData !== undefined

    // For profile table queries, return the demo profile
    const profileData = table === 'profiles' ? DEMO_PROFILE : null
    const listData = table === 'profiles' ? [DEMO_PROFILE] : []
    const defaultSingle = singleData !== undefined ? singleData : profileData
    const defaultList = listData

    const chain: Record<string, unknown> = {}
    const passthrough = () => chain

    ;[
      'select', 'insert', 'update', 'upsert', 'delete',
      'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'not', 'is',
      'or', 'filter', 'match', 'order', 'limit', 'range', 'returns',
    ].forEach((m) => { chain[m] = passthrough })

    // `.single()` resolves to the single-row result
    chain.single = () => queryChain(table, defaultSingle)
    chain.maybeSingle = () => queryChain(table, defaultSingle)

    // Make thenable: resolves to single item or list depending on context
    chain.then = (resolve: (v: unknown) => void) => {
      const result = { data: isSingle ? defaultSingle : defaultList, error: null, count: 0 }
      resolve(result)
      return Promise.resolve(result)
    }
    chain.catch = () => chain
    chain.finally = (fn: () => void) => { fn(); return chain }

    return chain
  }

  return {
    auth: {
      getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
      getSession: async () => ({
        data: { session: { user: DEMO_USER, access_token: 'demo', refresh_token: 'demo' } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => queryChain(table),
    rpc: (_fn: string, _args?: unknown) => queryChain(),
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
  } as unknown as ReturnType<typeof createServerClient>
}

// ---------------------------------------------------------------------------
// Real client
// ---------------------------------------------------------------------------
export async function createClient() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return makeDemoClient()
  }

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // In Server Components cookie writes are silently ignored;
            // the middleware handles token refresh.
          }
        },
      },
    },
  )
}
