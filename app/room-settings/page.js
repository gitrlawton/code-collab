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

      const initialContent = firstProblem.given || "// Start coding here...";

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
    <div className="min-h-screen bg-gradient-to-b from-background to-gray-50 dark:from-background dark:to-gray-900/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Room Settings</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Configure your coding room before creation
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800/50 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700/50">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md py-2 px-3"
                disabled={availableSubjects.length <= 1}
              >
                {availableSubjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Currently limited to available problem sets
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md py-2 px-3"
                disabled={availableDifficulties.length <= 1}
              >
                {availableDifficulties.map((diff) => (
                  <option key={diff} value={diff}>
                    {diff}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Set Number
              </label>
              <select
                value={setNumber}
                onChange={(e) => setSetNumber(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md py-2 px-3"
                disabled={availableSets.length <= 1}
              >
                {availableSets.map((set) => (
                  <option key={set} value={set}>
                    {set}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-4">
              <button
                onClick={createRoom}
                disabled={creating}
                className="w-full rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-base h-12"
              >
                {creating ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Creating...
                  </>
                ) : (
                  "Create Room"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
