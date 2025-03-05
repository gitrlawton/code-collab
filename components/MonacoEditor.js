"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import CodingQuestion from "@/components/CodingQuestion";

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
  const editorRef = useRef(null);
  const isLocalChangeRef = useRef(false);
  const versionRef = useRef(1);
  const debounceTimerRef = useRef(null);
  const pendingContentRef = useRef(null);
  const decorationsRef = useRef([]); // Track decoration IDs
  const router = useRouter();
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showQuestion, setShowQuestion] = useState(true);

  useEffect(() => {
    return () => {
      isLocalChangeRef.current = false;
    };
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

  // Add this helper function near the top of your component
  const handleRemoteChange = (payload) => {
    if (!editorRef.current) {
      setContent(payload.payload.content);
      return;
    }

    const model = editorRef.current.getModel();
    if (!model) return;

    // Save cursor and scroll state
    const selections = editorRef.current.getSelections();
    const viewState = editorRef.current.saveViewState();

    // Update content
    setContent(payload.payload.content);
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

    // Update version if needed
    if (payload.payload.version > versionRef.current) {
      versionRef.current = payload.payload.version;
    }

    // Restore state
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.restoreViewState(viewState);
        editorRef.current.setSelections(selections);
      }
    });
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
        // Only execute JavaScript code
        if (language === "javascript") {
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
        } else {
          setOutput("Only JavaScript execution is supported.");
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

        setContent(contentToUse || "// Start coding here...");
        setLanguage(data.language || "javascript");

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

        // Track room presence - MOVE THIS BEFORE THE RETURN STATEMENT
        const presenceChannel = supabase.channel(`room:${roomId}:presence`);

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
            setUsers((prevUsers) =>
              prevUsers.filter(
                (user) =>
                  !leftPresences.some((left) => left.userId === user.userId)
              )
            );

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

        // NOW place the return statement at the end of the function
        return () => {
          // Clear any pending debounce timer on cleanup
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
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
      if (editorRef.current) {
        const currentContent = editorRef.current.getValue();
        if (currentContent && currentContent !== "// Start coding here...") {
          localStorage.setItem(`room_${roomId}_content`, currentContent);
          // Don't use sendBeacon, just save to localStorage
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

  // Add a useEffect to listen for output broadcasts
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
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roomId]);

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
          className="mt-4 rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-base h-12 px-5"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {showQuestion && (
        <div className="w-1/3">
          <CodingQuestion onSelectStarterCode={handleSelectStarterCode} />
        </div>
      )}

      <div className={showQuestion ? "w-2/3" : "w-full"}>
        <div className="flex flex-col h-screen">
          <div className="flex justify-between items-center p-4 border-b border-black/[.08] dark:border-white/[.145]">
            <div className="flex items-center">
              <h2 className="text-lg font-bold">Room: {roomId}</h2>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomId);
                }}
                className="ml-2 p-2 rounded hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a]"
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

              {!showQuestion && (
                <button
                  onClick={() => setShowQuestion(true)}
                  className="ml-4 px-3 py-1 text-sm bg-blue-600 text-white rounded"
                >
                  Show Problem
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-transparent px-2 py-1"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
              </select>

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
            </div>
          </div>

          <div className="flex-grow grid grid-rows-[1fr_auto]">
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

            <div className="border-t border-black/[.08] dark:border-white/[.145]">
              <div className="flex justify-end p-2">
                <button
                  onClick={runCode}
                  disabled={isRunning || language !== "javascript"}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {isRunning ? "Running..." : "Run"}
                </button>
              </div>

              <div className="border-t border-black/[.08] dark:border-white/[.145] p-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Output</h3>
                  {output && (
                    <button
                      onClick={() => setOutput("")}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto h-32 font-mono text-sm">
                  {output || "Run your code to see output here..."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
