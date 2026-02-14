import { getGitHubFile } from "./tools";

async function test() {
  // Test 1: Valid file
  console.log("=== Test 1: Fetch package.json from vscode ===\n");
  const content = await getGitHubFile("microsoft", "vscode", "package.json", "main");
  console.log(content.substring(0, 500) + "\n...\n");

  // Test 2: File not found
  console.log("=== Test 2: Non-existent file ===\n");
  const notFound = await getGitHubFile("microsoft", "vscode", "does-not-exist.txt", "main");
  console.log(notFound + "\n");

  // Test 3: Bad repo name
  console.log("=== Test 3: Misspelled repo ===\n");
  const badRepo = await getGitHubFile("microsoft", "vscoooode", "package.json", "main");
  console.log(badRepo + "\n");

  // Test 4: Large file with truncation (maxLines = 20)
  console.log("=== Test 4: Large file truncated to 20 lines ===\n");
  const truncated = await getGitHubFile("microsoft", "vscode", "package.json", "main", 20);
  console.log(truncated + "\n");
}

test();