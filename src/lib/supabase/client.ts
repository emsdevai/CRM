import { createBrowserClient } from '@supabase/ssr'

// ---------------------------------------------------------------------------
// Demo mock — returned when NEXT_PUBLIC_DEMO_MODE=true.
// Mirrors the server-side mock in server.ts so client components work too.
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

// Singleton so the same object reference is returned on every createClient() call,
// preventing infinite re-render loops in hooks that put `supabase` in dep arrays.
let _demoClientSingleton: ReturnType<typeof _buildDemoClient> | null = null

function makeDemoClient() {
  if (_demoClientSingleton) return _demoClientSingleton
  _demoClientSingleton = _buildDemoClient()
  return _demoClientSingleton
}

function _buildDemoClient() {
  function queryChain(table?: string, singleData?: unknown) {
    const isSingle = singleData !== undefined
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

    chain.single = () => queryChain(table, defaultSingle)
    chain.maybeSingle = () => queryChain(table, defaultSingle)

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
        data: {
          session: {
            user: DEMO_USER,
            access_token: 'demo',
            refresh_token: 'demo',
          },
        },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      // onAuthStateChange must return { data: { subscription } }
      // We call the callback immediately with the demo session so hooks resolve.
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        // Fire asynchronously so the hook can set up its mounted guard first
        setTimeout(() => {
          callback('SIGNED_IN', {
            user: DEMO_USER,
            access_token: 'demo',
            refresh_token: 'demo',
          })
        }, 0)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as ReturnType<typeof createBrowserClient<any>>
}

// ---------------------------------------------------------------------------
// Real client
// ---------------------------------------------------------------------------
export function createClient() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return makeDemoClient()
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
