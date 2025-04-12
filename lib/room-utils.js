// Function to attempt room deletion using a more advanced approach
export const attemptRoomDeletion = async (roomId, supabase) => {
  try {
    console.log(`Attempting alternative deletion for room ${roomId}`);

    // First approach - standard delete
    const { data, error, count } = await supabase
      .from("rooms")
      .delete()
      .eq("code", roomId);

    if (error) {
      // Check for specific types of errors
      if (error.code === "42501") {
        console.log("Permission denied error - this is likely a policy issue");
      } else if (error.code === "23503") {
        console.log("Foreign key constraint error - there may be related data");
      }

      console.log("Standard deletion failed:", error);
      return false;
    }

    console.log("Room deletion succeeded:", { data, count });
    return count > 0;
  } catch (finalError) {
    console.log("All deletion attempts failed:", finalError);
    return false;
  }
};
