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
        className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-base h-12 px-5"
      >
        Create New Room
      </button>
    </div>
  );
}
