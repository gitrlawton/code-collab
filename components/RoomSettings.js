"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function RoomSettings({
  roomId,
  initialSettings,
  onClose,
  onSave,
}) {
  const modalRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    subject_name: initialSettings?.subject_name || "javascript",
    difficulty: initialSettings?.difficulty || "Standard",
    set_number: initialSettings?.set_number || 1,
  });
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Update settings when initialSettings change, with fallbacks for missing values
  useEffect(() => {
    if (initialSettings) {
      setSettings({
        subject_name: initialSettings.subject_name || "javascript",
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
          className="bg-white dark:bg-[#1e1e1e] rounded-lg p-6 w-full max-w-md shadow-xl"
          style={{ height: "420px" }}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-black dark:text-gray-200">
              Room Settings
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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

          <form className="space-y-4" style={{ minHeight: "320px" }}>
            <div>
              <label className="block text-sm font-medium text-black dark:text-gray-200 mb-1">
                Subject
              </label>
              <select
                name="subject_name"
                value={settings.subject_name}
                onChange={handleChange}
                className="w-full rounded border border-solid border-black/[.08] text-black dark:text-gray-200 bg-transparent dark:bg-[#2d2d2d] px-3 py-2"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-black dark:text-gray-200 mb-1">
                Difficulty
              </label>
              <select
                name="difficulty"
                value={settings.difficulty}
                onChange={handleChange}
                className="w-full rounded border border-solid border-black/[.08] text-black dark:text-gray-200 bg-transparent dark:bg-[#2d2d2d] bg-transparent px-3 py-2"
              >
                <option value="Standard">Standard</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-black dark:text-gray-200 mb-1">
                Problem Set
              </label>
              <select
                name="set_number"
                value={settings.set_number}
                onChange={handleChange}
                className="w-full rounded border border-solid border-black/[.08] text-black dark:text-gray-200 bg-transparent dark:bg-[#2d2d2d] bg-transparent px-3 py-2"
                title="Select which problem set to use for the current subject and difficulty"
              >
                {[1, 2, 3, 4].map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded hover:bg-[#f2f2f2] dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded bg-gray-200 hover:bg-gray-300 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:bg-[#f2f2f2] disabled:cursor-not-allowed"
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
