"use client";

import { useState } from "react";

export interface UserAvatarProps {
  name?: string | null;
  image?: string | null;
  isOnline?: boolean;
  showPresence?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-14 h-14 text-lg",
};

const dotSizeMap = {
  xs: "h-2 w-2 border",
  sm: "h-2.5 w-2.5 border-[1.5px]",
  md: "h-3 w-3 border-2",
  lg: "h-3.5 w-3.5 border-2",
  xl: "h-4 w-4 border-2",
};

// Deterministic gradients based on user name
const gradients = [
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-red-600",
  "from-cyan-500 to-blue-600",
];

function getGradient(name?: string | null) {
  if (!name) return gradients[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

export function UserAvatar({
  name,
  image,
  isOnline = false,
  showPresence = true,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : "?";
  const gradient = getGradient(name);

  return (
    <div
      className={`relative inline-flex flex-shrink-0 select-none ${className}`}
    >
      {image && !imgError ? (
        <img
          src={image}
          alt={name || "User Avatar"}
          onError={() => setImgError(true)}
          className={`${sizeMap[size]} rounded-full object-cover ring-1 ring-white/10`}
        />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold tracking-wider shadow-inner ring-1 ring-white/10`}
        >
          {initial}
        </div>
      )}

      {/* Real-time Presence Status Indicator */}
      {showPresence && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-slate-900 transition-all duration-300 ${
            dotSizeMap[size]
          } ${
            isOnline
              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] ring-1 ring-emerald-400/40"
              : "bg-slate-500"
          }`}
          title={
            isOnline
              ? `${name || "User"} is Online`
              : `${name || "User"} is Offline`
          }
        />
      )}
    </div>
  );
}
