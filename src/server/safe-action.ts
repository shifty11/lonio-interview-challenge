// The next-safe-action client. An unexpected error is logged. The client gets a generic message.

import { createSafeActionClient } from "next-safe-action";

export const actionClient = createSafeActionClient({
	handleServerError(error) {
		console.error("Server action error:", error);
		return "Something went wrong. Try again.";
	},
});
