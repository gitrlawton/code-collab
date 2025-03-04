"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, generateRoomCode } from "@/lib/supabase";

export default function RoomCreation({ user }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const createRoom = async () => {
    try {
      setCreating(true);
      setError(null);

      // Generate a unique room code
      const roomCode = generateRoomCode();

      // Create a new room in Supabase
      const { error } = await supabase.from("rooms").insert([
        {
          code: roomCode,
          created_by: user.id,
          content: "// Start coding here...",
          language: "javascript",
        },
      ]);

      if (error) throw error;

      // Navigate to the room
      router.push(`/editor/${roomCode}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <button
        onClick={createRoom}
        disabled={creating}
        className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-base h-12 px-5"
      >
        {creating ? "Creating..." : "Create New Room"}
      </button>
    </div>
  );
}
