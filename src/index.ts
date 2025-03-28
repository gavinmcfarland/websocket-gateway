console.log("Hello, world!");

// A simple function to test the TypeScript compilation
export function greet(name: string): string {
	return `Hello, ${name}!`;
}

// Test the function
console.log(greet("TypeScript"));

// Test some TypeScript features
interface User {
	name: string;
	age: number;
}

const user: User = {
	name: "Test User",
	age: 25,
};

console.log("User:", user);
