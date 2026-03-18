import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn() {
    const appUrl = import.meta.env.VITE_APP_URL as string | undefined;
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: appUrl ?? window.location.origin,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { user, loading, signIn, signOut };
}
