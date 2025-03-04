"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";

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
    const currentVersion = versionRef.current++;

    try {
      isLocalChangeRef.current = true;

      // Update content in Supabase
      await supabase
        .from("rooms")
        .update({
          content: contentToUpdate,
          version: currentVersion,
        })
        .eq("code", roomId);

      // Broadcast change to other users
      await supabase.channel(`room:${roomId}:content`).send({
        type: "broadcast",
        event: "content",
        payload: {
          content: contentToUpdate,
          userId: user.id,
          version: currentVersion,
        },
      });

      // Clear pending content
      pendingContentRef.current = null;
    } catch (error) {
      console.error("Error updating content:", error);
    } finally {
      // Reset the local change flag after a delay
      setTimeout(() => {
        isLocalChangeRef.current = false;
      }, 100);
    }
  }, [roomId, user]);

  // Handle content changes with debouncing
  const handleEditorChange = (value) => {
    // Update local state immediately for responsive UI
    setContent(value);

    // Store the latest content
    pendingContentRef.current = value;

    // Add this: Save to localStorage immediately
    if (value && value !== "// Start coding here...") {
      localStorage.setItem(`room_${roomId}_content`, value);
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced update
    debounceTimerRef.current = setTimeout(() => {
      updateContentDebounced();
    }, 300); // 300ms debounce time
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
            console.log(
              "Received content update:",
              payload.payload.isJoinSync ? "join sync" : "regular update"
            );

            // Always apply join sync messages, even if they originated from this user
            if (payload.payload.isJoinSync) {
              setContent(payload.payload.content);

              if (
                editorRef.current &&
                editorRef.current.getValue() !== payload.payload.content
              ) {
                // Save cursor position
                const selection = editorRef.current.getSelection();
                const scrollTop = editorRef.current.getScrollTop();
                const scrollLeft = editorRef.current.getScrollLeft();

                // Update content
                editorRef.current.setValue(payload.payload.content);

                // Restore cursor position and scroll
                editorRef.current.setSelection(selection);
                editorRef.current.setScrollTop(scrollTop);
                editorRef.current.setScrollLeft(scrollLeft);
              }

              // Update version
              if (
                payload.payload.version &&
                payload.payload.version >= versionRef.current
              ) {
                versionRef.current = payload.payload.version + 1;
              }

              return;
            }

            // Skip applying regular changes that originated from this user
            if (
              payload.payload.userId === user.id &&
              isLocalChangeRef.current
            ) {
              return;
            }

            // Add this section to handle regular content updates
            setContent(payload.payload.content);

            // Update editor content if it differs from current state
            if (
              editorRef.current &&
              editorRef.current.getValue() !== payload.payload.content
            ) {
              // Save cursor position
              const selection = editorRef.current.getSelection();
              const scrollTop = editorRef.current.getScrollTop();
              const scrollLeft = editorRef.current.getScrollLeft();

              // Update content
              editorRef.current.setValue(payload.payload.content);

              // Restore cursor position and scroll
              editorRef.current.setSelection(selection);
              editorRef.current.setScrollTop(scrollTop);
              editorRef.current.setScrollLeft(scrollLeft);
            }

            // Update version if remote version is higher
            if (
              payload.payload.version &&
              payload.payload.version >= versionRef.current
            ) {
              versionRef.current = payload.payload.version + 1;
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
            // Update users list
            setUsers((prevUsers) => {
              const updatedUsers = [...prevUsers];
              newPresences.forEach((presence) => {
                if (!updatedUsers.some((u) => u.userId === presence.userId)) {
                  updatedUsers.push(presence);
                }
              });
              return updatedUsers;
            });

            // If this user has been in the room for a while and has content,
            // immediately save and broadcast the current content to ensure new users get it
            if (editorRef.current && !loading) {
              const currentContent = editorRef.current.getValue();
              if (
                currentContent &&
                currentContent !== "// Start coding here..."
              ) {
                console.log("New user joined, broadcasting current content");

                // Save to database first
                await saveContentImmediately(currentContent);

                // Then broadcast to all users
                await supabase.channel(`room:${roomId}:content`).send({
                  type: "broadcast",
                  event: "content",
                  payload: {
                    content: currentContent,
                    userId: user.id,
                    version: versionRef.current,
                    isJoinSync: true, // Flag to indicate this is a sync message for new users
                  },
                });
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

  // Add this useEffect after your existing useEffects
  useEffect(() => {
    // Save content periodically (every 10 seconds)
    const intervalId = setInterval(() => {
      if (editorRef.current) {
        const currentContent = editorRef.current.getValue();
        if (currentContent && currentContent !== "// Start coding here...") {
          // Save to localStorage
          localStorage.setItem(`room_${roomId}_content`, currentContent);

          // Save to database
          saveContentImmediately(currentContent);
        }
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [roomId, saveContentImmediately]);

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
        // Save content before page unload
        const currentContent = editorRef.current.getValue();
        if (currentContent && currentContent !== "// Start coding here...") {
          // Use synchronous localStorage as a backup
          localStorage.setItem(`room_${roomId}_content`, currentContent);

          // Try to save to database (may not complete if page is unloading)
          navigator.sendBeacon(
            "/api/save-content",
            JSON.stringify({ roomId, content: currentContent })
          );
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
        </div>

        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-transparent px-2 py-1"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
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

      <div className="flex-grow">
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
    </div>
  );
}
