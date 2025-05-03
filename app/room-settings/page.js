"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, generateRoomCode } from "@/lib/supabase";
import {
  getProblem,
  getSubjects,
  getDifficulties,
  getSetNumbers,
} from "@/lib/problem-sets";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function RoomSettings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  // For now, we only have one option for each setting
  const [subject, setSubject] = useState("Strings & Arrays");
  const [difficulty, setDifficulty] = useState("Standard");
  const [setNumber, setSetNumber] = useState("1");

  // Get available options from our problem sets
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableDifficulties, setAvailableDifficulties] = useState([]);
  const [availableSets, setAvailableSets] = useState([]);

  useEffect(() => {
    const loadProblemSetOptions = async () => {
      const subjects = getSubjects();
      setAvailableSubjects(subjects);

      if (subjects.length > 0) {
        const defaultSubject = subjects[0];
        setSubject(defaultSubject);

        const difficulties = getDifficulties(defaultSubject);
        setAvailableDifficulties(difficulties);

        if (difficulties.length > 0) {
          const defaultDifficulty = difficulties[0];
          setDifficulty(defaultDifficulty);

          const sets = getSetNumbers(defaultSubject, defaultDifficulty);
          setAvailableSets(sets);

          if (sets.length > 0) {
            setSetNumber(sets[0]);
          }
        }
      }
    };

    loadProblemSetOptions();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);

      if (!session?.user) {
        router.push("/signin");
      }
    };

    checkAuth();
  }, [router]);

  const createRoom = async () => {
    try {
      setCreating(true);
      setError(null);

      // Generate a unique room code
      const roomCode = generateRoomCode();

      // Get the first problem from the problem set to initialize the editor content
      const firstProblem = getProblem(subject, difficulty, setNumber, 0);

      if (!firstProblem) {
        throw new Error("Could not load the problem set. Please try again.");
      }

      const initialContent =
        firstProblem.given_python || "// Start coding here...";

      // Create a new room in Supabase
      const { error } = await supabase.from("rooms").insert([
        {
          code: roomCode,
          created_by: user.id,
          content: initialContent,
          language: "python", // Assuming the initial problem is in Python
          subject_name: subject,
          difficulty: difficulty,
          set_number: parseInt(setNumber),
          question_index: 0,
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#161616]">
      {/* Back Button */}
      <button
        className="absolute top-6 left-6 flex items-center text-gray-500 hover:text-gray-800 dark:text-gray-200 dark:hover:text-gray-400 rounded-full p-2 transition cursor-pointer"
        onClick={() => router.push("/")}
        aria-label="Back to main page"
        style={{ zIndex: 10 }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-6 h-6 mr-2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        <span className="font-medium">Back</span>
      </button>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black dark:text-gray-200 ">
            Room Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Configure your room
          </p>
        </div>

        <div className="bg-white dark:bg-[#1e1e1e] p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700/50">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-medium text-black dark:text-gray-200 mb-2">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-gray-300 text-black dark:text-gray-200 bg-transparent dark:bg-[#2d2d2d] dark:border-white/[.145] dark:hover:ring-1 dark:hover:ring-white/30 rounded-md py-2 px-3 pr-8 cursor-pointer appearance-none"
                disabled={availableSubjects.length <= 1}
              >
                {availableSubjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
              {/* Custom caret */}
              <span className="pointer-events-none absolute right-3 top-[55%] transform -translate-y-1/2 text-gray-400 dark:text-gray-300">
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                Currently limited to available problem sets
              </p>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-black dark:text-gray-200 mb-2">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full border border-gray-300 text-black dark:text-gray-200 bg-transparent dark:bg-[#2d2d2d] dark:border-white/[.145] dark:hover:ring-1 dark:hover:ring-white/30 rounded-md py-2 px-3 pr-8 cursor-pointer appearance-none"
                disabled={availableDifficulties.length <= 1}
              >
                {availableDifficulties.map((diff) => (
                  <option key={diff} value={diff}>
                    {diff}
                  </option>
                ))}
              </select>
              {/* Custom caret */}
              <span className="pointer-events-none absolute right-3 top-[55%] transform -translate-y-1/2 text-gray-400 dark:text-gray-300">
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                Choose your preferred difficulty
              </p>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-black dark:text-gray-200 mb-2">
                Set Number
              </label>
              <select
                value={setNumber}
                onChange={(e) => setSetNumber(e.target.value)}
                className="w-full border border-gray-300 text-black dark:text-gray-200 bg-transparent dark:bg-[#2d2d2d] dark:border-white/[.145] dark:hover:ring-1 dark:hover:ring-white/30 rounded-md py-2 px-3 pr-8 cursor-pointer appearance-none"
                disabled={availableSets.length <= 1}
              >
                {availableSets.map((set) => (
                  <option key={set} value={set}>
                    {set}
                  </option>
                ))}
              </select>
              {/* Custom caret */}
              <span className="pointer-events-none absolute right-3 top-[55%] transform -translate-y-1/2 text-gray-400 dark:text-gray-300">
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                Select a problem set number
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={createRoom}
                disabled={creating}
                className="rounded-full border border-solid border-black/[.08] dark:text-gray-200 dark:bg-[#2d2d2d] dark:hover:bg-[#3a3a3a] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-base h-12 px-5 w-full cursor-pointer"
              >
                {creating ? "Creating..." : "Create Room"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
