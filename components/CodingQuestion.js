"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import LoadingSpinner from "./LoadingSpinner";
import ReactMarkdown from "react-markdown";

export default function CodingQuestion({
  onSelectStarterCode,
  roomId,
  user,
  language = "python",
}) {
  const [problemSet, setProblemSet] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isOpen, setIsOpen] = useState(true);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [roomDetails, setRoomDetails] = useState(null);

  // Main effect for loading initial data and question changes
  useEffect(() => {
    if (!roomId) return;

    // Fetch the room details and problem set information
    const fetchRoomAndProblemSet = async () => {
      try {
        setLoading(true);
        // Fetch room details including subject_name, difficulty, set_number, and question_index
        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select("subject_name, difficulty, set_number, question_index")
          .eq("code", roomId)
          .single();

        if (roomError) throw roomError;
        setRoomDetails(roomData);

        // Load the problem set from the updated problem-sets module
        const { getProblem } = await import("@/lib/problem-sets");

        // Get the current problem based on room details
        const subject = roomData.subject_name;
        const difficulty = roomData.difficulty;
        const setNumber = roomData.set_number.toString();
        const index = roomData.question_index || 0;

        try {
          // Get the problem using the getProblem function
          const problem = getProblem(subject, difficulty, setNumber, index);

          if (problem) {
            // Set the current question
            setQuestionIndex(index);
            setCurrentQuestion(problem);

            // Fetch all problems for this set to store in problemSet
            const { getProblems } = await import("@/lib/problem-sets");
            const problems = getProblems(subject, difficulty, setNumber);

            if (problems) {
              setProblemSet({ problems });
            } else {
              console.error("No problems found for this set");
              setProblemSet(null);
            }
          } else {
            console.error("Problem not found");
            setProblemSet(null);
            setCurrentQuestion(null);
          }
        } catch (err) {
          console.error("Error loading problem set:", err);
          // Handle missing problem set gracefully
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

    // Subscribe to question changes
    const questionSubscription = supabase
      .channel(`room:${roomId}:question`)
      .on("broadcast", { event: "question_change" }, async (payload) => {
        const newIndex = payload.payload.questionIndex;
        console.log(`Question change event received: switching to index ${newIndex}`);
        
        // Update local state for the index
        setQuestionIndex(newIndex);
        
        // If we already have the problem set loaded, update immediately
        if (problemSet && problemSet.problems && problemSet.problems[newIndex]) {
          setCurrentQuestion(problemSet.problems[newIndex]);
          console.log("Updated current question from local problem set");
          
          // Also update the editor content
          const starterCode = getLanguageSpecificStarterCode(problemSet.problems[newIndex]);
          if (onSelectStarterCode && starterCode) {
            console.log("Updating editor with starter code from question change event");
            onSelectStarterCode(starterCode);
          }
        } else {
          // If we don't have the problem set loaded, reload it from the database
          console.log("Problem set not available, reloading from database...");
          try {
            // Get the current room details to make sure we have up-to-date settings
            const { data: roomData, error: roomError } = await supabase
              .from("rooms")
              .select("subject_name, difficulty, set_number, question_index")
              .eq("code", roomId)
              .single();

            if (roomError) throw roomError;
            
            // Load the problem set
            const { getProblem, getProblems } = await import("@/lib/problem-sets");
            
            // Get the problem using the getProblem function
            const subject = roomData.subject_name;
            const difficulty = roomData.difficulty;
            const setNumber = roomData.set_number.toString();
            
            // Get the problems for this set
            const problems = getProblems(subject, difficulty, setNumber);
            
            if (problems) {
              // Update the problem set
              setProblemSet({ problems });
              
              // Update to the specific question that was changed
              setCurrentQuestion(problems[newIndex]);
              console.log("Updated current question from reloaded problem set");
              
              // Update the editor with the new starter code
              const starterCode = getLanguageSpecificStarterCode(problems[newIndex]);
              if (onSelectStarterCode && starterCode) {
                console.log("Updating editor with starter code from reloaded problem");
                onSelectStarterCode(starterCode);
              }
            }
          } catch (err) {
            console.error("Error reloading problem set after question change:", err);
          }
        }
      })
      .subscribe();

    return () => {
      questionSubscription.unsubscribe();
    };
  }, [roomId]);

  // Separate effect for settings changes to avoid interference
  useEffect(() => {
    if (!roomId) return;

    // Subscribe to settings changes
    const settingsSubscription = supabase
      .channel(`room:${roomId}`)
      .on("broadcast", { event: "settings_changed" }, (payload) => {
        // Only update the settings part of roomDetails
        setRoomDetails((prev) => {
          // Keep current question_index to prevent navigation loss
          return {
            ...prev,
            subject_name: payload.payload.subject_name,
            difficulty: payload.payload.difficulty,
            set_number: payload.payload.set_number,
          };
        });

        // Reload the problem set after a settings change
        handleSettingsChange(
          payload.payload.subject_name,
          payload.payload.difficulty,
          payload.payload.set_number
        );
      })
      .subscribe();

    return () => {
      settingsSubscription.unsubscribe();
    };
  }, [roomId]);

  // Helper function to get the appropriate starter code based on language
  const getLanguageSpecificStarterCode = (problem) => {
    if (!problem) return null;

    // Map language to the corresponding property in the problem object
    const languageMap = {
      javascript: "given_javascript",
      python: "given_python",
      java: "given_java",
      cpp: "given_cpp",
    };

    // Get the property name for the current language
    const languageProperty = languageMap[language] || "given_python";

    // Return the language-specific starter code or fall back to the default given code
    return problem[languageProperty];
  };

  // Function to handle settings changes separately from question navigation
  const handleSettingsChange = async (subject, difficulty, setNumber) => {
    try {
      setLoading(true);

      // Import the problem-sets functions
      const { getProblem, getProblems } = await import("@/lib/problem-sets");

      try {
        // Get the problems for this set
        const problems = getProblems(subject, difficulty, setNumber.toString());

        if (problems) {
          // Update the problem set
          setProblemSet({ problems });

          // Reset to the first question in the new problem set
          setQuestionIndex(0);
          setCurrentQuestion(problems[0]);

          // Update editor if there's starter code
          const starterCode = getLanguageSpecificStarterCode(problems[0]);
          if (onSelectStarterCode && starterCode) {
            onSelectStarterCode(starterCode);
          }
        } else {
          console.error("No problems found for this set");
          setProblemSet(null);
          setCurrentQuestion(null);
        }
      } catch (err) {
        console.error("Error loading problem set after settings change:", err);
        setProblemSet(null);
        setCurrentQuestion(null);
      }
    } catch (err) {
      console.error("Error importing problem sets data:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectNextQuestion = async () => {
    if (!roomId || !user || !problemSet || !problemSet.problems) return;

    // Calculate next index, wrapping around to 0 if we reach the end
    const nextIndex = (questionIndex + 1) % problemSet.problems.length;

    // Update local state
    setQuestionIndex(nextIndex);
    setCurrentQuestion(problemSet.problems[nextIndex]);

    try {
      // Update the question index in the database
      await supabase
        .from("rooms")
        .update({ question_index: nextIndex })
        .eq("code", roomId);

      // Broadcast the question change to all users
      await supabase.channel(`room:${roomId}:question`).send({
        type: "broadcast",
        event: "question_change",
        payload: {
          questionIndex: nextIndex,
          userId: user.id,
        },
      });

      // Update the editor content with the new problem's language-specific starter code
      const starterCode = getLanguageSpecificStarterCode(
        problemSet.problems[nextIndex]
      );
      if (onSelectStarterCode && starterCode) {
        onSelectStarterCode(starterCode);
      }
    } catch (error) {
      console.error("Error updating question:", error);
    }
  };

  const selectPreviousQuestion = async () => {
    if (!roomId || !user || !problemSet || !problemSet.problems) return;

    // Calculate previous index, wrapping around to the last problem if we're at the first
    const prevIndex =
      questionIndex === 0 ? problemSet.problems.length - 1 : questionIndex - 1;

    // Update local state
    setQuestionIndex(prevIndex);
    setCurrentQuestion(problemSet.problems[prevIndex]);

    try {
      // Update the question index in the database
      await supabase
        .from("rooms")
        .update({ question_index: prevIndex })
        .eq("code", roomId);

      // Broadcast the question change to all users
      await supabase.channel(`room:${roomId}:question`).send({
        type: "broadcast",
        event: "question_change",
        payload: {
          questionIndex: prevIndex,
          userId: user.id,
        },
      });

      // Update the editor content with the new problem's language-specific starter code
      const starterCode = getLanguageSpecificStarterCode(
        problemSet.problems[prevIndex]
      );
      if (onSelectStarterCode && starterCode) {
        onSelectStarterCode(starterCode);
      }
    } catch (error) {
      console.error("Error updating question:", error);
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
    <div className="h-full overflow-y-auto p-4 bg-[#f8f9fa] dark:bg-[#1e1e1e] border-r border-black/[.08] dark:border-white/[.145] relative">
      <div className="flex justify-between gap-2 mb-6">
        <button
          onClick={selectPreviousQuestion}
          className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700/60 hover:bg-gray-300 dark:hover:bg-gray-600/60 text-gray-800 dark:text-gray-200 dark:border-white/[.145] mr-2 cursor-pointer"
        >
          Previous Question
        </button>
        <button
          onClick={selectNextQuestion}
          className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700/60 hover:bg-gray-300 dark:hover:bg-gray-600/60 text-gray-800 dark:text-gray-200 dark:border-white/[.145] ml-2 cursor-pointer"
        >
          Next Question
        </button>
      </div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
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
        <div className="max-w-none text-black dark:text-gray-200">
          <div className="markdown-content">
            <ReactMarkdown>
              {currentQuestion.problem_instructions}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="font-bold mb-2 text-black dark:text-gray-200">
          Example:
        </h3>
        <div className="p-3 bg-white dark:bg-gray-700/30 rounded">
          <div>
            <strong className="text-black dark:text-gray-200">Usage:</strong>
            <pre className="mt-1 p-2 bg-gray-100 dark:bg-[#1a1c1f]/50 dark:text-[#e0e0e0] rounded overflow-x-auto">
              {currentQuestion.example_usage}
            </pre>
          </div>
          <div className="mt-2">
            <strong className="text-black dark:text-gray-200">Output:</strong>
            <pre className="mt-1 p-2 bg-gray-100 dark:bg-[#1a1c1f]/50 dark:text-[#e0e0e0] rounded overflow-x-auto">
              {currentQuestion.example_output}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
