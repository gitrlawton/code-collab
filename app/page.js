"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import RoomCreation from "@/components/RoomCreation";
import RoomJoin from "@/components/RoomJoin";

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/signin");
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />

        <h1 className="text-3xl font-bold text-center sm:text-left">
          Collaborative Code Editor
        </h1>

        {loading ? (
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-foreground"></div>
        ) : user ? (
          <div className="flex flex-col gap-8 w-full max-w-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center">
                  {user.user_metadata?.name?.charAt(0) ||
                    user.email?.charAt(0) ||
                    "U"}
                </div>
                <div>
                  <p className="font-medium">
                    {user.user_metadata?.name || "User"}
                  </p>
                  <p className="text-sm opacity-70">{user.email}</p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="text-sm hover:underline"
              >
                Sign Out
              </button>
            </div>

            <div className="border-t border-b border-black/[.08] dark:border-white/[.145] py-6 my-2">
              <h2 className="text-xl font-bold mb-4">Create a Room</h2>
              <RoomCreation user={user} />
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4">Join a Room</h2>
              <RoomJoin />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 items-center">
            <p>Sign in to create or join a collaborative coding session.</p>
            <button
              onClick={() => router.push("/signin")}
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-base h-12 px-5"
            >
              Sign In
            </button>
          </div>
        )}
      </main>

      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn Next.js
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://supabase.com/docs"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Supabase Docs
        </a>
      </footer>
    </div>
  );
}
