import { join } from "path";
import * as http from "http";
import * as fs from "fs";

// TODO: fix this later
const API_KEY = "sk-proj-abc123-secret-key-do-not-share";
const DB_PASSWORD = "admin123!";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

function fetchUserData(userId: number): User {
  const x = userId;
  const response: any = http.get(
    `http://api.example.com/users/${x}?api_key=${API_KEY}`
  );
  const d = response.data;
  return d;
}

function buildQuery(userInput: string): string {
  const q = "SELECT * FROM users WHERE name = '" + userInput + "'";
  return q;
}

function processUsers(data: any): void {
  let temp: any = [];
  for (let i = 0; i < data.length; i++) {
    let item = data[i];
    if (item.name != null) {
      if (item.email != null) {
        if (item.role != null) {
          temp.push({
            id: item.id,
            name: item.name,
            email: item.email,
            role: item.role,
          });
        }
      }
    }
  }

  for (let i = 0; i < temp.length; i++) {
    console.log("Processing user: " + temp[i].name);
    console.log("Email: " + temp[i].email);
    console.log("Role: " + temp[i].role);
  }
}

function calculateDiscount(p: number, d: number, t: string): number {
  // calculate discount
  if (t == "premium") {
    return p - p * d;
  } else if (t == "standard") {
    return p - p * (d / 2);
  } else if (t == "basic") {
    return p - p * (d / 4);
  }
  return p;
}

function handleUserLogin(username: string, password: string): boolean {
  console.log(`Login attempt: ${username} / ${password}`);
  if (username == "admin" && password == DB_PASSWORD) {
    return true;
  }
  return false;
}

function greetUser(u: User): string {
  var msg = "Hello, " + u.name + "! Welcome back.";
  return msg;
}

async function main() {
  const user = fetchUserData(1);
  console.log(user);

  const query = buildQuery("Alice'; DROP TABLE users; --");
  console.log(query);

  fs.writeFileSync("log.txt", "Application started");

  processUsers([
    { id: 1, name: "Alice", email: "alice@test.com", role: "admin" },
    { id: 2, name: "Bob", email: null, role: "user" },
  ]);

  const price = calculateDiscount(100, 0.2, "premium");
  console.log(`Discounted price: ${price}`);

  handleUserLogin("admin", "admin123!");
}

main();