"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import LoadingSpinner from "./LoadingSpinner";

export default function CodingQuestion({ onSelectStarterCode, roomId, user }) {
  const [problemSet, setProblemSet] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isOpen, setIsOpen] = useState(true);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [roomDetails, setRoomDetails] = useState(null);
  const isUserAction = useRef(false);

  // Primary effect for initial data load and subscriptions
  useEffect(() => {
    if (!roomId) return;

    // Fetch the room details and problem set information
    const fetchRoomAndProblemSet = async () => {
      try {
        setLoading(true);
        console.log("Fetching room details and problem set...");

        // Fetch room details
        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select("subject_name, difficulty, set_number, question_index")
          .eq("code", roomId)
          .single();

        if (roomError) throw roomError;

        console.log("Room data fetched:", roomData);
        setRoomDetails(roomData);

        // Load the problem set
        const problemSetsData = await import("@/codepath_problem_sets.json");
        const subject = roomData.subject_name;
        const difficulty = roomData.difficulty;
        const setNumber = roomData.set_number.toString();

        try {
          const currentProblemSet =
            problemSetsData.default[subject][difficulty][setNumber];
          console.log("Problem set loaded:", currentProblemSet?.name);

          setProblemSet(currentProblemSet);

          // Only update question if not during a user navigation action
          if (!isUserAction.current) {
            const index = roomData.question_index || 0;
            console.log("Setting initial question index:", index);
            setQuestionIndex(index);
            setCurrentQuestion(currentProblemSet.problems[index]);
          }
        } catch (err) {
          console.error("Error loading problem set:", err);
          setProblemSet(null);
          setCurrentQuestion(null);
        }
      } catch (err) {
        console.error("Error fetching room details or problem set:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoomAndProblemSet();

    // Real-time subscriptions
    const questionSubscription = supabase
      .channel(`room:${roomId}:question`)
      .on("broadcast", { event: "question_change" }, (payload) => {
        // Skip if this was triggered by the current user
        if (payload.payload.userId === user.id) {
          console.log("Ignoring my own question change broadcast");
          return;
        }

        console.log("Received question change:", payload.payload);
        const newIndex = payload.payload.questionIndex;

        setQuestionIndex(newIndex);
        if (problemSet && problemSet.problems) {
          setCurrentQuestion(problemSet.problems[newIndex]);

          // Update editor content if needed
          if (onSelectStarterCode && problemSet.problems[newIndex]?.given) {
            onSelectStarterCode(problemSet.problems[newIndex].given);
          }
        }
      })
      .subscribe();

    // Settings change subscription
    const settingsSubscription = supabase
      .channel(`room:${roomId}`)
      .on("broadcast", { event: "settings_changed" }, (payload) => {
        console.log("Room settings changed:", payload.payload);
        // Update roomDetails with new settings
        setRoomDetails((prev) => ({
          ...prev,
          subject_name: payload.payload.subject_name,
          difficulty: payload.payload.difficulty,
          set_number: payload.payload.set_number,
        }));
      })
      .subscribe();

    return () => {
      questionSubscription.unsubscribe();
      settingsSubscription.unsubscribe();
    };
  }, [roomId, user.id]);

  // Effect to handle room details changes (like subject or difficulty)
  useEffect(() => {
    if (!roomDetails) return;

    const loadProblemSet = async () => {
      try {
        // Don't set loading state if this is triggered during navigation
        if (!isUserAction.current) {
          setLoading(true);
        }

        console.log("Loading problem set for updated room details");
        const problemSetsData = await import("@/codepath_problem_sets.json");
        const subject = roomDetails.subject_name;
        const difficulty = roomDetails.difficulty;
        const setNumber = roomDetails.set_number.toString();

        try {
          const currentProblemSet =
            problemSetsData.default[subject][difficulty][setNumber];
          console.log("Updated problem set loaded:", currentProblemSet?.name);

          setProblemSet(currentProblemSet);

          // Only update question if not during a user navigation action
          if (!isUserAction.current) {
            const index = roomDetails.question_index || 0;
            console.log("Updating question to index:", index);
            setQuestionIndex(index);
            setCurrentQuestion(currentProblemSet.problems[index]);

            // Update editor content
            if (
              onSelectStarterCode &&
              currentProblemSet.problems[index]?.given
            ) {
              onSelectStarterCode(currentProblemSet.problems[index].given);
            }
          }
        } catch (err) {
          console.error(
            "Error loading problem set after settings change:",
            err
          );
          setProblemSet(null);
          setCurrentQuestion(null);
        }
      } catch (err) {
        console.error("Error importing problem sets data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProblemSet();
  }, [roomDetails, onSelectStarterCode]);

  // Function to handle navigation to next question
  const selectNextQuestion = async () => {
    if (!roomId || !user || !problemSet || !problemSet.problems) return;

    try {
      // Set the user action flag to prevent interference
      isUserAction.current = true;

      // Calculate next index with wrapping
      const nextIndex = (questionIndex + 1) % problemSet.problems.length;
      console.log("Navigating to next question:", nextIndex);

      // Update local state immediately
      setQuestionIndex(nextIndex);
      setCurrentQuestion(problemSet.problems[nextIndex]);

      // Update the database
      await supabase
        .from("rooms")
        .update({ question_index: nextIndex })
        .eq("code", roomId);

      // Broadcast the change to other users
      await supabase.channel(`room:${roomId}:question`).send({
        type: "broadcast",
        event: "question_change",
        payload: {
          questionIndex: nextIndex,
          userId: user.id,
        },
      });

      // Update editor content
      if (onSelectStarterCode && problemSet.problems[nextIndex]?.given) {
        onSelectStarterCode(problemSet.problems[nextIndex].given);
      }
    } catch (error) {
      console.error("Error updating to next question:", error);
    } finally {
      // Reset the user action flag after a delay to allow state to settle
      setTimeout(() => {
        isUserAction.current = false;
      }, 500);
    }
  };

  // Function to handle navigation to previous question
  const selectPreviousQuestion = async () => {
    if (!roomId || !user || !problemSet || !problemSet.problems) return;

    try {
      // Set the user action flag to prevent interference
      isUserAction.current = true;

      // Calculate previous index with wrapping
      const prevIndex =
        questionIndex === 0
          ? problemSet.problems.length - 1
          : questionIndex - 1;

      console.log("Navigating to previous question:", prevIndex);

      // Update local state immediately
      setQuestionIndex(prevIndex);
      setCurrentQuestion(problemSet.problems[prevIndex]);

      // Update the database
      await supabase
        .from("rooms")
        .update({ question_index: prevIndex })
        .eq("code", roomId);

      // Broadcast the change to other users
      await supabase.channel(`room:${roomId}:question`).send({
        type: "broadcast",
        event: "question_change",
        payload: {
          questionIndex: prevIndex,
          userId: user.id,
        },
      });

      // Update editor content
      if (onSelectStarterCode && problemSet.problems[prevIndex]?.given) {
        onSelectStarterCode(problemSet.problems[prevIndex].given);
      }
    } catch (error) {
      console.error("Error updating to previous question:", error);
    } finally {
      // Reset the user action flag after a delay to allow state to settle
      setTimeout(() => {
        isUserAction.current = false;
      }, 500);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isOpen) {
    return (
      <div className="absolute left-0 top-16 z-10">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white p-2 rounded-r"
        >
          Show Problem
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>No problem available.</p>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-y-auto p-4 bg-[#f8f9fa] dark:bg-[#1e1e1e] border-r border-black/[.08] dark:border-white/[.145] relative"
      key={`${roomDetails?.subject_name}-${roomDetails?.difficulty}-${roomDetails?.set_number}-${questionIndex}`}
    >
      <div className="flex justify-between gap-2 mb-6">
        <button
          onClick={selectPreviousQuestion}
          className="px-4 py-2 border border-foreground rounded hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a]"
        >
          Previous Question
        </button>
        <button
          onClick={selectNextQuestion}
          className="px-4 py-2 border border-foreground rounded hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a]"
        >
          Next Question
        </button>
      </div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          Problem {currentQuestion.problem_number}:{" "}
          {currentQuestion.problem_name}
        </h2>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            {roomDetails?.difficulty || "Standard"}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <p className="whitespace-pre-line">
          {currentQuestion.problem_instructions}
        </p>
      </div>

      <div className="mb-4">
        <h3 className="font-bold mb-2">Example:</h3>
        <div className="p-3 bg-white dark:bg-[#252525] rounded">
          <div>
            <strong>Usage:</strong>
            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
              {currentQuestion.example_usage}
            </pre>
          </div>
          <div className="mt-2">
            <strong>Output:</strong>
            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
              {currentQuestion.example_output}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
