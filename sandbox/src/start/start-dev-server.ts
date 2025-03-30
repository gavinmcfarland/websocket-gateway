import { timeStamp } from "node:console";
import { createClient } from "../../../src/client.js";
import type { SocketClient } from "../../../src/client.js";
import { watch } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";

/**
 * Watches for file changes in the specified directory and notifies connected Figma clients
 * @param client The Socket client instance used to broadcast messages
 */
function watchForFileChanges(client: SocketClient) {
	// Mock directory to watch - adjust this path as needed
	const watchDir = join(process.cwd());

	console.log(chalk.green("✓"), chalk.dim(`Watching directory: ${watchDir}`));

	watch(watchDir, { recursive: true }, (eventType, filename) => {
		if (filename) {
			// Send message to all connected Figma clients
			client.emit(
				"FILE_CHANGED",
				{
					timeStamp: new Date().toISOString(),
					file: filename,
					event: eventType,
				},
				["figma"]
			);
		}
	});
}

// Initialize the client using the factory
const devServer = createClient({
	source: "dev-server",
});

// Start watching for file changes
watchForFileChanges(devServer);
