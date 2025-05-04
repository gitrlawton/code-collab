"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import CodingQuestion from "@/components/CodingQuestion";
import { attemptRoomDeletion } from "@/lib/room-utils";
import RoomSettings from "@/components/RoomSettings";
import ThemeToggle from "@/components/ThemeToggle";

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

export default function CollaborativeEditor({ roomId, user }) {
  const [content, setContent] = useState("// Loading...");
  const [language, setLanguage] = useState("javascript");
  const [users, setUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTooSmall, setIsTooSmall] = useState(false);
  const editorRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const isLocalChangeRef = useRef(false);
  const versionRef = useRef(1);
  const debounceTimerRef = useRef(null);
  const pendingContentRef = useRef(null);
  const decorationsRef = useRef([]); // Track decoration IDs
  const router = useRouter();
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showQuestion, setShowQuestion] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [outputHeight, setOutputHeight] = useState(240); // Default output height
  const [isDragging, setIsDragging] = useState(false);
  const resizeStartYRef = useRef(0);
  const initialHeightRef = useRef(240);
  const [roomSettings, setRoomSettings] = useState({
    subject_name: "",
    difficulty: "Standard",
    set_number: 1,
  });
  // Add Pyodide state
  const [pyodide, setPyodide] = useState(null);
  const [isPyodideLoading, setIsPyodideLoading] = useState(false);

  useEffect(() => {
    return () => {
      isLocalChangeRef.current = false;
    };
  }, []);

  // Load Pyodide when component mounts
  useEffect(() => {
    let isMounted = true;

    // Don't load Pyodide automatically on component mount
    // It will be loaded on-demand when the user selects Python

    return () => {
      isMounted = false;
    };
  }, []);

  // Check if screen is too small for editor
  useEffect(() => {
    const checkScreenSize = () => {
      const mediaQuery = window.matchMedia("(max-width: 1140px)");
      setIsTooSmall(mediaQuery.matches);
    };

    // Initial check
    checkScreenSize();

    // Add listener for window resize
    window.addEventListener("resize", checkScreenSize);

    // Cleanup
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Add this new function to handle starter code selection
  const handleSelectStarterCode = (starterCode) => {
    if (!editorRef.current) return;

    // Save cursor and scroll state
    const selections = editorRef.current.getSelections();
    const viewState = editorRef.current.saveViewState();

    // Update content
    setContent(starterCode);
    const model = editorRef.current.getModel();
    if (model) {
      model.pushEditOperations(
        [],
        [
          {
            range: model.getFullModelRange(),
            text: starterCode,
          },
        ],
        () => selections
      );
    }

    // Restore state
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.restoreViewState(viewState);
        editorRef.current.setSelections(selections);
      }
    });

    // Save to localStorage and broadcast changes
    localStorage.setItem(`room_${roomId}_content`, starterCode);
    pendingContentRef.current = starterCode;
    updateContentDebounced();
  };

  // Function to handle cleanup for user leaving the room
  const leaveRoom = async () => {
    try {
      // Log user leaving
      console.log(
        `%c${user.user_metadata?.name || "Anonymous"} left the room...`,
        "color: red"
      );

      // Check if this user is the last one in the room
      const isLastUser = users.length <= 1;
      console.log(
        `Is last user: ${isLastUser}, Current users: ${users.length}`
      );

      // Save any pending content before leaving
      if (editorRef.current) {
        const currentContent = editorRef.current.getValue();
        if (currentContent && currentContent !== "// Start coding here...") {
          await saveContentImmediately(currentContent);
        }
      }

      // Remove user presence from the room using the stored channel reference
      if (presenceChannelRef.current) {
        await presenceChannelRef.current.untrack();
      }

      // If this is the last user, manually attempt to delete the room
      if (isLastUser) {
        console.log(
          `%cManually attempting to delete room ${roomId} as last user...`,
          "color: red"
        );
        try {
          const success = await attemptRoomDeletion(roomId, supabase);
          console.log(
            `%cManual deletion result: ${success ? "succeeded" : "not completed"}`,
            "color: red"
          );
        } catch (err) {
          console.log(
            `%cError during manual deletion: ${err.message}`,
            "color: red"
          );
        }
      }

      // Unsubscribe from all room channels
      await supabase.removeAllChannels();

      // Clear any pending timers
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Navigate back to homepage
      router.push("/");
    } catch (error) {
      console.error("Error leaving room:", error);
      // Still navigate even if there's an error
      router.push("/");
    }
  };

  // Handle editor mounting
  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;

    // Set up cursor position tracking
    editor.onDidChangeCursorPosition((e) => {
      const position = e.position;
      broadcastCursorPosition(position);
    });

    // Save content to localStorage whenever the editor content changes
    editor.onDidChangeModelContent(() => {
      if (
        editor.getValue() &&
        editor.getValue() !== "// Start coding here..."
      ) {
        localStorage.setItem(`room_${roomId}_content`, editor.getValue());
      }
    });

    // Request latest content from other users when joining
    requestLatestContent();
  };

  // Function to run the code
  const runCode = async () => {
    if (!editorRef.current) return;

    const code = editorRef.current.getValue();
    if (!code || code === "// Start coding here...") return;

    setIsRunning(true);
    setOutput(""); // Clear previous output

    try {
      // Create a proxy console to capture logs
      const logs = [];
      const originalConsoleLog = console.log;

      // Override console.log temporarily
      console.log = (...args) => {
        logs.push(
          args
            .map((arg) =>
              typeof arg === "object" ? JSON.stringify(arg) : String(arg)
            )
            .join(" ")
        );
        // Still log to the browser console for debugging
        originalConsoleLog(...args);
      };

      // Execute the code in a try-catch block
      try {
        if (language === "javascript") {
          // Execute JavaScript code
          const executedFunction = new Function(code);
          await executedFunction();
          const outputText = logs.join("\n");
          setOutput(outputText);

          // Broadcast the output to all users in the room
          await supabase.channel(`room:${roomId}`).send({
            type: "broadcast",
            event: "code-output",
            payload: {
              output: outputText,
              userName: user?.user_metadata?.name || user?.email || "Anonymous",
              timestamp: new Date().toISOString(),
            },
          });
        } else if (language === "python") {
          // Execute Python code using Pyodide
          if (!pyodide) {
            // Load Pyodide if not already loaded
            setIsPyodideLoading(true);
            try {
              // Load Pyodide using our simplified utility
              const pyodideInstance = await loadPyodideInstance();
              setPyodide(pyodideInstance);

              // Continue with Python execution after loading
              await executePythonCode(pyodideInstance, code);
            } catch (err) {
              console.error("Error loading Pyodide:", err);
              setOutput("Error loading Python interpreter: " + err.message);
              setIsRunning(false);
              return;
            } finally {
              setIsPyodideLoading(false);
            }
          } else {
            // Pyodide is already loaded, proceed with execution
            await executePythonCode(pyodide, code);
          }
        } else {
          setOutput(`Language '${language}' is not supported for execution.`);
        }
      } catch (error) {
        const errorOutput = `Error: ${error.message}`;
        setOutput(errorOutput);

        // Broadcast the error to all users in the room
        await supabase.channel(`room:${roomId}`).send({
          type: "broadcast",
          event: "code-output",
          payload: {
            output: errorOutput,
            userName: user?.user_metadata?.name || user?.email || "Anonymous",
            timestamp: new Date().toISOString(),
            isError: true,
          },
        });
      } finally {
        // Restore the original console.log
        console.log = originalConsoleLog;
      }
    } catch (error) {
      const executionError = `Execution error: ${error.message}`;
      setOutput(executionError);

      // Broadcast the execution error
      await supabase.channel(`room:${roomId}`).send({
        type: "broadcast",
        event: "code-output",
        payload: {
          output: executionError,
          userName: user?.user_metadata?.name || user?.email || "Anonymous",
          timestamp: new Date().toISOString(),
          isError: true,
        },
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Helper function to execute Python code with improved error handling
  const executePythonCode = async (pyodideInstance, code) => {
    if (!pyodideInstance) {
      throw new Error("Python interpreter is not available");
    }

    try {
      // Redirect Python print statements to capture output
      await pyodideInstance.runPythonAsync(`
        import sys
        from pyodide.ffi import create_proxy
        
        class PyodideOutput:
            def __init__(self):
                self.content = []
            
            def write(self, text):
                self.content.append(text)
            
            def flush(self):
                pass
        
        sys.stdout = PyodideOutput()
        sys.stderr = PyodideOutput()
      `);

      // Execute the Python code
      await pyodideInstance.runPythonAsync(code);

      // Get the captured output
      const stdoutContent =
        await pyodideInstance.runPythonAsync(`sys.stdout.content`);
      const stderrContent =
        await pyodideInstance.runPythonAsync(`sys.stderr.content`);

      const outputArr = [];
      if (stdoutContent && stdoutContent.length > 0) {
        outputArr.push(...stdoutContent);
      }
      if (stderrContent && stderrContent.length > 0) {
        outputArr.push(...stderrContent);
      }

      const outputText = outputArr.join("");
      setOutput(outputText);

      // Broadcast the output to all users in the room
      try {
        await supabase.channel(`room:${roomId}`).send({
          type: "broadcast",
          event: "code-output",
          payload: {
            output: outputText,
            userName: user?.user_metadata?.name || user?.email || "Anonymous",
            timestamp: new Date().toISOString(),
          },
        });
      } catch (broadcastError) {
        console.error("Error broadcasting Python output:", broadcastError);
        // Continue despite broadcast error, output is still displayed locally
      }
    } catch (executionError) {
      // Handle Python execution errors gracefully
      const errorMessage = `Python Error: ${executionError.message}`;
      console.error(errorMessage);
      setOutput(errorMessage);

      // Try to broadcast the error
      try {
        await supabase.channel(`room:${roomId}`).send({
          type: "broadcast",
          event: "code-output",
          payload: {
            output: errorMessage,
            userName: user?.user_metadata?.name || user?.email || "Anonymous",
            timestamp: new Date().toISOString(),
            isError: true,
          },
        });
      } catch (broadcastError) {
        // Ignore broadcast errors
      }
    }
  };

  // Broadcast cursor position to other users
  const broadcastCursorPosition = async (position) => {
    if (!user || !roomId) return;

    await supabase.channel(`room:${roomId}:cursor`).send({
      type: "broadcast",
      event: "cursor",
      payload: {
        userId: user.id,
        userName: user.user_metadata?.name || "Anonymous",
        position: {
          lineNumber: position.lineNumber,
          column: position.column,
        },
      },
    });
  };

  // Request the latest content from other users in the room
  const requestLatestContent = async () => {
    if (!user || !roomId) return;

    console.log("Requesting latest content from other users");

    await supabase.channel(`room:${roomId}:sync`).send({
      type: "broadcast",
      event: "request_content",
      payload: {
        userId: user.id,
        timestamp: Date.now(),
      },
    });
  };

  // Function to save content immediately without debouncing
  const saveContentImmediately = async (contentToSave) => {
    if (!roomId || !user) return;

    try {
      // Update content in Supabase
      await supabase
        .from("rooms")
        .update({
          content: contentToSave,
          version: versionRef.current++,
        })
        .eq("code", roomId);
    } catch (error) {
      console.error("Error saving content immediately:", error);
    }
  };

  // Debounced function to update content in Supabase and broadcast changes
  const updateContentDebounced = useCallback(async () => {
    if (!pendingContentRef.current) return;

    const contentToUpdate = pendingContentRef.current;
    const timestamp = Date.now();

    try {
      // Broadcast changes first
      await supabase.channel(`room:${roomId}:content`).send({
        type: "broadcast",
        event: "content",
        payload: {
          content: contentToUpdate,
          userId: user.id,
          timestamp: timestamp,
        },
      });

      // Then update database
      const { error: updateError } = await supabase
        .from("rooms")
        .update({
          content: contentToUpdate,
          last_updated: timestamp,
        })
        .eq("code", roomId);

      if (updateError) {
        console.error("Error updating room:", updateError);
        return;
      }

      pendingContentRef.current = null;
    } catch (error) {
      console.error("Error in real-time update:", error);
    }
  }, [roomId, user]);

  // Handle content changes with debouncing
  const handleEditorChange = (value) => {
    // Skip if this is a remote change being applied
    if (isLocalChangeRef.current) return;

    // Skip if content hasn't actually changed
    if (value === content) return;

    // Update local state and pending content
    setContent(value);
    pendingContentRef.current = value;

    // Save to localStorage
    if (value && value !== "// Start coding here...") {
      localStorage.setItem(`room_${roomId}_content`, value);
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the update with a longer delay
    debounceTimerRef.current = setTimeout(() => {
      updateContentDebounced();
    }, 300); // Number of ms to wait after user is done typing before updating
  };

  // Set up real-time collaboration
  useEffect(() => {
    if (!roomId || !user) return;

    const fetchRoomData = async () => {
      try {
        setLoading(true);

        // Check if we have content in localStorage (from a previous session)
        const localContent = localStorage.getItem(`room_${roomId}_content`);

        // Get room data from database
        const { data, error } = await supabase
          .from("rooms")
          .select("*")
          .eq("code", roomId)
          .single();

        if (error) throw error;
        if (!data) throw new Error("Room not found");

        // Determine which content to use (prioritize database content unless it's default)
        let contentToUse = data.content;

        // If database has default content but localStorage has content, use localStorage
        if (
          (contentToUse === "// Start coding here..." || !contentToUse) &&
          localContent
        ) {
          contentToUse = localContent;

          // Update database with localStorage content
          await saveContentImmediately(localContent);
        }

        // Set the programming language based on the content
        let languageToUse = data.language || "javascript";
        if (
          contentToUse.trim().startsWith("def ") ||
          (contentToUse.includes("import ") && contentToUse.includes("print("))
        ) {
          languageToUse = "python";
        } else if (
          contentToUse.includes("public class") ||
          contentToUse.includes("private class")
        ) {
          languageToUse = "java";
        } else if (
          contentToUse.includes("#include") &&
          (contentToUse.includes("<iostream>") ||
            contentToUse.includes("<stdio.h>"))
        ) {
          languageToUse = "cpp";
        } else {
          languageToUse = "javascript"; // Explicitly default to JavaScript
        }

        setContent(contentToUse || "// Start coding here...");
        setLanguage(languageToUse);

        // Initialize version from database or default to 1
        versionRef.current = data.version ? data.version + 1 : 1;

        // Subscribe to content changes
        const contentSubscription = supabase
          .channel(`room:${roomId}:content`)
          .on("broadcast", { event: "content" }, (payload) => {
            // Skip if this is our own change
            if (payload.payload.userId === user.id) {
              return;
            }

            if (editorRef.current) {
              const model = editorRef.current.getModel();
              if (!model) return;

              // Skip if content hasn't changed
              const currentContent = model.getValue();
              if (currentContent === payload.payload.content) {
                return;
              }

              // Set flag before making changes
              isLocalChangeRef.current = true;

              try {
                // Save cursor and scroll state
                const selections = editorRef.current.getSelections();
                const viewState = editorRef.current.saveViewState();

                // Update content
                setContent(payload.payload.content);

                // Update model in a single operation
                model.pushEditOperations(
                  [],
                  [
                    {
                      range: model.getFullModelRange(),
                      text: payload.payload.content,
                    },
                  ],
                  () => selections
                );

                // Restore state immediately
                editorRef.current.restoreViewState(viewState);
                editorRef.current.setSelections(selections);
              } finally {
                // Reset flag immediately after changes
                isLocalChangeRef.current = false;
              }
            } else {
              setContent(payload.payload.content);
            }
          })
          .subscribe();

        // Subscribe to cursor changes
        const cursorSubscription = supabase
          .channel(`room:${roomId}:cursor`)
          .on("broadcast", { event: "cursor" }, (payload) => {
            if (payload.payload.userId !== user.id) {
              setCursors((prev) => {
                // Update or add the cursor for this user
                return {
                  ...prev,
                  [payload.payload.userId]: {
                    position: payload.payload.position,
                    userName: payload.payload.userName,
                  },
                };
              });
            }
          })
          .subscribe();

        // Subscribe to sync requests
        const syncSubscription = supabase
          .channel(`room:${roomId}:sync`)
          .on("broadcast", { event: "request_content" }, async (payload) => {
            // Only respond if this is not the requesting user and we have content
            if (payload.payload.userId !== user.id && editorRef.current) {
              const currentContent = editorRef.current.getValue();
              if (
                currentContent &&
                currentContent !== "// Start coding here..."
              ) {
                console.log("Responding to content request");

                // Send current content to all users with the join sync flag
                await supabase.channel(`room:${roomId}:content`).send({
                  type: "broadcast",
                  event: "content",
                  payload: {
                    content: currentContent,
                    userId: user.id,
                    version: versionRef.current,
                    isJoinSync: true,
                  },
                });
              }
            }
          })
          .subscribe();

        // Track room presence
        const presenceChannel = supabase.channel(`room:${roomId}:presence`);
        // Store the reference
        presenceChannelRef.current = presenceChannel;

        const presenceSubscription = presenceChannel
          .on("presence", { event: "join" }, async ({ newPresences }) => {
            // Update users list first
            setUsers((prevUsers) => {
              const updatedUsers = [...prevUsers];
              newPresences.forEach((presence) => {
                if (!updatedUsers.some((u) => u.userId === presence.userId)) {
                  updatedUsers.push(presence);
                }
              });
              return updatedUsers;
            });

            // Only sync content if we're the longest-present user
            const isLongestPresentUser = users.length === 0;

            if (isLongestPresentUser && editorRef.current && !loading) {
              const currentContent = editorRef.current.getValue();
              if (
                currentContent &&
                currentContent !== "// Start coding here..."
              ) {
                console.log("New user joined, syncing content as primary user");

                // Set a sync lock
                isLocalChangeRef.current = true;

                try {
                  // Update database first
                  const { error: updateError } = await supabase
                    .from("rooms")
                    .update({
                      content: currentContent,
                      last_updated: Date.now(),
                    })
                    .eq("code", roomId);

                  if (!updateError) {
                    // Then broadcast to all users
                    await supabase.channel(`room:${roomId}:content`).send({
                      type: "broadcast",
                      event: "content",
                      payload: {
                        content: currentContent,
                        userId: user.id,
                        version: versionRef.current,
                        isJoinSync: true,
                        timestamp: Date.now(),
                      },
                    });
                  }
                } catch (error) {
                  console.error("Error syncing content for new user:", error);
                } finally {
                  // Release the sync lock after a delay
                  setTimeout(() => {
                    isLocalChangeRef.current = false;
                  }, 500);
                }
              }
            }
          })
          .on("presence", { event: "leave" }, ({ leftPresences }) => {
            // Log user leaving in red
            leftPresences.forEach((presence) => {
              console.log(
                `%c${presence.userName} left the room...`,
                "color: red"
              );
            });

            setUsers((prevUsers) => {
              const updatedUsers = prevUsers.filter(
                (user) =>
                  !leftPresences.some((left) => left.userId === user.userId)
              );

              // Check if this was the last user leaving
              if (updatedUsers.length === 0) {
                console.log(
                  "%cAll users have left. Cleaning up room...",
                  "color: red"
                );
                // Use the utility function for deletion
                try {
                  attemptRoomDeletion(roomId, supabase)
                    .then((success) => {
                      if (success) {
                        console.log(
                          `%cRoom ${roomId} deleted successfully`,
                          "color: red"
                        );
                      } else {
                        console.log(
                          `%cUnable to delete room ${roomId}`,
                          "color: red"
                        );
                      }
                    })
                    .catch((err) => {
                      console.log(
                        `%cError during room deletion: ${err.message}`,
                        "color: red"
                      );
                    });
                } catch (err) {
                  console.log(
                    `%cException in room deletion: ${err.message}`,
                    "color: red"
                  );
                }
              }

              return updatedUsers;
            });

            // Remove cursor for users who left
            setCursors((prev) => {
              const updated = { ...prev };
              leftPresences.forEach((presence) => {
                delete updated[presence.userId];
              });
              return updated;
            });
          });

        // Subscribe first, then track presence after subscription is complete
        await presenceSubscription.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // Only track presence after subscription is confirmed
            await presenceChannel.track({
              userId: user.id,
              userName: user.user_metadata?.name || "Anonymous",
            });
          }
        });

        setLoading(false);

        return () => {
          // Clear any pending debounce timer on cleanup
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          // Log the user leaving when the component unmounts
          console.log(
            `%c${user.user_metadata?.name || "Anonymous"} left the room...`,
            "color: red"
          );

          // Make sure to untrack presence when component unmounts
          if (presenceChannelRef.current) {
            presenceChannelRef.current.untrack();
          }

          contentSubscription.unsubscribe();
          cursorSubscription.unsubscribe();
          syncSubscription.unsubscribe();
          presenceSubscription.unsubscribe();
        };
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchRoomData();
  }, [roomId, user, updateContentDebounced]);

  // Render cursors for other users
  useEffect(() => {
    if (!editorRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    // Clear previous decorations first
    if (decorationsRef.current.length > 0) {
      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        []
      );
    }

    // Create new decorations for each user's cursor
    const newDecorations = Object.entries(cursors).map(
      ([userId, { position, userName }]) => {
        return {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          options: {
            className: `cursor-${userId.substring(0, 8)}`,
            hoverMessage: { value: userName },
            isWholeLine: false,
            stickiness: 1, // TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
            beforeContentClassName: `cursor-before-${userId.substring(0, 8)}`,
          },
        };
      }
    );

    // Apply new decorations and store their IDs
    if (newDecorations.length > 0) {
      decorationsRef.current = editorRef.current.deltaDecorations(
        [],
        newDecorations
      );
    }

    // Add cursor style to document
    const styleElement =
      document.getElementById("cursor-styles") ||
      document.createElement("style");
    styleElement.id = "cursor-styles";

    let styleContent = "";
    Object.keys(cursors).forEach((userId, index) => {
      const hue = (index * 137) % 360; // Generate distinct colors
      styleContent += `
        .cursor-${userId.substring(0, 8)} {
          position: relative;
        }
        .cursor-before-${userId.substring(0, 8)} {
          position: absolute;
          border-left: 2px solid hsla(${hue}, 70%, 50%, 0.8);
          height: 100%;
          content: '';
        }
      `;
    });

    styleElement.textContent = styleContent;
    if (!document.getElementById("cursor-styles")) {
      document.head.appendChild(styleElement);
    }
  }, [cursors]);

  // Save content when tab visibility changes or before page unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && editorRef.current) {
        // Save content when tab becomes hidden
        const currentContent = editorRef.current.getValue();
        if (currentContent && currentContent !== "// Start coding here...") {
          saveContentImmediately(currentContent);
        }
      }
    };

    const handleBeforeUnload = () => {
      // Log user leaving when they close the tab or navigate away
      console.log(
        `%c${user.user_metadata?.name || "Anonymous"} left the room...`,
        "color: red"
      );

      // Make sure to untrack presence
      if (presenceChannelRef.current) {
        // This is async but we can't await in beforeunload
        presenceChannelRef.current.untrack();
      }

      if (editorRef.current) {
        const currentContent = editorRef.current.getValue();
        if (currentContent && currentContent !== "// Start coding here...") {
          localStorage.setItem(`room_${roomId}_content`, currentContent);
          // Try to save content to server too
          fetch("/api/save-content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, content: currentContent }),
            // Use keepalive to allow the request to complete even as the page unloads
            keepalive: true,
          }).catch(() => {
            // We can't do anything if this fails during page unload
          });
        }
      }
    };

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // Remove event listeners on cleanup
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [roomId, user, saveContentImmediately]);

  // useEffect to listen for output broadcasts
  useEffect(() => {
    if (!roomId) return;

    // Subscribe to code output events
    const channel = supabase.channel(`room:${roomId}`);

    channel
      .on("broadcast", { event: "code-output" }, (payload) => {
        const {
          output: receivedOutput,
          userName,
          timestamp,
          isError,
        } = payload.payload;

        // Format the output with user information
        const formattedOutput = `[${new Date(timestamp).toLocaleTimeString()}] ${userName} ran the code:\n${receivedOutput}`;

        setOutput(formattedOutput);
      })
      .on("broadcast", { event: "settings_changed" }, async (payload) => {
        // Show a notification about settings change
        const notification = `Room settings updated by ${payload.payload.updatedBy}`;
        setOutput((prev) => `${notification}\n\n${prev || ""}`);

        // Update local settings state with the broadcast values
        setRoomSettings({
          subject_name: payload.payload.subject_name,
          difficulty: payload.payload.difficulty,
          set_number: payload.payload.set_number,
        });

        // Clear any cached content
        localStorage.removeItem(`room_${roomId}_content`);

        try {
          // Fetch the updated room data without refreshing the page
          const { data, error } = await supabase
            .from("rooms")
            .select("*")
            .eq("code", roomId)
            .single();

          if (!error && data) {
            // Request latest content to update editor
            requestLatestContent();
          }
        } catch (err) {
          console.error(
            "Error refreshing after settings change broadcast:",
            err
          );
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roomId]);

  // Add this effect to keep room settings updated
  useEffect(() => {
    if (!roomId) return;

    const fetchRoomSettings = async () => {
      try {
        console.log("Fetching room settings for room:", roomId);
        const { data, error } = await supabase
          .from("rooms")
          .select("subject_name, difficulty, set_number")
          .eq("code", roomId)
          .single();

        if (error) {
          console.error("Supabase error fetching room settings:", error);
          // Provide fallback values if there's an error
          setRoomSettings({
            subject_name: "javascript",
            difficulty: "Standard",
            set_number: 1,
          });
          return;
        }

        if (!data) {
          console.error("No data returned when fetching room settings");
          // Provide fallback values if there's no data
          setRoomSettings({
            subject_name: "javascript",
            difficulty: "Standard",
            set_number: 1,
          });
          return;
        }

        // Use default values for any missing fields
        setRoomSettings({
          subject_name: data.subject_name || "javascript",
          difficulty: data.difficulty || "Standard",
          set_number: data.set_number || 1,
        });

        console.log("Successfully fetched room settings:", data);
      } catch (err) {
        // Handle empty error object case
        console.error(
          "Error fetching room settings:",
          err && Object.keys(err).length ? err : "Unknown error"
        );

        // Set default values as fallback
        setRoomSettings({
          subject_name: "javascript",
          difficulty: "Standard",
          set_number: 1,
        });
      }
    };

    fetchRoomSettings();
  }, [roomId]);

  // Replace the current getPyodide function with a more robust approach that suppresses errors
  const loadPyodideInstance = async () => {
    try {
      setIsPyodideLoading(true);

      // If Pyodide is already loaded, use it
      if (window.loadPyodide) {
        const pyodideInstance = await window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
        });
        return pyodideInstance;
      }

      // Create and load a direct script element
      return new Promise((resolve, reject) => {
        // Override window.onerror temporarily to catch and suppress the "Unexpected token" error
        const originalOnError = window.onerror;
        window.onerror = function (message, source, lineno, colno, error) {
          // Check if this is the Pyodide script error we want to suppress
          if (
            message &&
            message.includes("Unexpected token") &&
            source &&
            source.includes("pyodide")
          ) {
            console.log("Suppressing Pyodide loading error:", message);
            return true; // Suppress the error
          }
          // Otherwise, use the original handler
          return originalOnError
            ? originalOnError(message, source, lineno, colno, error)
            : false;
        };

        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js";
        script.onload = async () => {
          try {
            // Restore original error handler
            window.onerror = originalOnError;

            // Once script is loaded, initialize Pyodide
            if (window.loadPyodide) {
              const pyodideInstance = await window.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
              });
              resolve(pyodideInstance);
            } else {
              reject(new Error("loadPyodide function not available"));
            }
          } catch (err) {
            // Restore original error handler
            window.onerror = originalOnError;
            reject(err);
          }
        };
        script.onerror = () => {
          // Restore original error handler
          window.onerror = originalOnError;
          reject(new Error("Failed to load Pyodide script"));
        };

        // Add script to document
        document.head.appendChild(script);
      });
    } catch (err) {
      console.error("Pyodide loading error (suppressed):", err);
      // Continue despite errors since functionality works
      throw err;
    } finally {
      setIsPyodideLoading(false);
    }
  };

  // Add a global error suppression for Pyodide-related errors
  useEffect(() => {
    // Keep track of the original error handler
    const originalOnError = window.onerror;

    // Set up our custom error handler to suppress Pyodide-related errors
    window.onerror = function (message, source, lineno, colno, error) {
      // Check if this is a Pyodide-related error
      if (
        (message &&
          typeof message === "string" &&
          (message.includes("Unexpected token") ||
            message.includes("pyodide"))) ||
        (source && typeof source === "string" && source.includes("pyodide"))
      ) {
        console.log("Suppressing Pyodide error:", message);
        return true; // Suppress the error
      }

      // Pass other errors to the original handler
      return originalOnError
        ? originalOnError(message, source, lineno, colno, error)
        : false;
    };

    // Clean up when component unmounts
    return () => {
      window.onerror = originalOnError;
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      // Calculate height change based on initial position
      // Moving up (smaller Y) should increase output height
      const deltaY = resizeStartYRef.current - e.clientY;
      const newHeight = Math.max(
        120,
        Math.min(500, initialHeightRef.current + deltaY)
      );
      setOutputHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    if (isDragging) {
      // Prevent text selection during drag
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ns-resize";

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded max-w-md">
          <p>{error}</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="mt-4 rounded-full border border-solid border-black/[.08] dark:border-white/[.145] flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#3a3a3a] hover:border-transparent text-base h-12 px-5 cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (isTooSmall) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 bg-gray-100 dark:bg-gray-800 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-4 text-gray-500 dark:text-gray-400"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
          Screen Too Small
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          <strong>CodeCollab</strong> was designed to be accessed on screens
          1140px and larger.
        </p>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Please return on a larger device or adjust your screen size.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400 dark:text-white dark:bg-gray-600 dark:hover:bg-gray-500 cursor-pointer"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen dark:bg-[#1e1e1e]">
      {showQuestion && (
        <div className="w-1/3">
          <CodingQuestion
            onSelectStarterCode={handleSelectStarterCode}
            roomId={roomId}
            user={user}
            language={language}
          />
        </div>
      )}

      <div className={showQuestion ? "w-2/3" : "w-full"}>
        <div className="flex flex-col h-screen">
          <div className="flex justify-between items-center p-4 border-b border-black/[.08] dark:border-white/[.145]">
            <div className="flex items-center">
              <h2 className="text-lg font-bold text-black dark:text-gray-200">
                Room: {roomId}
              </h2>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomId);
                }}
                className="ml-2 p-2 rounded hover:bg-[#f2f2f2] dark:text-gray-200 dark:hover:bg-[#3a3a3a] cursor-pointer"
                title="Copy room code"
              >
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
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>

              {/* Settings Button */}
              <button
                onClick={() => setShowSettings(true)}
                className="ml-4 px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded flex items-center cursor-pointer"
                title="Room Settings"
              >
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
                  className="mr-1"
                >
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                Settings
              </button>

              {/* Leave Room button */}
              <button
                onClick={leaveRoom}
                className="ml-4 px-3 py-1 text-sm bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white rounded cursor-pointer"
                title="Leave this room"
              >
                Leave Room
              </button>
            </div>

            <div className="flex items-center gap-1">
              {users.map((user, index) => (
                <div
                  key={user.userId}
                  className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs"
                  title={user.userName}
                  style={{
                    backgroundColor: `hsl(${(index * 137) % 360}, 70%, 50%)`,
                    marginLeft: index > 0 ? "-0.5rem" : "0",
                  }}
                >
                  {user.userName?.charAt(0) || "A"}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={runCode}
                disabled={
                  isRunning || (language === "python" && isPyodideLoading)
                }
                className="ml-4 px-3 py-1 text-sm bg-gray-200 text-black rounded hover:bg-gray-300 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 mr-2"
                  aria-hidden="true"
                >
                  <polygon points="6,4 16,10 6,16" />
                </svg>
                {isRunning
                  ? "Running..."
                  : isPyodideLoading && language === "python"
                    ? "Loading Python..."
                    : "Run"}
              </button>
              <select
                value={language}
                onChange={(e) => {
                  const newLanguage = e.target.value;
                  setLanguage(newLanguage);

                  // Get current question's starter code for the selected language
                  if (roomId && showQuestion) {
                    // Fetch the current problem data
                    supabase
                      .from("rooms")
                      .select(
                        "subject_name, difficulty, set_number, question_index"
                      )
                      .eq("code", roomId)
                      .single()
                      .then(async ({ data }) => {
                        if (data) {
                          try {
                            // Load the problem set using the updated problem-sets module
                            const { getProblem } = await import(
                              "@/lib/problem-sets"
                            );

                            const subject = data.subject_name;
                            const difficulty = data.difficulty;
                            const setNumber = data.set_number.toString();
                            const questionIndex = data.question_index || 0;

                            // Get the current problem using the getProblem function
                            const currentProblem = getProblem(
                              subject,
                              difficulty,
                              setNumber,
                              questionIndex
                            );

                            if (currentProblem) {
                              // Get the language-specific starter code
                              const starterCodeKey = `given_${newLanguage}`;
                              if (currentProblem[starterCodeKey]) {
                                // Update the editor content with the language-specific starter code
                                if (editorRef.current) {
                                  // Save cursor and scroll state
                                  const selections =
                                    editorRef.current.getSelections();
                                  const viewState =
                                    editorRef.current.saveViewState();

                                  // Update content state
                                  const newContent =
                                    currentProblem[starterCodeKey];
                                  setContent(newContent);

                                  // Update editor model
                                  const model = editorRef.current.getModel();
                                  if (model) {
                                    model.pushEditOperations(
                                      [],
                                      [
                                        {
                                          range: model.getFullModelRange(),
                                          text: newContent,
                                        },
                                      ],
                                      () => selections
                                    );
                                  }

                                  // Restore state
                                  requestAnimationFrame(() => {
                                    if (editorRef.current) {
                                      editorRef.current.restoreViewState(
                                        viewState
                                      );
                                      editorRef.current.setSelections(
                                        selections
                                      );
                                    }
                                  });

                                  // Save to localStorage and broadcast changes
                                  localStorage.setItem(
                                    `room_${roomId}_content`,
                                    newContent
                                  );
                                  pendingContentRef.current = newContent;
                                  updateContentDebounced();
                                }
                              }
                            }
                          } catch (err) {
                            console.error(
                              "Error loading language-specific starter code:",
                              err
                            );
                          }
                        }
                      })
                      .catch((err) => {
                        console.error(
                          "Error fetching room data for language switch:",
                          err
                        );
                      });
                  }

                  // Preload Pyodide when selecting Python
                  if (
                    newLanguage === "python" &&
                    !pyodide &&
                    !isPyodideLoading
                  ) {
                    const loadPyodideAsync = async () => {
                      try {
                        setIsPyodideLoading(true);

                        // Load Pyodide using our simplified utility
                        const pyodideInstance = await loadPyodideInstance();
                        setPyodide(pyodideInstance);
                        console.log("Pyodide loaded successfully");
                      } catch (err) {
                        console.error("Error loading Pyodide:", err);
                        setError(
                          "Failed to load Python interpreter. JavaScript execution is still available."
                        );
                      } finally {
                        setIsPyodideLoading(false);
                      }
                    };
                    loadPyodideAsync();
                  }
                }}
                className="rounded border border-solid border-black/[.08] bg-gray-200 dark:text-gray-200 dark:bg-gray-700 dark:hover:ring-1 dark:hover:ring-white/30 hover:ring-1 hover:ring-black/30 px-2 py-1 cursor-pointer"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
              </select>

              <ThemeToggle className="text-gray-600 hover:text-black hover:bg-[#f2f2f2] dark:text-gray-300 dark:hover:bg-[#2f3237] dark:hover:text-white" />

              {/* <div className="flex items-center gap-1">
                {users.map((user, index) => (
                  <div
                    key={user.userId}
                    className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs"
                    title={user.userName}
                    style={{
                      backgroundColor: `hsl(${(index * 137) % 360}, 70%, 50%)`,
                      marginLeft: index > 0 ? "-0.5rem" : "0",
                    }}
                  >
                    {user.userName?.charAt(0) || "A"}
                  </div>
                ))}
              </div> */}
            </div>
          </div>

          <div className="flex-grow grid grid-rows-[1fr_auto] min-h-0 w-full overflow-hidden">
            <div className="min-h-0 w-full">
              <MonacoEditor
                height="100%"
                language={language}
                value={content}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  wordWrap: "on",
                  automaticLayout: true,
                }}
              />
            </div>

            {/* Resizable handle */}
            <div
              className="h-2 cursor-ns-resize bg-gray-200 dark:bg-[#1a1c1f] flex items-center justify-center"
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDragging(true);
                resizeStartYRef.current = e.clientY;
                initialHeightRef.current = outputHeight;
              }}
            >
              <div className="w-16 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
            </div>

            <div
              style={{ height: `${outputHeight}px` }}
              className="border-t border-black/[.08] dark:border-white/[.145] overflow-hidden"
            >
              <div className="p-2 h-full flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-black dark:text-gray-200">
                    Output:
                  </strong>
                </div>

                <pre className="bg-gray-100 dark:bg-gray-700/30 dark:text-[#e0e0e0] p-4 rounded overflow-auto flex-grow font-mono text-sm">
                  {output || "Run your code to see output here..."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Room Settings Modal */}
      {showSettings && (
        <RoomSettings
          roomId={roomId}
          initialSettings={roomSettings}
          onClose={() => setShowSettings(false)}
          onSave={async (updatedSettings) => {
            setShowSettings(false);

            // Update local state immediately
            setRoomSettings(updatedSettings);

            // Request the latest content after settings change
            try {
              // Clear any cached content to force a re-fetch
              localStorage.removeItem(`room_${roomId}_content`);

              // This will trigger a reload of the CodingQuestion component
              requestLatestContent();
            } catch (err) {
              console.error("Error refreshing after settings change:", err);
            }
          }}
        />
      )}
    </div>
  );
}
