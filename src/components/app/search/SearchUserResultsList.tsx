// src/components/app/search/SearchUserResultsList.tsx
import React from 'react';
import type { OmniUser } from '../../../types/onlineMusic';

// 搜索到的用户列表：只展示头像与昵称，点击进入该用户的公开歌单。
type SearchUserResultsListProps = {
    users: OmniUser[];
    isDaylight: boolean;
    selectedUserId?: string | number | null;
    onSelectUser: (user: OmniUser) => void;
};

const SearchUserResultsList: React.FC<SearchUserResultsListProps> = ({
    users,
    isDaylight,
    selectedUserId,
    onSelectUser,
}) => (
    <ul className="flex h-full flex-col gap-2 overflow-y-auto pb-4">
        {users.map(user => {
            const userKey = String(user.id);
            const selected = selectedUserId !== undefined && String(selectedUserId) === userKey;
            return (
                <li key={userKey}>
                    <button
                        type="button"
                        onClick={() => onSelectUser(user)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                            selected
                                ? 'border-current/30'
                                : isDaylight
                                    ? 'border-black/10 bg-black/[0.03] hover:bg-black/[0.06]'
                                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                        }`}
                    >
                        {user.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt={user.nickname}
                                className="h-11 w-11 shrink-0 rounded-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <span
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ${
                                    isDaylight ? 'bg-black/10' : 'bg-white/10'
                                }`}
                                aria-hidden
                            >
                                {user.nickname.slice(0, 1) || '?'}
                            </span>
                        )}
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{user.nickname || userKey}</span>
                            <span className="block truncate text-xs opacity-55">ID: {userKey}</span>
                        </span>
                        <span className="shrink-0 text-xs opacity-60">公开歌单 ›</span>
                    </button>
                </li>
            );
        })}
    </ul>
);

export default SearchUserResultsList;
