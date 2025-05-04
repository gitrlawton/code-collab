"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  getProblem,
  getSubjects,
  getDifficulties,
  getSetNumbers,
} from "@/lib/problem-sets";

export default function RoomSettings({
  roomId,
  initialSettings,
  onClose,
  onSave,
}) {
  const modalRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    subject_name: initialSettings?.subject_name || "Strings & Arrays",
    difficulty: initialSettings?.difficulty || "Standard",
    set_number: initialSettings?.set_number || 1,
  });
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // For available options from our problem sets
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableDifficulties, setAvailableDifficulties] = useState([]);
  const [availableSets, setAvailableSets] = useState([]);

  // Load problem set options
  useEffect(() => {
    const loadProblemSetOptions = async () => {
      const subjects = getSubjects();
      setAvailableSubjects(subjects);

      if (subjects.length > 0) {
        // If initial settings exist, use them, otherwise use first available options
        const subjectToUse = initialSettings?.subject_name || subjects[0];

        // Update settings with the subject
        setSettings((prev) => ({
          ...prev,
          subject_name: subjectToUse,
        }));

        const difficulties = getDifficulties(subjectToUse);
        setAvailableDifficulties(difficulties);

        if (difficulties.length > 0) {
          const difficultyToUse =
            initialSettings?.difficulty || difficulties[0];

          // Update settings with the difficulty
          setSettings((prev) => ({
            ...prev,
            difficulty: difficultyToUse,
          }));

          const sets = getSetNumbers(subjectToUse, difficultyToUse);
          setAvailableSets(sets);

          if (sets.length > 0) {
            const setToUse = initialSettings?.set_number || parseInt(sets[0]);

            // Update settings with the set number
            setSettings((prev) => ({
              ...prev,
              set_number: setToUse,
            }));
          }
        }
      }
    };

    loadProblemSetOptions();
  }, [initialSettings]);

  // Update available difficulties and sets when subject changes
  useEffect(() => {
    // Get available difficulties for the selected subject
    const difficulties = getDifficulties(settings.subject_name);
    setAvailableDifficulties(difficulties);

    // If current difficulty is not available for this subject, reset to first available
    if (
      difficulties.length > 0 &&
      !difficulties.includes(settings.difficulty)
    ) {
      setSettings((prev) => ({
        ...prev,
        difficulty: difficulties[0],
      }));
    } else {
      // If difficulty is valid, update available sets
      const sets = getSetNumbers(settings.subject_name, settings.difficulty);
      setAvailableSets(sets);

      // If current setNumber is not in the available sets, reset to first available
      if (sets.length > 0 && !sets.includes(settings.set_number.toString())) {
        setSettings((prev) => ({
          ...prev,
          set_number: parseInt(sets[0]),
        }));
      }
    }
  }, [settings.subject_name]);

  // Update available sets when difficulty changes
  useEffect(() => {
    const sets = getSetNumbers(settings.subject_name, settings.difficulty);
    setAvailableSets(sets);

    // If current setNumber is not in the available sets, reset to first available
    if (sets.length > 0 && !sets.includes(settings.set_number.toString())) {
      setSettings((prev) => ({
        ...prev,
        set_number: parseInt(sets[0]),
      }));
    }
  }, [settings.difficulty]);

  // Update settings when initialSettings change, with fallbacks for missing values
  useEffect(() => {
    if (initialSettings) {
      setSettings({
        subject_name: initialSettings.subject_name || "Strings & Arrays",
        difficulty: initialSettings.difficulty || "Standard",
        set_number: initialSettings.set_number || 1,
      });
    }
  }, [initialSettings]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    };

    fetchUser();
  }, []);

  // Add escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleSave = async () => {
    try {
      // Validate form
      if (!settings.subject_name) {
        setError("Please select a subject");
        return;
      }

      setLoading(true);
      setError(null);

      const { error } = await supabase
        .from("rooms")
        .update({
          subject_name: settings.subject_name,
          difficulty: settings.difficulty,
          set_number: settings.set_number,
        })
        .eq("code", roomId);

      if (error) throw error;

      // Broadcast settings change to all users in the room
      await supabase.channel(`room:${roomId}`).send({
        type: "broadcast",
        event: "settings_changed",
        payload: {
          subject_name: settings.subject_name,
          difficulty: settings.difficulty,
          set_number: settings.set_number,
          updatedBy: user?.user_metadata?.name || "Anonymous",
        },
      });

      // Pass the updated settings back to the parent
      onSave(settings);
    } catch (err) {
      console.error("Error saving room settings:", err);
      setError(err.message || "Failed to save room settings");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: name === "set_number" ? parseInt(value, 10) : value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Semi-transparent overlay with blur effect */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>

      <div className="relative flex items-center justify-center h-full">
        <div
          ref={modalRef}
          className="bg-white dark:bg-gray-800/30 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-100 dark:border-gray-700/50"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-black dark:text-gray-200">
              Room Settings
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
              aria-label="Close"
            >
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
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-medium text-black dark:text-gray-200 mb-2">
                Subject
              </label>
              <select
                name="subject_name"
                value={settings.subject_name}
                onChange={handleChange}
                className="w-full border border-gray-300 text-black hover:ring-1 hover:ring-black/30 dark:text-gray-200 bg-transparent dark:bg-[#222429] dark:border-white/[.145] dark:hover:ring-1 dark:hover:ring-white/30 rounded-md py-2 px-3 pr-8 cursor-pointer appearance-none"
                disabled={availableSubjects.length < 1}
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
                name="difficulty"
                value={settings.difficulty}
                onChange={handleChange}
                className="w-full border border-gray-300 text-black hover:ring-1 hover:ring-black/30 dark:text-gray-200 bg-transparent dark:bg-[#222429] dark:border-white/[.145] dark:hover:ring-1 dark:hover:ring-white/30 rounded-md py-2 px-3 pr-8 cursor-pointer appearance-none"
                disabled={availableDifficulties.length < 1}
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
                name="set_number"
                value={settings.set_number}
                onChange={handleChange}
                className="w-full border border-gray-300 text-black hover:ring-1 hover:ring-black/30 dark:text-gray-200 bg-transparent dark:bg-[#222429] dark:border-white/[.145] dark:hover:ring-1 dark:hover:ring-white/30 rounded-md py-2 px-3 pr-8 cursor-pointer appearance-none"
                disabled={availableSets.length < 1}
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

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="rounded bg-gray-200 hover:bg-gray-300 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-gray-200 dark:hover:bg-[#1a1a1a] hover:border-transparent text-base px-4 py-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
