"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import RoomCreation from "@/components/RoomCreation";
import RoomJoin from "@/components/RoomJoin";
import LoadingSpinner from "@/components/LoadingSpinner";

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
    <div className="min-h-screen bg-gradient-to-b from-background to-gray-50 dark:from-background dark:to-gray-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header with logo */}
        <div className="flex justify-center sm:justify-start mb-12">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">CodeCollab</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Hero section - Only shown when user is not logged in */}
          <div className="flex flex-col gap-6 order-2 md:order-1">
            {!user ? (
              // Content for non-logged in users
              <>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                  Collaborative Code Editor
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-lg">
                  Code together in real-time, solve problems collaboratively,
                  and share your solutions instantly.
                </p>

                {!loading && (
                  <div className="mt-4">
                    <button
                      onClick={() => router.push("/signin")}
                      className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-base h-12 px-8"
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
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Join thousands of developers coding together
                    </span>
                  </div>
                </div>
              </>
            ) : (
              // Content for logged in users
              <div className="flex flex-col gap-6">
                <h2 className="text-3xl font-bold">
                  Welcome, {user.user_metadata?.name || "Coder"}!
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  Ready to collaborate?
                  <br />
                  Create a new coding room or join an existing one.
                </p>

                <div className="mt-4 space-y-6">
                  <div className="bg-white dark:bg-gray-800/30 p-6 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                      </svg>
                      Quick Tips
                    </h3>
                    <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        Create a room to start a new coding session
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        Share your room code with collaborators
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        Join a room using the code provided by a colleague
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Auth/Content section */}
          <div className="order-1 md:order-2 bg-white dark:bg-gray-800/50 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm">
            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : user ? (
              <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center text-lg font-medium">
                      {user.user_metadata?.name?.charAt(0) ||
                        user.email?.charAt(0) ||
                        "U"}
                    </div>
                    <div>
                      <p className="font-medium text-lg">
                        {user.user_metadata?.name || "User"}
                      </p>
                      <p className="text-sm opacity-70">{user.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="text-sm hover:underline flex items-center gap-1"
                  >
                    <span>Sign Out</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                  </button>
                </div>

                <div className="border-t border-b border-black/[.08] dark:border-white/[.145] py-6 my-2">
                  <div className="flex items-center gap-2 mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14"></path>
                      <path d="M5 12h14"></path>
                    </svg>
                    <h2 className="text-xl font-bold">Create a Room</h2>
                  </div>
                  <RoomCreation user={user} />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                      <polyline points="10 17 15 12 10 7"></polyline>
                      <line x1="15" y1="12" x2="3" y2="12"></line>
                    </svg>
                    <h2 className="text-xl font-bold">Join a Room</h2>
                  </div>
                  <RoomJoin />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 items-center py-8">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-2">
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
                <h2 className="text-2xl font-bold text-center">
                  Welcome to CodeCollab
                </h2>
                <p className="text-center text-gray-600 dark:text-gray-300">
                  Sign in to create or join a collaborative coding session.
                </p>
                <button
                  onClick={() => router.push("/signin")}
                  className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-base h-12 px-8 mt-2"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Features section - Only shown when user is not logged in */}
        {!user && (
          <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800/30 p-6 rounded-lg border border-gray-100 dark:border-gray-700/50">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
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
              <h3 className="text-lg font-bold mb-2">
                Real-time Collaboration
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Code together with your friends in real-time with live cursor
                tracking and instant updates.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800/30 p-6 rounded-lg border border-gray-100 dark:border-gray-700/50">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
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
                  className="text-green-600 dark:text-green-400"
                >
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Coding Challenges</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Practice with built-in coding challenges and test your solutions
                in the browser.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800/30 p-6 rounded-lg border border-gray-100 dark:border-gray-700/50">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
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
              <h3 className="text-lg font-bold mb-2">Multiple Languages</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Support for JavaScript, Python, C++, and Java with syntax
                highlighting and code execution.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
