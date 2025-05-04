"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RoomCreation({ user }) {
  const [error, setError] = useState(null);
  const router = useRouter();

  const goToSettings = () => {
    router.push("/room-settings");
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <button
        onClick={goToSettings}
        className="rounded-full border border-solid border-black/[.08] bg-gray-100 dark:text-gray-300 dark:bg-gray-700/30 dark:hover:bg-gray-600/30 dark:hover:text-white dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-gray-200 dark:hover:bg-[#1a1a1a] hover:border-transparent text-base h-12 px-5 cursor-pointer"
      >
        Create Room
      </button>
    </div>
  );
}
