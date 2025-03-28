import { io } from "socket.io-client";
import { createInterface } from "node:readline";
import chalk from "chalk";

class NodeClient {
	private socket = io("http://localhost:8080", {
		auth: { clientType: "dev-server" },
	});

	constructor() {
		console.log(chalk.cyan("\n🤖 Starting Node Client...\n"));

		this.socket.on("connect", () => {
			console.log(
				chalk.green("✓ Connected to server as:"),
				chalk.yellow(this.socket.id),
				"\n"
			);
		});

		this.socket.on("MESSAGE_FROM_TYPE", ({ fromType, message }) => {
			console.log(
				chalk.blue(`\n📥 Message from ${fromType}:`),
				chalk.white(message)
			);
		});

		// Set up CLI interface
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		// Command prompt
		const promptUser = () => {
			console.log(chalk.dim("\nAvailable commands:"));
			console.log(chalk.dim("1. send <type> <message>"));
			console.log(chalk.dim("2. exit\n"));

			rl.question(chalk.cyan("→ "), (input) => {
				const [command, ...args] = input.trim().split(" ");

				switch (command) {
					case "send":
						const [targetType, ...messageParts] = args;
						const message = messageParts.join(" ");
						if (targetType && message) {
							this.socket.emit("MESSAGE_TO_TYPE", {
								targetType,
								message,
							});
							console.log(
								chalk.green(`\n📤 Sent to ${targetType}:`),
								chalk.white(message)
							);
						} else {
							console.log(
								chalk.red("\n❌ Usage: send <type> <message>")
							);
						}
						break;
					case "exit":
						console.log(chalk.yellow("\n👋 Disconnecting...\n"));
						this.socket.disconnect();
						process.exit(0);
						break;
					default:
						console.log(chalk.red("\n❌ Unknown command"));
				}
				promptUser();
			});
		};

		promptUser();
	}
}

// Start the client
new NodeClient();
