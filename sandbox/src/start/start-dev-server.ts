import { timeStamp } from "node:console";
import { DevServerClient } from "../client/dev-server-client";
import { watch } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";

/**
 * Watches for file changes in the specified directory and notifies connected Figma clients
 * @param client The DevServer client instance used to broadcast messages
 */
function watchForFileChanges(client: DevServerClient) {
	// Mock directory to watch - adjust this path as needed
	const watchDir = join(process.cwd());

	console.log(chalk.green("✓"), chalk.dim(`Watching directory: ${watchDir}`));

	watch(watchDir, { recursive: true }, (eventType, filename) => {
		if (filename) {
			// Send message to all connected Figma clients
			client.emit(
				"MESSAGE_TO_TYPE",
				{
					targetType: "figma",
					message: {
						timeStamp: new Date().toISOString(),
						type: "FILE_CHANGED",
						file: filename,
						event: eventType,
					},
				},
				(response: any) => {
					if (response?.error) {
						console.log(
							chalk.red("✗"),
							chalk.dim(
								`Failed to notify about ${filename}: ${response.error}`
							)
						);
					} else {
						console.log(
							chalk.green("✓"),
							chalk.dim(`File ${filename} changed: ${eventType}`)
						);
					}
				}
			);
		}
	});
}

// Initialize the development server client
const devServer = new DevServerClient();

// Start watching for file changes
watchForFileChanges(devServer);
