"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RoomJoin() {
  const [roomCode, setRoomCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const joinRoom = async (e) => {
    e.preventDefault();

    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }

    try {
      setJoining(true);
      setError(null);

      // Check if room exists
      const { data, error } = await supabase
        .from("rooms")
        .select("code")
        .eq("code", roomCode.trim())
        .single();

      if (error || !data) {
        throw new Error("Room not found. Please check the code and try again.");
      }

      // Navigate to the room
      router.push(`/editor/${roomCode.trim()}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={joinRoom} className="flex flex-col gap-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="roomCode" className="text-sm font-medium">
            Room Code
          </label>
          <input
            id="roomCode"
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Enter room code"
            className="rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-transparent px-4 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={joining}
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-base h-12 px-5"
        >
          {joining ? "Joining..." : "Join Room"}
        </button>
      </form>
    </div>
  );
}
