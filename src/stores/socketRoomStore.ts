import { writable } from "svelte/store";

export type RoomMember = {
	id: string;
	source: string;
};

export type RoomMembers = {
	[room: string]: RoomMember[];
};

// Create the writable store with initial empty state
const createRoomStore = () => {
	const { subscribe, set, update } = writable<RoomMembers>({});

	return {
		subscribe,
		set,
		// Add member to a room
		addMember: (room: string, member: RoomMember) => {
			update((rooms) => {
				const updatedRooms = { ...rooms };
				if (!updatedRooms[room]) {
					updatedRooms[room] = [];
				}
				updatedRooms[room] = [...updatedRooms[room], member];
				return updatedRooms;
			});
		},
		// Remove member from a room
		removeMember: (room: string, memberId: string) => {
			update((rooms) => {
				const updatedRooms = { ...rooms };
				if (updatedRooms[room]) {
					updatedRooms[room] = updatedRooms[room].filter(
						(m) => m.id !== memberId
					);
					// Clean up empty rooms
					if (updatedRooms[room].length === 0) {
						delete updatedRooms[room];
					}
				}
				return updatedRooms;
			});
		},
		// Clear all rooms
		clear: () => set({}),
	};
};

// Export a singleton instance
export const roomStore = createRoomStore();
