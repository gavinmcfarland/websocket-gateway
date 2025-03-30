<script lang="ts">
	import { onMount } from "svelte";
	import { createClient } from "websocket-gateway/client";

	let clientId = "";
	let rooms = {};
	let messageInput = "";
	let selectedRoom = "browser";
	let sentMessages: string[] = [];
	let receivedMessages: string[] = [];
	let socket: any;

	// Get client type from URL parameter
	const urlParams = new URLSearchParams(window.location.search);
	const room = urlParams.get("type") || "browser";
	const clientTitle = `${room.charAt(0).toUpperCase() + room.slice(1)} Client`;

	function sendMessage() {
		if (messageInput && socket) {
			const timestamp = new Date().toLocaleTimeString();
			sentMessages = [
				...sentMessages,
				`[${timestamp}] To ${selectedRoom}: ${messageInput}`,
			];

			socket.emit("ANY_EVENT", {
				room: selectedRoom,
				content: messageInput,
			});
			messageInput = "";
		}
	}

	onMount(() => {
		socket = createClient({
			room,
			port: 8080,
		});

		socket.on("connect", () => {
			console.log("Connected as:", socket.id);
			clientId = `Connected as: ${socket.id} in room: ${room}`;
		});

		if (room === "figma") {
			socket.on("ANY_EVENT", (data) => {
				if (data.content?.type === "FILE_CHANGED") {
					const changeData = data.content;

					socket.emit("ANY_EVENT", {
						room: "test",
						content: {
							type: "FILE_CHANGE_COMPLETE",
							data: changeData,
						},
					});

					const timestamp = new Date().toLocaleTimeString();
					sentMessages = [
						...sentMessages,
						`[${timestamp}] File change notification sent to test-client: ${JSON.stringify(changeData)}`,
					];
				}
			});
		}

		socket.on("ROOM_STATE", (newRooms) => {
			rooms = newRooms;
		});

		socket.on("ANY_EVENT", (data) => {
			const timestamp = new Date().toLocaleTimeString();
			const messageText =
				typeof data.content === "object"
					? JSON.stringify(data.content)
					: data.content;
			receivedMessages = [
				...receivedMessages,
				`[${timestamp}] From ${data.from || "unknown"}: ${messageText}`,
			];
		});

		// Add keyboard event listener
		const messageInputEl = document.getElementById("messageInput");
		if (messageInputEl) {
			messageInputEl.addEventListener("keypress", (e) => {
				if (e.key === "Enter") {
					sendMessage();
				}
			});
		}
	});
</script>

<main>
	<h1>{clientTitle}</h1>
	<div>{clientId}</div>

	<h2>Connected Clients</h2>
	<div id="rooms">
		{#each Object.entries(rooms) as [roomName, members]}
			<div class="room">
				<h3>{roomName} ({members.length})</h3>
				{#each members as member}
					<div class="member">{member.id} ({member.room})</div>
				{/each}
			</div>
		{/each}
	</div>

	<div class="message-containers">
		<div class="message-section">
			<h2>Sent Messages</h2>
			<div class="message-box">
				{#each sentMessages as message}
					<div class="sent-message">{message}</div>
				{/each}
			</div>
		</div>
		<div class="message-section">
			<h2>Received Messages</h2>
			<div class="message-box">
				{#each receivedMessages as message}
					<div class="received-message">{message}</div>
				{/each}
			</div>
		</div>
	</div>

	<input
		type="text"
		id="messageInput"
		placeholder="Type a message"
		bind:value={messageInput}
	/>
	<select bind:value={selectedRoom}>
		<option value="browser">Browser</option>
		<option value="figma">Figma</option>
	</select>
	<button on:click={() => sendMessage()}>Send Message</button>
</main>

<style>
	.room {
		margin-bottom: 20px;
	}

	.member {
		margin: 5px 0;
	}

	.message-containers {
		display: flex;
		gap: 20px;
	}

	.message-section {
		flex: 1;
	}

	.message-box {
		height: 200px;
		overflow-y: auto;
		border: 1px solid #ccc;
		padding: 10px;
		margin: 10px 0;
	}

	.sent-message {
		color: #0066cc;
	}

	.received-message {
		color: #006600;
	}
</style>
