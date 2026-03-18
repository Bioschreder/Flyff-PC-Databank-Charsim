import type { AuthState } from '../hooks/useAuth';

interface Props {
  auth: AuthState;
}

export function AuthButton({ auth }: Props) {
  if (auth.loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse" />
    );
  }

  if (!auth.user) {
    return (
      <button
        onClick={auth.signIn}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors"
      >
        <DiscordIcon />
        Mit Discord einloggen
      </button>
    );
  }

  const meta     = auth.user.user_metadata as Record<string, string> | undefined;
  const username = meta?.full_name ?? meta?.name ?? meta?.custom_claims?.global_name ?? auth.user.email ?? 'User';
  const avatarUrl = meta?.avatar_url;

  return (
    <div className="flex items-center gap-2">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className="w-7 h-7 rounded-full border border-gray-600"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">
          {username.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="text-sm text-gray-200 max-w-[120px] truncate hidden sm:block">{username}</span>
      <button
        onClick={auth.signOut}
        className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200 text-xs transition-colors"
        title="Abmelden"
      >
        Abmelden
      </button>
    </div>
  );
}

function DiscordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}
