"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import RoomCreation from "@/components/RoomCreation";
import RoomJoin from "@/components/RoomJoin";
import LoadingSpinner from "@/components/LoadingSpinner";
import ThemeToggle from "@/components/ThemeToggle";
import { Laptop } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-r from-gray-100 via-white to-gray-100 dark:from-[#1a1c1f] dark:via-[#1a1c1f] dark:to-[#1a1c1f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center mb-4 items-center gap-4 mb-20 md:mb-26">
          <a
            href="https://codecollab.canny.io/feature-requests"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-solid border-black/[.08] dark:text-gray-300 dark:hover:bg-gray-600/30 dark:hover:text-white dark:border-white/[.145] flex items-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] text-gray-700 hover:text-black h-8 px-4 cursor-pointer"
          >
            Request a Feature
          </a>
          <ThemeToggle className="text-gray-700 hover:text-black dark:text-gray-300 dark:hover:bg-[#2f3237] dark:hover:text-white" />
        </div>
        <div className="grid md:grid-cols-2 gap-12 ">
          {/* Hero section - Only shown when user is not logged in */}
          {!user ? (
            <div className="flex flex-col gap-6 order-2 items-center justify-center text-center md:order-1">
              {/* Content for non-logged in users */}
              <>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight dark:text-gray-200">
                  CodeCollab
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-lg">
                  Bring your friends, share an editor, and code your way through
                  solving DSA problems—together.
                </p>

                {!loading && (
                  <div className="mt-4">
                    <button
                      onClick={() => router.push("/signin")}
                      className="rounded-full border border-solid border-black/[.08] dark:text-gray-300 dark:bg-gray-700/30 dark:hover:bg-gray-600/30 dark:hover:text-white dark:border-white/[.145] hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-base h-12 px-5 mt-2 cursor-pointer bg-foreground text-background gap-2"
                    >
                      Get Started
                    </button>
                  </div>
                )}

                <div className="mt-6">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 border-2 border-white dark:border-gray-900 flex items-center justify-center text-xs"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            className="w-5 h-5 text-gray-500 dark:text-gray-400"
                          >
                            <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.31 0-6 1.343-6 3v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1c0-1.657-2.69-3-6-3z" />
                          </svg>
                        </div>
                      ))}
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Join programmers practicing data structures and algorithms
                      collaboratively
                    </span>
                  </div>
                </div>
              </>
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center md:items-start gap-6 order-1">
              {/* Content for logged in users */}
              <h2 className="text-3xl font-bold text-center md:text-left dark:text-gray-200">
                Welcome, {user.user_metadata?.name || "Coder"}!
              </h2>
              <p className="text-lg text-center md:text-left text-gray-600 dark:text-gray-300">
                Ready to collab?
                <br />
                Create a new coding room or join an existing one.
              </p>

              <div className="mt-4 space-y-6">
                <div className="bg-white dark:bg-gray-800/30 p-6 rounded-lg border border-gray-100 dark:border-gray-700/50">
                  <h3 className="text-lg font-semibold dark:text-gray-300 mb-3 flex items-center gap-2">
                    Quick Tips
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                      <span className="text-black dark:text-gray-300">•</span>
                      <span>Create a room to start a new coding session</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-black dark:text-gray-300">•</span>
                      <span>Share the room code with friends</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-black dark:text-gray-300">•</span>
                      <span>Join a friend&apos;s room via their room code</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Auth/Content section */}
          <div className="order-2 bg-white dark:bg-gray-800/50 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm">
            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : user ? (
              <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-foreground dark:bg-gray-700 text-background flex items-center justify-center text-lg font-medium">
                      {user.user_metadata?.name?.charAt(0) ||
                        user.email?.charAt(0) ||
                        "U"}
                    </div>
                    <div>
                      <p className="font-medium text-lg dark:text-gray-200">
                        {user.user_metadata?.name || "User"}
                      </p>
                      <p className="text-sm opacity-70 dark:text-gray-400">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="rounded-full border border-solid border-black/[.08] dark:text-gray-300 dark:bg-gray-700/30 dark:hover:bg-gray-600/30 dark:hover:text-white dark:border-white/[.145] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#1a1a1a] hover:border-transparent text-base h-12 px-5 cursor-pointer bg-foreground text-background gap-2 flex-shrink-0 mt-2 sm:mt-0 w-full sm:w-auto md:w-full lg:w-auto"
                  >
                    Sign Out
                  </button>
                </div>

                <div className="border-t border-b border-black/[.08] dark:border-white/[.145] py-6 my-2">
                  <div className="flex justify-center items-center gap-2 mb-4">
                    <h2 className="text-xl font-bold dark:text-gray-300">
                      Create a Room
                    </h2>
                  </div>
                  <RoomCreation user={user} />
                </div>

                <div>
                  <div className="flex justify-center items-center gap-2 mb-4">
                    <h2 className="text-xl font-bold dark:text-gray-300">
                      Join a Room
                    </h2>
                  </div>
                  <RoomJoin />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 items-center py-8">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-500 dark:text-black flex items-center justify-center mb-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-center dark:text-gray-200">
                  Welcome to CodeCollab
                </h2>
                <p className="text-center text-gray-600 dark:text-gray-300">
                  Sign in to create or join a collaborative coding session.
                </p>
                <button
                  onClick={() => router.push("/signin")}
                  className="rounded-full border border-solid border-black/[.08] dark:text-gray-300 dark:bg-gray-700/30 dark:hover:bg-gray-600/30 dark:hover:text-white dark:border-white/[.145] flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-base h-12 px-5 mt-2 cursor-pointer bg-foreground text-background gap-2"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Features section - Only shown when user is not logged in */}
        {!user && (
          <div className="mt-12 md:mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800/30 p-6 rounded-lg border border-gray-100 dark:border-gray-700/50">
              <div className="md:flex md:flex-col md:items-start flex flex-row items-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 md:mb-4 mr-3 md:mr-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-600 dark:text-blue-400"
                  >
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                </div>
                <h3 className="text-lg font-bold md:mb-2 mb-4 dark:text-gray-200">
                  Real-time Collaboration
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Code together with your friends in real-time with live cursor
                tracking and instant updates.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800/30 p-6 rounded-lg border border-gray-100 dark:border-gray-700/50">
              <div className="md:flex md:flex-col md:items-start flex flex-row items-center">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4 md:mb-4 mr-3 md:mr-0">
                  <Laptop className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-bold md:mb-2 mb-4 dark:text-gray-200">
                  Coding Challenges
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Practice with built-in coding challenges and test your solutions
                in the browser.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800/30 p-6 rounded-lg border border-gray-100 dark:border-gray-700/50">
              <div className="md:flex md:flex-col md:items-start flex flex-row items-center">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 md:mb-4 mr-3 md:mr-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-purple-600 dark:text-purple-400"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
                <h3 className="text-lg font-bold md:mb-2 mb-4 dark:text-gray-200">
                  Multiple Languages
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Support for JS and Python (more to come) with syntax
                highlighting and code execution.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
