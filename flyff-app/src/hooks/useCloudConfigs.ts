import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { SimulatorState } from '../types';

export interface CloudConfig {
  id: string;
  name: string;
  state: SimulatorState;
  is_public: boolean;
  share_token: string;
  created_at: string;
  updated_at: string;
}

export interface UseCloudConfigs {
  configs: CloudConfig[];
  loading: boolean;
  error: string | null;
  saveConfig: (name: string, state: SimulatorState) => Promise<CloudConfig | null>;
  updateConfig: (id: string, patch: Partial<Pick<CloudConfig, 'name' | 'state' | 'is_public'>>) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
  togglePublic: (id: string) => Promise<string | null>;
  loadByToken: (token: string) => Promise<CloudConfig | null>;
  refresh: () => Promise<void>;
}

export function useCloudConfigs(user: User | null): UseCloudConfigs {
  const [configs, setConfigs] = useState<CloudConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setConfigs([]); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('sim_configs')
      .select('*')
      .order('updated_at', { ascending: false });
    if (err) {
      setError(`Laden fehlgeschlagen: ${err.message}`);
    } else {
      setConfigs((data ?? []) as CloudConfig[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  async function saveConfig(name: string, state: SimulatorState): Promise<CloudConfig | null> {
    if (!user) return null;
    setError(null);
    const { data, error: err } = await supabase
      .from('sim_configs')
      .insert({ name, state })   // user_id wird durch RLS gesetzt
      .select()
      .single();
    if (err) {
      setError(`Speichern fehlgeschlagen: ${err.message}`);
      return null;
    }
    const saved = data as CloudConfig;
    setConfigs(prev => [saved, ...prev]);
    return saved;
  }

  async function updateConfig(id: string, patch: Partial<Pick<CloudConfig, 'name' | 'state' | 'is_public'>>) {
    setError(null);
    const { data, error: err } = await supabase
      .from('sim_configs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (err) setError(`Update fehlgeschlagen: ${err.message}`);
    else if (data) setConfigs(prev => prev.map(c => c.id === id ? data as CloudConfig : c));
  }

  async function deleteConfig(id: string) {
    setError(null);
    const { error: err } = await supabase.from('sim_configs').delete().eq('id', id);
    if (err) setError(`Löschen fehlgeschlagen: ${err.message}`);
    else setConfigs(prev => prev.filter(c => c.id !== id));
  }

  async function togglePublic(id: string): Promise<string | null> {
    const cfg = configs.find(c => c.id === id);
    if (!cfg) return null;
    const newPublic = !cfg.is_public;
    const { data, error: err } = await supabase
      .from('sim_configs')
      .update({ is_public: newPublic, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('share_token, is_public')
      .single();
    if (err) { setError(`Teilen fehlgeschlagen: ${err.message}`); return null; }
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, is_public: newPublic } : c));
    return newPublic ? (data as { share_token: string }).share_token : null;
  }

  async function loadByToken(token: string): Promise<CloudConfig | null> {
    const { data, error: err } = await supabase
      .from('sim_configs')
      .select('*')
      .eq('share_token', token)
      .eq('is_public', true)
      .single();
    if (err || !data) return null;
    return data as CloudConfig;
  }

  return { configs, loading, error, saveConfig, updateConfig, deleteConfig, togglePublic, loadByToken, refresh };
}
