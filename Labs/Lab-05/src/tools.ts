export async function getGitHubFile(
    owner: string,
    repo: string,
    filepath: string,
    ref: string = "main",
    maxLines: number = 500
  ): Promise<string> {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filepath}`;
  
    try {
      const response = await fetch(url);
  
      if (!response.ok) {
        if (response.status === 404) {
          return `Error: File not found - ${owner}/${repo}/${filepath} (ref: ${ref}). Check that the owner, repo, filepath, and branch/ref are correct.`;
        }
        if (response.status === 403) {
          return `Error: Rate limit exceeded. Try again later or use a GitHub token for authenticated requests.`;
        }
        return `Error: Failed to fetch file (HTTP ${response.status}). URL: ${url}`;
      }
  
      const content = await response.text();
      const lines = content.split("\n");
      const totalLines = lines.length;
  
      if (totalLines > maxLines) {
        const truncated = lines.slice(0, maxLines).join("\n");
        return `${truncated}\n\n[File truncated: showing first ${maxLines} of ${totalLines} lines]`;
      }
  
      return content;
    } catch (error) {
      return `Error: Network issue while fetching file - ${error instanceof Error ? error.message : String(error)}`;
    }
  }