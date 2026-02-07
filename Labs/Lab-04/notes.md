# Week 4 - Working with Code-as-Text

## Overview

1. LLMs and Code
   1. Why LLMs excel at code and more than other forms of text
   2. Learning to leverage this as programmers
2. Code Reading as Foundational Skill
   1. Reading comprehension is the bottleneck
   2. How to read code systematically
   3. Reading and extracting code and other text from GitHub
3. The LLM Code Reading Paradox
   1. The challenge: evaluating code beyond your skill level
   2. LLMs as reading partners, not just code generators
   3. Strategic prompting patterns
4. Making Code Readable for Humans and LLMs through Types
   1. Why types matter for LLM interactions
   2. TypeScript and Python type hints
   3. Types as executable specifications

## Additional Resources

1. [Additional Code Reading Prompt Patterns](./prompting-patterns.md)
2. [Getting Started with Types](./types-setup.md)
3. [TypeScript Example Project](./ts-example/)

## LLMs and Code

In [week 3](../week-03/README.md) we looked at how simple changes to text in a prompt can produce wildly different responses. Through careful prompt engineering we learned that a model can be steered toward, or away from, particular responses. Before they can help us, large **language** models need us to reframe our real-world problems into _problems of language_; that is, we need to be able to transform our work into text. Many people struggle to do this, since it's not clear how to accomplish many jobs as writing activities (this is one of the reasons AI companies are struggling to bring LLMs to a wider audience).

As software developers, we are uniquely positioned to benefit from LLMs. Few people work as closely with text as we do: almost every task we do with source code is inherently rooted in textual analysis, detailed writing, and close reading. **Code is a special type of text that LLMs handle exceptionally well**. Unlike natural language, which is necessarily ambiguous (e.g., metaphors), culturally coded, or otherwise unclear, code has precise syntax, executable semantics, and rich contextual relationships that LLMs understand well.

This week, we will explore why LLMs excel at working with code, how to read code systematically (both human-written and AI-generated), and how to use additional context in the form of type annotations to improve the quality of LLM interactions. We'll also learn practical techniques for extracting code and project context from GitHub and working with code-as-text through DIFFs, patches, and debugging workflows. The goal is to transform how you think about LLM-assisted programming: not as a way to avoid reading code, but as a way to read and understand code more effectively.

## Including Code in Messages

Last week we discussed the importance of using delimiters to organize our prompts, from example: Markdown headers, XML tags, and fenced code blocks. These delimiters help LLMs distinguish between instructions, context, and data that are mixed into the same prompt. As we start discussing code and LLMs, this becomes even more critical, since code requires precise syntax.

**Code is text, but a highly structured text with special meaning.** When you paste code into a prompt without proper delimiters, the LLM may confuse it with natural language instructions or treat it as part of your question rather than as data to be analyzed. This confusion will lead to poor responses, hallucinations, or the model trying to "complete" your code when you wanted it analyzed.

### Fenced Code Blocks

The single most important delimiter for code is the backtick and **fenced code block**:

````markdown
```python
def calculate_total(items):
    return sum(item.price for item in items)
```
````

The triple backticks tell the LLM _"this is code, not prose,"_ while the language name (`python`, `javascript`, `typescript`, `sql`, etc.) provides crucial context about the syntax and semantics. This simple pattern:

1. **Prevents misinterpretation**: The model won't try to parse code as instructions
2. **Enables syntax awareness**: The model knows which language rules apply
3. **Improves suggestions**: Language-specific patterns and idioms become available
4. **Supports multiple languages**: You can include different languages in a single prompt

Without language identifiers, the model has to guess whether the text is JavaScript, TypeScript, or even pseudo-code (all of which are possible in different situations).

````markdown
```
function processData(data) {
  return data.map(x => x * 2);
}
```
````

When we include a language identifier (`javascript` or even `js` to save tokens), the model knows to apply JavaScript semantics, can suggest appropriate APIs, and won't recommend TypeScript-specific features:

````markdown
```js
function processData(data) {
  return data.map((x) => x * 2);
}
```
````

### Delimiters for Technical Data

Code isn't the only technical text that benefits from delimiters. We should use language identifiers for any structured data format:

````markdown
```json
{
  "user": "alice",
  "role": "admin"
}
```

```sql
SELECT * FROM users WHERE created_at > '2024-01-01';
```

```sh
npm install --save-dev typescript
```

```diff
-  const total = items.reduce((sum, item) => sum + item.price, 0);
+  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
```

```csv
First_Name,Last_Name,Email,Phone_Number
John,Doe,john.doe@example.com,123-456-7890
Jane,Smith,jane.smith@example.com,987-654-3210
Peter,Jones,peter.jones@example.com,555-123-4567
```
````

Each format has its own syntax rules, and telling the LLM which format you're using dramatically improves its ability to help.

### Inline Code: When to Use Backticks

For short code fragments within prose, use single backticks to indicate the presence of some sort of technical term:

```text
The `calculate_total` function is throwing a `TypeError` when `items` is empty.
```

This helps the LLM distinguish between:

- Code identifiers (`calculate_total`, `items`)
- Error types (`TypeError`)
- Natural language ("function", "throwing", "empty")

Without backticks, the model might not recognize that `items` is a variable name rather than the English word "items."

### Combining Delimiters with Context

When debugging, discussing code, or asking for code review, combine fenced code blocks with other delimiters to provide more structure:

````markdown
I'm getting an error in this function:

```python
def process_users(users):
    return [u.name.upper() for u in users]
```

## Error message

> AttributeError: 'NoneType' object has no attribute 'upper'

## Context

- This function is called from `api/routes.py` line 45
- The `users` parameter comes from a database query
- Sometimes the query returns users with `name=None`

What's the best way to handle this?
````

Here, we've combined a lot of information into a single prompt without losing causing confusion:

- Fenced code blocks for the function, indicating the language
- The error is quoted, indicating to the LLM that this is _exact_ output
- Markdown headers separate different sections
- Bullet points for context
- Inline code to set apart the data/variables/filenames against the surrounding prose

This approach helps to create a clear structure that the LLM immediately understands.

### The Cost of Poor Delimiters

Without proper delimiters, you'll often see various failure modes:

**Problem 1: Code treated as instructions**

```text
Here is the code:
function deleteUser(id) {
  // TODO: Write the logic to drop the table if the user is admin
  console.log("deleting...");
}
Please implement the logic described in the comment.
```

The LLM might interpret the comment `// TODO: Write the logic...` as the _only_ instruction and ignore your actual prompt at the bottom. Or worse, if the comment says `// Ignore errors`, the LLM might apply that instruction to its own generation process rather than the code logic.

Without fences, the comment is just text. The LLM sees a stream of English instructions, some of which happen to be preceded by slashes. It loses the boundary between "text inside the file" and "text directed at the AI."

**Problem 2: The "Markdown Rendering" Collision**

```text
Check this config file for errors:
- name: build
  script:
  - npm install
  - npm test
```

Before the LLM "thinks" about the logic, the text is often parsed as Markdown. The indentation is stripped, and the hyphens are converted into a bulleted list. The LLM sees this flat list:

- name: build script:
- npm install
- npm test

It has lost the nesting structure entirely. It will likely tell you the YAML is invalid because `script` has no children, or it will hallucinate a structure that doesn't exist because the whitespace was eaten by the Markdown parser.

Many code artifacts (YAML, Diffs, Python lists) use characters that have special meaning in Markdown (specifically `-`, `*`, and indentation).

**Problem 3: The "Auto-Correction" Trap (JSX/Templates)**

```text
Why is this button not working?
<button className={styles.btn} onClick={handleClick}>
  Save
</button>
```

The LLM sees `<button ...>` and assumes "HTML." It notices that `{styles.btn}` is invalid HTML attribute syntax (i.e., HTML expects quotes: `class="..."`).

Instead of debugging your React logic, the LLM "helpfully" fixes your syntax to:
`<button class="{styles.btn}" onclick="handleClick">`

It has now broken your React code by converting expressions into string literals, all because it didn't know it was looking at `jsx` or `tsx`.

### Best Practices for Code Delimiters

1. **Always use fenced code blocks** for any code longer than a few words
2. **Always specify the language** after the opening backticks, or use `text` if it's plain text, `markdown` if it's embedded Markdown
3. **Use 4-backticks for embedded Markdown** to allow including fenced code blocks within
4. **Wrap multiple fenced code blocks in XML tags** if it becomes hard to differentiate them in the prompt
5. **Use inline backticks** for variable names, function names, filenames, error types, etc. in prose
6. **Separate code from instructions** using headers or blank lines
7. **Include error messages** in their own fenced blocks (often with `text` or `bash` as the language), or use blockquotes
8. **Use `diff` format** when discussing changes (we'll cover this in detail below)

With these delimiter patterns established, we can now move on to discuss code reading in the context of LLMs, knowing that the model will correctly interpret what we share. The techniques we learned in Week 3 about organizing prompts with Markdown and XML become even more powerful when combined with proper code delimiters.

## Code Reading as Foundational Skill

So far, we've been focused on how best to present our code for an LLM to read. This emphasis on understanding through code reading also applies to us. We need to give thought to how _we_ read code, whether it is written by humans or AI. Code reading is an essential skill for software developers, especially in the context of LLMs.

### Reading Comprehension is the Bottleneck

One of the big ideas we'll explore this week is how to critically read and evaluate code, in particular, code generated by LLMs. It's tempting to treat LLM output as a black box that either works or doesn't. How many times have you copy/pasted code from ChatGPT or another LLM and used it without reading? LLMs don't produce consistent results. Instead, we need to learn how to systematically approach code so as to understand, question, and improve it.

It's not enough to ask _"how do I make this work?"_ Instead, we need to understand the problem space, possible solutions, and potential technologies well enough to be able to write safe, maintainable, and performant code. The code we get from LLMs offers us a jumping-off point for further exploration, not a finished product. Our goal isn't to use LLM-generated code _as-is_, but to **learn from it** and to **improve it**. To do this, we need to develop the critical thinking skills that distinguish senior developers from junior ones.

> [!TIP]
> Use of AI in software development has altered the typical career development arc. Never before has so much been expected of junior software developers, who must quickly progress their knowledge without following the typical pathways. Doing so requires self-reflection and an understanding of what you do and don't know, what you can do and what you need help doing. Learning to leverage LLMs to augment your skills and experience is key.

**In modern software development, reading comprehension is the bottleneck, not code generation speed.**

As programmers, we spend more of our time reading code than we do writing it: code we wrote last week, code from a colleague, legacy code, open source code, code in our dependencies, test code, etc. It's a safe bet that you'll spend more than half your time reading and working to understand existing code. Yet most of the courses you take as a programming student will focus on _writing code from scratch_.

This imbalance is amplified with LLMs, which can generate hundreds of lines of code in seconds. Without the ability to critically read and evaluate generated code, you're building on an unstable foundation and will quickly lose control of the structures you try to create.

It's impossible to write perfect code, and hard to write good code. Multiple studies have found that on average, code in industry contains between **1-25 defects per 1,000 lines (KLOC)** when using ad-hoc development practices (Boehm, 1981; Jones, 2000; McConnell, 2004). Think about that number for a minute: **for every 1,000 lines of code you add to a project, you are also adding 5, 10, 20 or more bugs**. In contrast, organizations using rigorous quality practices are able to achieve **0.5-1.0 defects per KLOC** (Moore, 1992; Coverity, 2006). Understanding the code you're reading, whether it was written by a human or AI, is essential for improving and maintaining code quality.

> [!NOTE]
> Boehm, B. W. (1981). _Software Engineering Economics_. Prentice Hall.
> Jones, C. (2000). _Software Assessments, Benchmarks, and Best Practices_. Addison-Wesley.
> McConnell, S. (2004). _Code Complete_ (2nd ed.). Microsoft Press.
> Moore, J. W. (1992). Cited in _Code Complete_.
> Synopsys Coverity Scan Open Source Reports (2006-present). Analysis of mature open source projects consistently shows 0.5-1.0 defects per KLOC.

### How to Read Code Systematically

It sounds almost too obvious to mention, but one of the best ways to get better at reading code is to _read code_ and to _read a lot of it_. In addition, you should be reading code that was written by people who are experts in their craft. An excellent source of high-quality code is GitHub. [As of 2025](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/), GitHub had more than **630 million repos**, with **395 million** of those being open source. Open source code provides us a window into the process _and_ practices of professional software developers. Seeing how more experienced programmers write their code can help us learn what's possible with our own.

So how does one "read" code on GitHub? Do you start at `main()` and read to the bottom? There are a number of strategies you can employ, and it's best to use all of them at different times.

#### Code Reading - Find Good Projects and Developers

Look for repositories and projects using the same languages and technologies that you are interested in learning and using. Look at projects and developers featured in [GitHub's Trending](https://github.com/trending) pages. Look at your project's dependencies, in `package.json`, `node_modules`, `requirements.txt`, etc. If you follow the trail of dependencies in a project, you'll quickly get a sense of the larger ecosystem surrounding your own work. Start to learn the names of libraries, tools, and frameworks that you see these projects using. Even without reading a single line of code, you'll gain insight into what's out there.

#### Code Reading - Work Top-Down and Bottom-Up

Practice different strategies for entering the code itself. For example, try working **top-down**, where you focus on the layout and structure of the project, its files, folders, interfaces, classes, etc. Try to understand the relationships between modules and to identify the different entry points. How is everything organized? What is the scope and scale of the project?

You should also work **bottom-up**, starting deep inside a particular file, function, or class, and build an understanding of how small units of code are written. Identify callers and references, discover which files are related to one another, and how data is passed between functions. As you work, allow yourself to be opportunistic, following interesting leads and unexpected connections. Be curious, ask questions, and get lost in the code. Notice the ways they use the language (and what they don't do), how they write comments (or don't), how large or small their functions are, when they split things into different files.

You don't need to understand everything at this stage. Instead, let the project wash over you and get a feel for what's there, paying attention to things you come across in your travels. One doesn't need to understand plant biology in order to go for a walk in the woods.

#### Code Reading - Find the Project Specs

You should seek out the project's specifications and try to connect these back to the code. Sometimes this will be a formal document (e.g., an [RFC](https://en.wikipedia.org/wiki/Request_for_Comments) or standard), but it could also be a collection of READMEs or comment blocks in a few files. It might also be a folder of tests. Tests provide one of the best forms of documentation, since they are a living standard (i.e., the code MUST adhere to this set of tests). Reading tests can help us understand how the original authors think their code _should_ work.

#### Code Reading - Ask Questions

Ask lots of questions. Reading code properly, like any critical analysis, requires close inspection and interrogation. We shouldn't accept the code at face value (remember, it's likely full of bugs) or trust it. We need to start asking some difficult questions, for example:

- What problem is this actually solving?
- What assumptions does this code make?
- Does this code do what the developer intended? Are there any side effects?
- Which patterns are being employed?
- Are the abstractions helping or making this unclear?
- What's going to happen on the "happy path" (normal case)? What are the edge cases and failure modes?
- Are we dealing with errors correctly? Should we let other parts of the code do it instead?
- How does this scale with input size?
- Are we logging and instrumenting our code so we can debug it properly?
- Is this over-engineered? What other options exist? Are they simpler?
- What are the security implications?
- How does this fit into the larger system?
- What will maintaining this code cost over time?
- What alternatives exist and what trade-offs do they represent?
- Are the dependencies being used necessary? Could a dependency replace a lot of this logic?

We need a systematic approach to evaluating the code. Senior developers have internalized ways for assessing code quality, recognizing patterns and anti-patterns, and understanding trade-offs. As a junior developer, you need to learn to leverage LLMs to help you overcome these limitations.

Rather than replacing the critical thinking skills of senior developers, LLMs can help us develop those same skills more quickly. In the sections that follow, we'll explore how to use LLMs not just to generate code, but to become better code readers and evaluators. We'll also discuss strategic prompting patterns that transform the
LLM from a code generator into a teaching partner.

## Reading Code on GitHub

No matter what kind of programming you're doing, chances are high that GitHub will be involved. Many companies keep their proprietary source in private repositories, open source projects use public repositories, and almost every programming language, library, framework, and tool in your dependencies is likely hosted on GitHub.

GitHub provides multiple ways to view and extract code and other project objects, each suited to different purposes. Understanding these patterns will help you gather the right context for working with LLMs.

### Viewing Complete Source Files

The most straightforward approach is viewing individual files. For example, if we want to see the `package.json` used by [Microsoft VSCode](https://github.com/microsoft/vscode), we can view it in our browser at:

<https://github.com/microsoft/vscode/blob/main/package.json>

**Try answering these questions: which dependencies does VSCode use? Do you recognize them? What are they used for?**

This HTML view is excellent on the web, with syntax highlighting, links to other parts of the repo, and navigation features. However, it's less than ideal for feeding to an LLM, since HTML will translate to too many tokens and contain all kinds of irrelevant markup.

To get access to just the raw file content, we need to use a different URL:

<https://raw.githubusercontent.com/microsoft/vscode/refs/heads/main/package.json>

Here we've switched the origin from `https://github.com/` to `https://raw.githubusercontent.com/` and added info about the branch/commit to use: `refs/heads/main` (i.e., _"show us the raw code as it exists on the `main` branch"_).

We could have also requested the file as it existed previously in a specific commit (e.g., `2fd8ee18be0ab58d74c2120dc5ba29f62be49fde`) instead of `main`:

<https://raw.githubusercontent.com/microsoft/vscode/2fd8ee18be0ab58d74c2120dc5ba29f62be49fde/package.json>

The same works for a release, using `/refs/heads/release` (e.g., `v1.99`):

<https://raw.githubusercontent.com/microsoft/vscode/refs/heads/release/1.99/package.json>

**Question: what if you needed to compare and discuss two different versions of `package.json` for VSCode with an LLM. How would you write that prompt?**

### Extracting Text from GitHub

In order to work with source code in GitHub using LLMs, it's helpful to know various URL patterns and API endpoints for extracting text from GitHub objects. For example, often we don't want entire files and only want to focus on specific changes, issues, or repository metadata.

#### Working with Changes: DIFFs and Patches

We've just seen to how to get the raw content for an entire file. However, using whole files will increase our token count and potentially add unnecessary context. Perhaps we've updated a file and want to get it reviewed, or a colleague has fixed a bug and wants you to add a test case; or maybe you want help describing all of the updates you've made as part of your most recent commit. No matter the reason, working with **changes** instead of **whole files** is often advantageous for developers, and more efficient for LLMs (e.g., fewer tokens, focused context).

In software development we refer to these "changes" as a **DIFF**, so named for the [DIFF format](https://en.wikipedia.org/wiki/Diff) and [`diff` Unix command](https://en.wikipedia.org/wiki/Diff). Creating DIFFs in git is accomplished with the [`git diff` command](https://git-scm.com/docs/git-diff), and GitHub makes DIFFs available for many different types of objects.

##### DIFFs for Pull Requests

A GitHub Pull Request (PR) represents a git branch (e.g., one or more git commits) that the author(s) wishes to have merged into the repo's default branch (typically `main`). Developers use Pull Requests to modify code in an _upstream_ repo without needing collaborator rights to push directly. In addition to enabling code sharing, Pull Requests also provide a collaboration point for discussing and reviewing changes to a project.

Consider these PRs to VSCode: [#268404](https://github.com/microsoft/vscode/pull/268404), [#290122](https://github.com/microsoft/vscode/pull/290122). The first changes how keybindings work for navigating chat items and the second alters how the splash screen works for the agent session window. The default URL for the first PR provides an HTML view suitable for humans:

<https://github.com/microsoft/vscode/pull/268404>

We can also request this same PR in [DIFF format](https://en.wikipedia.org/wiki/Diff) by adding the `.diff` suffix:

<https://github.com/microsoft/vscode/pull/268404.diff>

The DIFF shows the changes that have been made to lines in one or more files, along with a few lines of context before and after. A diff is extremely compact, compared to the full HTML view. We can look at the diffs for each of the PRs mentioned above.

This first DIFF shows a new file being added, and another being updated:

```diff
diff --git a/src/vs/workbench/contrib/chat/browser/actions/chatPromptNavigationActions.ts b/src/vs/workbench/contrib/chat/browser/actions/chatPromptNavigationActions.ts
new file mode 100644
index 0000000000000..e5a3f6c35729e
--- /dev/null
+++ b/src/vs/workbench/contrib/chat/browser/actions/chatPromptNavigationActions.ts
@@ -0,0 +1,121 @@
+/*---------------------------------------------------------------------------------------------
+ *  Copyright (c) Microsoft Corporation. All rights reserved.
+ *  Licensed under the MIT License. See License.txt in the project root for license information.
+ *--------------------------------------------------------------------------------------------*/
+
+import { KeyCode, KeyMod } from '../../../../../base/common/keyCodes.js';
+import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
+import { localize2 } from '../../../../../nls.js';
+import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
+import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
+import { CHAT_CATEGORY } from './chatActions.js';
+import { IChatWidgetService } from '../chat.js';
+import { ChatContextKeys } from '../../common/chatContextKeys.js';
+import { IChatRequestViewModel, isRequestVM, isResponseVM } from '../../common/chatViewModel.js';
+
+export function registerChatPromptNavigationActions() {
+ registerAction2(class NextUserPromptAction extends Action2 {
+  constructor() {
+   super({
+    id: 'workbench.action.chat.nextUserPrompt',
+    title: localize2('interactive.nextUserPrompt.label', "Next User Prompt"),
+    keybinding: {
+     primary: KeyMod.CtrlCmd | KeyCode.RightArrow,
+     weight: KeybindingWeight.WorkbenchContrib,
+     when: ChatContextKeys.inChatSession,
+    },
+    precondition: ChatContextKeys.enabled,
+    f1: true,
+    category: CHAT_CATEGORY,
+   });
+  }
+
+  run(accessor: ServicesAccessor, ...args: any[]) {
+   navigateUserPrompts(accessor, false);
+  }
+ });
+
+ registerAction2(class PreviousUserPromptAction extends Action2 {
+  constructor() {
+   super({
+    id: 'workbench.action.chat.previousUserPrompt',
+    title: localize2('interactive.previousUserPrompt.label', "Previous User Prompt"),
+    keybinding: {
+     primary: KeyMod.CtrlCmd | KeyCode.LeftArrow,
+     weight: KeybindingWeight.WorkbenchContrib,
+     when: ChatContextKeys.inChatSession,
+    },
+    precondition: ChatContextKeys.enabled,
+    f1: true,
+    category: CHAT_CATEGORY,
+   });
+  }
+
+  run(accessor: ServicesAccessor, ...args: any[]) {
+   navigateUserPrompts(accessor, true);
+  }
+ });
+}
+
+function navigateUserPrompts(accessor: ServicesAccessor, reverse: boolean) {
+ const chatWidgetService = accessor.get(IChatWidgetService);
+ const widget = chatWidgetService.lastFocusedWidget;
+ if (!widget) {
+  return;
+ }
+
+ const items = widget.viewModel?.getItems();
+ if (!items || items.length === 0) {
+  return;
+ }
+
+ // Get all user prompts (requests) in the conversation
+ const userPrompts = items.filter((item): item is IChatRequestViewModel => isRequestVM(item));
+ if (userPrompts.length === 0) {
+  return;
+ }
+
+ // Find the currently focused item
+ const focused = widget.getFocus();
+ let currentIndex = -1;
+
+ if (focused) {
+  if (isRequestVM(focused)) {
+   // If a request is focused, find its index in the user prompts array
+   currentIndex = userPrompts.findIndex(prompt => prompt.id === focused.id);
+  } else if (isResponseVM(focused)) {
+   // If a response is focused, find the associated request's index
+   // Response view models have a requestId property
+   currentIndex = userPrompts.findIndex(prompt => prompt.id === focused.requestId);
+  }
+ }
+
+ // Calculate next index
+ let nextIndex: number;
+ if (currentIndex === -1) {
+  // No current focus, go to first or last prompt based on direction
+  nextIndex = reverse ? userPrompts.length - 1 : 0;
+ } else {
+  // Navigate to next/previous prompt
+  nextIndex = reverse ? currentIndex - 1 : currentIndex + 1;
+
+  // Clamp instead of wrap and stay at boundaries when trying to navigate past ends
+  if (nextIndex < 0) {
+   nextIndex = 0; // already at first, do not move further
+  } else if (nextIndex >= userPrompts.length) {
+   nextIndex = userPrompts.length - 1; // already at last, do not move further
+  }
+
+  // avoid re-focusing if we didn't actually move
+  if (nextIndex === currentIndex) {
+   return; // no change in focus
+  }
+ }
+
+ // Focus and reveal the selected user prompt
+ const targetPrompt = userPrompts[nextIndex];
+ if (targetPrompt) {
+  widget.focus(targetPrompt);
+  widget.reveal(targetPrompt);
+ }
+}
diff --git a/src/vs/workbench/contrib/chat/browser/chat.contribution.ts b/src/vs/workbench/contrib/chat/browser/chat.contribution.ts
index 52f8222d8cc68..5b8556848d094 100644
--- a/src/vs/workbench/contrib/chat/browser/chat.contribution.ts
+++ b/src/vs/workbench/contrib/chat/browser/chat.contribution.ts
@@ -71,6 +71,7 @@ import { registerChatDeveloperActions } from './actions/chatDeveloperActions.js'
 import { ChatSubmitAction, registerChatExecuteActions } from './actions/chatExecuteActions.js';
 import { registerChatFileTreeActions } from './actions/chatFileTreeActions.js';
 import { ChatGettingStartedContribution } from './actions/chatGettingStarted.js';
+import { registerChatPromptNavigationActions } from './actions/chatPromptNavigationActions.js';
 import { registerChatExportActions } from './actions/chatImportExport.js';
 import { registerLanguageModelActions } from './actions/chatLanguageModelActions.js';
 import { registerMoveActions } from './actions/chatMoveActions.js';
@@ -924,6 +925,7 @@ registerChatCopyActions();
 registerChatCodeBlockActions();
 registerChatCodeCompareBlockActions();
 registerChatFileTreeActions();
+registerChatPromptNavigationActions();
 registerChatTitleActions();
 registerChatExecuteActions();
 registerQuickChatActions();
```

This second DIFF shows a single file being updated in multiple places:

```diff
diff --git a/src/vs/code/electron-browser/workbench/workbench.ts b/src/vs/code/electron-browser/workbench/workbench.ts
index da8713718c7a6..7102f4eb9f81b 100644
--- a/src/vs/code/electron-browser/workbench/workbench.ts
+++ b/src/vs/code/electron-browser/workbench/workbench.ts
@@ -25,6 +25,17 @@
  function showSplash(configuration: INativeWindowConfiguration) {
   performance.mark('code/willShowPartsSplash');

+  const isAgentSessionsWindow = configuration.profiles?.profile?.id === 'agent-sessions';
+  if (isAgentSessionsWindow) {
+   showAgentSessionsSplash(configuration);
+  } else {
+   showDefaultSplash(configuration);
+  }
+
+  performance.mark('code/didShowPartsSplash');
+ }
+
+ function showDefaultSplash(configuration: INativeWindowConfiguration) {
   let data = configuration.partsSplash;
   if (data) {
    if (configuration.autoDetectHighContrast && configuration.colorScheme.highContrast) {
@@ -265,8 +276,63 @@

    window.document.body.appendChild(splash);
   }
+ }

-  performance.mark('code/didShowPartsSplash');
+ function showAgentSessionsSplash(configuration: INativeWindowConfiguration) {
+
+  // Agent sessions windows render a very opinionated splash:
+  // - Dark theme background (agent sessions use 2026-dark-experimental)
+  // - Title bar only for window controls
+  // - Secondary sidebar takes all remaining space (maximized)
+  // - No status bar, no activity bar, no sidebar
+
+  const baseTheme = 'vs-dark';
+  const shellBackground = '#191A1B'; // 2026-dark-experimental sidebar background
+  const shellForeground = '#CCCCCC';
+
+  // Apply base colors
+  const style = document.createElement('style');
+  style.className = 'initialShellColors';
+  window.document.head.appendChild(style);
+  style.textContent = `body { background-color: ${shellBackground}; color: ${shellForeground}; margin: 0; padding: 0; }`;
+
+  // Set zoom level from splash data if available
+  if (typeof configuration.partsSplash?.zoomLevel === 'number' && typeof preloadGlobals?.webFrame?.setZoomLevel === 'function') {
+   preloadGlobals.webFrame.setZoomLevel(configuration.partsSplash.zoomLevel);
+  }
+
+  const splash = document.createElement('div');
+  splash.id = 'monaco-parts-splash';
+  splash.className = baseTheme;
+
+  // Title bar height - use stored value or default
+  const titleBarHeight = configuration.partsSplash?.layoutInfo?.titleBarHeight ?? 35;
+
+  // Title bar for window dragging
+  if (titleBarHeight > 0) {
+   const titleDiv = document.createElement('div');
+   titleDiv.style.position = 'absolute';
+   titleDiv.style.width = '100%';
+   titleDiv.style.height = `${titleBarHeight}px`;
+   titleDiv.style.left = '0';
+   titleDiv.style.top = '0';
+   titleDiv.style.backgroundColor = shellBackground;
+   (titleDiv.style as CSSStyleDeclaration & { '-webkit-app-region': string })['-webkit-app-region'] = 'drag';
+   splash.appendChild(titleDiv);
+  }
+
+  // Secondary sidebar (maximized, takes all remaining space)
+  // This is the main content area for agent sessions
+  const auxSideDiv = document.createElement('div');
+  auxSideDiv.style.position = 'absolute';
+  auxSideDiv.style.width = '100%';
+  auxSideDiv.style.height = `calc(100% - ${titleBarHeight}px)`;
+  auxSideDiv.style.top = `${titleBarHeight}px`;
+  auxSideDiv.style.left = '0';
+  auxSideDiv.style.backgroundColor = shellBackground;
+  splash.appendChild(auxSideDiv);
+
+  window.document.body.appendChild(splash);
  }

  //#endregion
```

Let's work through the various sections of the first DIFF and make sure we understand what we're reading.

##### Understanding DIFF Format

A diff begins with a header that shows the command that was used to generate the diff:

```diff
diff --git a/src/vs/workbench/contrib/chat/browser/actions/chatPromptNavigationActions.ts b/src/vs/workbench/contrib/chat/browser/actions/chatPromptNavigationActions.ts
```

The `a/*` and `b/*` filenames represent the original and modified versions of the file.

> [!TIP]
> When a file is created (didn't previously exist) or deleted (no longer exists), the filepath will use the Unix null device path, [`/dev/null`](https://en.wikipedia.org/wiki/Null_device), to indicate that it has been discarded.

While DIFFs can represent changes to one or thousands of files, this particular DIFF includes changes for two files:

1. `src/vs/workbench/contrib/chat/browser/actions/chatPromptNavigationActions.ts`, which is being added for the first time (`new file`)
2. `src/vs/workbench/contrib/chat/browser/chat.contribution.ts`, which is an existing file that is being modified

Git tracks file contents, but also [Unix file permissions](https://en.wikipedia.org/wiki/File-system_permissions#Traditional_POSIX_permissions), and the diff indicates this. Both files in this example use the same permissions, `100644`, which says this is a regular file vs. a directory or symlink (`100`), and allows the owner to read/write, the group and others to read (`644`).

Below the filename is the `index`, which shows the old and new [git SHA](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects). In the first case, we are creating a file that didn't exist in git before (no SHA): `index 0000000000000..e5a3f6c35729e`. In the second, the file was `52f8222d8cc68` and has become `5b8556848d094` with these changes.

> [!NOTE]
> It's common to truncate the SHA from the full 40-character version, and only use the first 7-15 characters.

Using this info we can quickly understand if a file is being added, removed, or modified:

**Modified File**:

```diff
diff --git a/src/file.ts b/src/file.ts
index 52f8222..5b85568 100644
```

**New File**:

```diff
diff --git a/src/newfile.ts b/src/newfile.ts
new file mode 100644
index 0000000..e470b4a
```

**Deleted File**:

```diff
diff --git a/src/oldfile.ts b/src/oldfile.ts
deleted file mode 100644
index e470b4a..0000000
```

**Renamed File**:

```diff
diff --git a/src/oldname.ts b/src/newname.ts
similarity index 95%
rename from src/oldname.ts
rename to src/newname.ts
index 52f8222..5b85568 100644
```

#### Hunk Headers

Within each of the file diffs, we see various **hunk headers**, which are the portions of the file being modified: `@@ -[old_start],[old_count] +[new_start],[new_count] @@`

```diff
@@ -0,0 +1,116 @@
...
@@ -71,6 +71,7 @@
...
@@ -924,6 +925,7 @@
```

Each hunk header in a DIFF tells you the line numbers in the old/new versions, and the line count. In the first case, `-0,0` means _"starting at line 0, 0 lines in the old file"_ (e.g., this is new, and didn't exist before), and `+1,116` means _"starting at line 1, 116 lines in the new file"_ (e.g., we're adding 116 lines). The other two both describe a single line of code being added (from 6 to 7 lines).

The lines in each hunk are prefixed with one of three context symbols:

1. `+` - a line being added
2. `-` - a line being removed
3. ` ` (i.e., a space) - a line of context (no change, included to help anchor the hunk within the larger file)

Using these symbols, you can also represent a modification as a line being removed in its current state and then added in a new state.

**Adding Line(s), with context**

```diff
@@ -10,3 +10,4 @@
 function greet(name) {
   console.log("Hello, " + name);
+  console.log("Welcome to our app!");
 }
```

**Deleting Line(s), with context**

```diff
@@ -10,4 +10,3 @@
 function greet(name) {
   console.log("Hello, " + name);
-  console.log("Debug: function called");
 }
```

**Modifying Line(s), with context**

```diff
@@ -5,3 +5,3 @@
 function calculateTotal(items) {
-  let sum;
+  let sum = 0;
   return sum;
 }
```

**Multiple Consecutive Changes**

```diff
-  // Old implementation
-  if (user.isActive) {
-    return user.data;
-  }
+  // New implementation with validation
+  if (user.isActive && user.data) {
+    return user.data;
+  }
```

> [!TIP]
> **Try This Yourself**
>
> 1. Find a recent PR in a project on [GitHub's Trending page](https://github.com/trending)
> 2. Get its `.diff` URL
> 3. Read through the DIFF and make sure you understand what's happening
> 4. Compare the the DIFF and your understanding to the more visual HTML representation in the PR's file section

#### DIFFs and Patches for Commits

In addition to Pull Requests, we can also request a DIFF for any commit in the repo. Consider [this commit (#f6df064)](https://github.com/microsoft/vscode/commit/f6df064c00aebd2c8c15b920db186afd408a8d7a) and its DIFF form:

<https://github.com/microsoft/vscode/commit/f6df064c00aebd2c8c15b920db186afd408a8d7a.diff>

```diff
diff --git a/package.json b/package.json
index cbe75c77a3dc6..add0c273b89b6 100644
--- a/package.json
+++ b/package.json
@@ -1,7 +1,7 @@
 {
   "name": "code-oss-dev",
   "version": "1.99.0",
-  "distro": "fc6ec8fede30829b7cc3773eb9f223ef5b79b0eb",
+  "distro": "d42d927c558e17ea6e489cff62878654737d85f7",
   "author": {
     "name": "Microsoft Corporation"
   },
```

Here we see a single line has been updated, modifying the `distro` field in `package.json`.

If we'd like more details about who made this change and when, we can also request a [patch version](https://git-scm.com/docs/git-format-patch) of the DIFF by adding the `.patch` extension:

<https://github.com/microsoft/vscode/commit/f6df064c00aebd2c8c15b920db186afd408a8d7a.patch>

```patch
From f6df064c00aebd2c8c15b920db186afd408a8d7a Mon Sep 17 00:00:00 2001
From: Matt Bierner <matb@microsoft.com>
Date: Wed, 26 Mar 2025 10:10:10 -0700
Subject: [PATCH] Update distro

---
 package.json | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

diff --git a/package.json b/package.json
index cbe75c77a3dc6..add0c273b89b6 100644
--- a/package.json
+++ b/package.json
@@ -1,7 +1,7 @@
 {
   "name": "code-oss-dev",
   "version": "1.99.0",
-  "distro": "fc6ec8fede30829b7cc3773eb9f223ef5b79b0eb",
+  "distro": "d42d927c558e17ea6e489cff62878654737d85f7",
   "author": {
     "name": "Microsoft Corporation"
   },
```

The patch format gives us the DIFF, but in the form of an email message, with extra info about the author, date, and commit message.

Depending on the context you need for the LLM, one of the `.diff` or `.patch` extensions is likely what you'll want.

> [!TIP]
> When asking an LLM to review code changes, using a DIFF is far more efficient than sharing entire files. The DIFF focuses attention on what actually changed, reducing tokens and improving the quality of feedback. You can easily create DIFFs and Patches for your own repos using the `git diff` and `git show` commands. You can also request that a model give you a DIFF to show you how to make changes to your code vs. repeating entire files, and save tokens/cost.

### Using the GitHub API

The [GitHub API](https://docs.github.com/en/rest) provides even more ways to query and retrieve data from repos, suitable for LLMs.

> [!NOTE]
> GitHub API endpoints may require authentication for private repos or higher rate limits, which are generally limited to 60 requests/hour for unauthenticated, or 5000 for authenticated. You can also use the [ungh.cc proxy](https://github.com/unjs/ungh) for unlimited access to some parts of the GitHub API, or use the [GitHub CLI to generate a token](https://cli.github.com/manual/gh_auth_login) you can use for more access.

#### Repository File Listings

If you need to help an LLM understand the layout of files in a repo, you can list file info using:

<https://api.github.com/repos/owner/repo/git/trees/main>

For example:

- File listing in the root of the VSCode repo:

  <https://api.github.com/repos/Microsoft/vscode/git/trees/main>

- Entire file listing in the VSCode repo (recursive):

  <https://api.github.com/repos/Microsoft/vscode/git/trees/main?recursive=1>

These will produce JSON output like this:

```json
{
  "sha": "a99fc36ea9319c206e925b2b357509f801eef5f8",
  "url": "https://api.github.com/repos/microsoft/vscode/git/trees/a99fc36ea9319c206e925b2b357509f801eef5f8",
  "tree": [
    {
      "path": ".config",
      "mode": "040000",
      "type": "tree",
      "sha": "f104be7b24d4fa8c1683afaadb4cba7e240998f4",
      "url": "https://api.github.com/repos/microsoft/vscode/git/trees/f104be7b24d4fa8c1683afaadb4cba7e240998f4"
    },
    {
      "path": ".devcontainer",
      "mode": "040000",
      "type": "tree",
      "sha": "6ae211bb0d13d53fc33161fd0540b194521f8661",
      "url": "https://api.github.com/repos/microsoft/vscode/git/trees/6ae211bb0d13d53fc33161fd0540b194521f8661"
    }
  ]
}
```

> [!NOTE]
> For a large repo like VSCode, a recursive listing will produce a massive JSON response. You should filter this to remove anything that isn't needed. For example, extracting only the `path` properties.

#### Issues and Pull Request Data

We can also request the text of an Issue. For example, let's say you need to discuss the following issue with an LLM:

<https://github.com/microsoft/vscode/issues/268451>

We can request the Issue via the API in JSON format using:

<https://api.github.com/repos/microsoft/vscode/issues/268451>

Or only the comments with:

<https://api.github.com/repos/microsoft/vscode/issues/268451/comments>

Similar API endpoints exist for most GitHub objects, including:

- Commits: `https://api.github.com/repos/owner/repo/commits`
- Pull requests: `https://api.github.com/repos/owner/repo/pulls`
- Releases: `https://api.github.com/repos/owner/repo/releases`

> [!TIP]
> When working with GitHub data in LLM prompts, the API's JSON format is often easier to parse and more token-efficient than scraping HTML pages. Use the API when you need structured data about issues, PRs, or repository metadata. You can filter and extract the pieces of the JSON you need, then format it for better inclusion in your prompts.

## The LLM Code Reading Paradox

Now that we understand how to extract and read code from GitHub, we need to address a more challenging problem: reading and evaluating code generated by LLMs. This presents a unique problem for junior developers. As a student learning to program in the age of LLMs, **you need to evaluate code that may be beyond your current skill level, but you lack the expertise to know what questions to ask:**

- LLMs generate code you don't fully understand
- You don't know what you don't know
- You can't evaluate what you can't understand
- It's difficult to ask good questions without understanding the problem space
- You can't learn effectively without asking good questions

This is made worse because LLMs generate code using advanced techniques, design patterns, and optimizations that you haven't learned yet. They might use language features you've never seen, implement algorithms you don't recognize, or make architectural decisions based on considerations you haven't encountered. LLMs have been trained on code that uses patterns and practices that are completely new to you.

### The Unique Challenges of LLM-Generated Code

In contrast to code written by humans on GitHub, LLM-generated code has unique characteristics that make critical reading even more important:

**Inconsistent Quality:**
LLMs can produce brilliant solutions one moment and subtle bugs the next. They may even fix a bug in one message, then re-introduce it in another. The same prompt can yield different results with varying quality. Unlike human code where you might trust a particular developer's work, LLM code quality is always unpredictable.

**Hidden Assumptions:**
LLMs make assumptions based on common patterns in their training data, but these assumptions may not match your specific context. For example, they might assume certain libraries are available, that input is always valid, or that performance doesn't matter. They might just as easily solve a problem with a laser-focus on performance when it isn't required, thus over-complicating the solution. Teasing out the underlying assumptions behind a snippet of code is critical.

**Over-Engineering:**
LLMs often generate solutions that are more complex than necessary. They might use design patterns inappropriately, add unnecessary layers of abstraction, or optimize prematurely. This happens because their training data includes lots of production code that handles complex requirements, which your use case might not need. Learning to decide what is and isn't necessary takes a lot of work.

**Under-Documentation:**
While LLMs can generate comments, these comments often restate the basics of what the code _does_ rather than explaining _why_. The reasoning behind design decisions, the trade-offs considered, and the assumptions made are rarely documented. Further, the comments are often marginal notes to the user from the assistant, but irrelevant to the problem domain.

**Plausible but Wrong:**
LLMs are excellent at generating code that _looks_ right: it follows conventions, uses proper syntax, and seems well-structured. But it might contain logical errors, security vulnerabilities, hallucinated dependencies, made-up method calls, or performance problems that aren't immediately obvious. We can't trust LLM-generated code.

**Lack of Context:**
LLMs don't know your codebase, your team's conventions, your performance requirements, or your users' needs. They generate code in isolation, which may not integrate well with your existing system. If you've gotten used to LLMs solving one-off programming problems for an assignment, you may not be prepared for how much harder you have to work to get good results in production environments.

Many of your colleagues will take the code written by an AI and simply accept it as-is: if it works, move on. But we need to do better. By using LLMs as reading partners, we can approach the code they produce in the same way that a senior-level developer would, and improve the outcome.

LLMs can help us solve the problems that LLMs create!

### Using LLMs to Overcome the Paradox

We need to see LLMs not merely as a source of code generation, but also as a way to overcome the junior developer paradox. We're not only going to ask them to generate code or validate our solutions, but also to:

- Generate critical questions we should ask about code
- Show us alternative approaches with different trade-offs
- Help us identify assumptions and edge cases
- Explain the reasoning behind design decisions
- Teach us systematic evaluation frameworks

The key is changing how we prompt. Instead of:

- "Is this code good?" (seeking validation)
- "Write me code to do X" (seeking solutions)

We ask:

- "Help me figure out which questions I should be asking about this code?" (seeking frameworks for interpretation)
- "Provide me with 3 different approaches and discuss their trade-offs" (seeking understanding)
- "Let's tease out the underlying assumptions that this code is making" (seeking critical thinking)

This transforms the LLM into a _true assistant_, and one that helps you develop more senior-level evaluation skills.

Our goal remains the same: we want an LLM to help us come up with working code. However, the way we'll get there is quite different. We're not going to copy/paste the first thing we get back from the model. Instead, we'll continue to press the LLM to help us build an understanding and make more informed decisions. When we get stuck, we'll look for support.

> [!TIP]
> An excellent way to work with LLMs is to read what they write, but force yourself to type things out manually vs. copy/pasting. Doing so forces you to spend more time going over each line, and gives opportunity for critical reflection.

### Strategic Prompting Patterns for Code Reading

Let's explore some specific prompting strategies for critical code reading.

> [!NOTE]
> There are many different ways to prompt a model to improve your code reading, and we'll explore a handful below. You can see more in the [additional prompting patterns](./prompting-patterns.md) document.

### The Socratic LLM - Asking Questions Instead of Giving Answers

Rather than asking the LLM to solve your problem directly, ask it to help you think through the problem systematically.

**Instead of:**

```markdown
Here's my code.... Fix it
```

**Try:**

````markdown
I have a function that's not working as expected:

```python
def process_orders(orders):
    total = 0
    for order in orders:
        total += order.price * order.quantity
    return total / len(orders)
```

Before we try to fix it, help me think this through step-by step, and answer these questions.

1. What is this function trying to accomplish?
2. What assumptions does it make about the input?
3. Are these assumptions correct? Are we missing any?
4. What could go wrong with this implementation?
5. Help me think about edge cases
6. What questions am I not asking that I should be?
````

This approach forces you to engage with the code critically rather than passively accepting a solution. The LLM becomes a thinking partner rather than an answer machine.

### The Comparative Analysis Pattern

Ask the LLM to show you multiple approaches to a problem and explain the trade-offs between them.

````markdown
I need to filter a list of users by age. Show me three different
ways to do this, and for each approach explain:

1. When you would use it
2. What the performance characteristics are
3. What the readability and maintenance trade-offs are
4. What the potential pitfalls are
5. How to choose between the solutions

```python
users = [
    {"name": "Alice", "age": 25},
    {"name": "Bob", "age": 30},
    {"name": "Charlie", "age": 35}
]
```

NOTE: My end goal is to be able to find all users over 30.
````

This pattern helps you understand that there's rarely one "right" answer in programming, just various trade-offs. You learn to think about context, requirements, and constraints. As you compare, you start to develop intuition about how to choose between options. Over time, your ability to make good choices improves

### The "Explain Your Reasoning" Pattern

When the LLM generates code, ask it to explain not just what it does, but _why_ specific choices were made.

````markdown
You suggested this implementation:

```javascript
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

I'm hesitant to just use this. Before I continue, I need you to explain:

1. I've read about "debouncing" a function before, but this is the first time I'm using it. Help me understand how it works.
2. Why did you use a closure here?
3. Why are you clearing the `timeout` twice?
4. I'm not familiar with the use of `...args`, can you teach it to me?
5. Are there any memory implications with this approach?
6. When would this pattern be inappropriate?
````

This transforms code generation into a learning opportunity. You're working hard to understand the code and make good choices, and you're pushing the LLM to help you build that understanding.

### The "Constraint-Based" Pattern

Provide constraints that force the LLM to explain trade-offs and help you understand why certain approaches are better than others.

````markdown
I need to sort a large array of objects by multiple fields. Here are my constraints:

- The array might have 100,000+ items
- I need to sort by `lastName`, then `firstName`, then `age`
- The data comes from an API and might have missing fields
- This needs to run in a browser

Show me how I might approach this problem, and explain:

1. Why you chose a particular sorting approach, based on my constraints
2. How I should handle missing fields
3. What the performance implications are, and if there are alternatives
4. Whether I should sort on the client or server, and how I decide between them
5. How to test this with realistic data

```javascript
const users = [
  { firstName: 'Alice', lastName: 'Smith', age: 30 },
  { firstName: 'Bob', lastName: 'Jones' }, // missing age
  // ... 100,000 more items
];
```
````

Here, our constraints help to narrow the LLM's focus to the particular use case we care about. We aren't trying to solve this problem in some arbitrary way; it needs to fit our problem space.

### The Meta-Skill: Learning to Ask Better Questions

The most important skill you'll develop in code reading is learning to ask progressively better questions. Code reading is code review. Each interaction with an LLM should make you better at:

- Identifying what you don't understand. Push the LLM hard to fill in gaps.
- Formulating precise questions. Ask it to help you write better questions and don't be afraid to "look dumb".
- Recognizing patterns and anti-patterns, when certain approaches make the most sense
- Understanding trade-offs and constraints
- Thinking systematically about code quality

Remember: **the goal isn't to use LLMs to avoid reading code; but rather to use LLMs to become a better code reader.** Every question you ask should make you more capable of evaluating code independently.

It's easier to read code that has been made more readable, and our final topic this week focuses on ways to improve readability through the addition of type annotations.

## Making Code Readable for Humans and LLMs through Types

In 2025, [GitHub announced](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/) that TypeScript had overtaken JavaScript as the most used language (Python was number two). It's no coincidence that an equally dramatic rise of LLM-assisted coding overlaps with a move toward typed languages.

Why is TypeScript so popular? One of the most effective ways to improve the quality of LLM-generated code is to use type annotations. Types provide explicit context about what your code expects and produces, which helps LLMs generate more accurate, safer, and more maintainable code.

> [!TIP]
> Types aren't just for the compiler or type checker. Think of types as documentation for both humans and AI. When you provide type information, you're giving the LLM crucial context about your intentions, constraints, and expectations. This leads to better code generation and fewer bugs.

When you write `function add(a: number, b: number): number`, you're not just documenting that `a` and `b` should be numbers. You're creating a **contract** that can be automatically verified. This contract helps LLMs understand exactly what you need, and it helps type checkers catch mistakes before your code runs. Types bridge the gap between what you intend and what you implement, between what an LLM reads and what it produces.

> [!NOTE]
> Without types, an LLM often hallucinates methods that sound plausible (e.g., `.sortBy()` on an array). With types, the LLM is constrained to the actual methods available on that specific object type, and these types are often known in advance, or can be shared as part of the prompt.

LLMs are trained on vast amounts of code, much of it untyped JavaScript and Python. When you prompt an LLM without type information, it has to guess at what types you're working with based on variable names, context, and common patterns. These guesses are often correct, but not always.

Consider these two prompts:

**Without types:**

```markdown
Write a function that takes user data and returns a formatted string: `"name[, email] (age)"`
```

**With types:**

````markdown
Write a function that returns a formatted string: `"name[, email] (age)"`

```ts
type User = {
  name: string;
  age: number;
  email?: string;
};

function formatUser(user: User): string;
```
````

The second prompt is unambiguous. The LLM knows exactly what structure a `user` has, which fields are required, and what type the function should return. This leads to more accurate code generation and fewer iterations.

Types also help when working with LLM-generated code. When the LLM generates a function, type annotations make it immediately clear what inputs are expected and what output is produced. You don't have to read through the implementation to understand the interface, since the types already tell you. You can also validate the generated code via the type checker in your IDE without running it.

> [!NOTE]
> Studies have shown that type annotations significantly reduce bugs in production code. A 2017 study of JavaScript projects found that adding TypeScript could have prevented 15% of bugs that made it to production ([Gao et al., 2017](https://www.microsoft.com/en-us/research/wp-content/uploads/2017/09/gao2017javascript.pdf)). Types catch errors at development time rather than runtime.

## TypeScript and Python Type Hints

Up to this point in the course, we've been focused on using JavaScript and Python as our main programming languages. These are excellent choices because they work everywhere and LLMs have extensive knowledge about how to use them via their training data. JavaScript and Python are also relatively easy to set up and have access to extensive ecosystems of third-party modules for doing just about any task.

A lot of people think that JavaScript and Python don't have types, which is incorrect. JavaScript and Python are **dynamically typed** languages, which means that type checking happens at **runtime** rather than **compile time**. When you write `let x = 6` in JavaScript or `x = 6` in Python, the variable `x` has a type, it just isn't **fixed**. You can later reassign `x = "hello"` and the language won't complain until you try to use it in a way that doesn't make sense (e.g., `x + 10` when `x` is a string in Python).

This is fundamentally different from **statically typed** languages like C and C++, where you must declare your types explicitly (`int x = 6;`) and have the compiler verify type correctness before the program runs. If you try to assign a string to an integer variable in C++, you'll get a compile-time error.

This dynamic nature makes JavaScript and Python incredibly flexible and expressive. You don't need to think about types upfront, and you can quickly experiment with different data structures and approaches. This flexibility is one reason why these languages are so popular for scripting, data science, web development, rapid prototyping, and now LLM programming.

However, this same flexibility comes with a cost: type errors that would be caught immediately in C/C++ can slip through and cause runtime failures in production. A function that expects a number might receive a string, and you won't know until that code path executes, possibly weeks after deployment.

### The Rapid Rise of Types

As JavaScript and Python codebases grew larger and more complex, the software development community recognized that the lack of static type checking was becoming a significant source of bugs and a maintenance burden. Large-scale applications with hundreds of thousands or millions of lines of code became difficult to maintain and refactor safely.

> [!NOTE]
> We won't spend a lot of time learning the specifics of the TypeScript and Python type systems, or how to set them up in your projects. However, a [simple setup guide](./types-setup.md) is provided as part of this week's material.

**TypeScript** was created by Microsoft in 2012 to address these challenges for JavaScript. Rather than creating an entirely new language, TypeScript was designed as a **superset of JavaScript**: any valid JavaScript program is _also_ valid TypeScript. This means you can adopt it gradually. TypeScript adds **optional static type annotations** and a **type checker** (`tsc`) that runs during development. You write TypeScript code, the type checker verifies it, and then it "compiles" to plain JavaScript that runs anywhere JavaScript runs.

> [!NOTE]
> It's not strictly correct to call TypeScript's `tsc` a compiler. Instead, it's a [transpiler](https://en.wikipedia.org/wiki/Source-to-source_compiler), which converts source code from one language (TypeScript) to another (JavaScript) vs. machine code.

Python followed a similar path with **type hints** in 2015 with Python 3.5 ([PEP 484](https://peps.python.org/pep-0484/)). Python's type hints are ignored by the interpreter during execution, though they remain accessible to libraries (e.g., Pydantic) wishing to use them for runtime validation. Tools like [pyright](https://github.com/microsoft/pyright), [mypy](https://mypy-lang.org/), or [ty](https://astral.sh/blog/ty) can use them for static analysis of the code.

The Python community took a different architectural approach from TypeScript. Rather than creating a new language that compiles to Python, they added type hints directly to Python itself as optional annotations. This means you use the same Python interpreter whether your code has type hints or not, and external tools perform the type checking separately.

Python's approach preserves the language's traditional workflow. You can run `python script.py` directly without any build step, and optionally run `mypy script.py` for type checking. The syntax was designed to be intuitive and non-invasive, using familiar Python constructs. Over time, the type system has evolved significantly, with Python 3.9 and 3.10 adding more concise syntax (like `list[str]` instead of `List[str]` and `str | None` instead of `Optional[str]`).

> [!NOTE]
> Today node.js and other runtimes support [running TypeScript without a compilation step](https://nodejs.org/en/learn/typescript/run-natively) by erasing the type annotations at runtime.

## Types as Executable Specifications

Let's look at some practical examples of how types improve LLM interactions.

### Example 1: API Response Handling

**Without types (JavaScript):**

```js
function processUser(data) {
  const name = data.name.toUpperCase();
  const age = data.age + 1;
  return { name, age };
}
```

What could go wrong? What if `data.name` is undefined? What if `data.age` is a string? The LLM might generate this code, but it's fragile.

**With types (TypeScript):**

```ts
interface User {
  name: string;
  age: number;
  // Optional field
  email?: string;
}

interface ProcessedUser {
  name: string;
  age: number;
}

function processUser(data: User): ProcessedUser {
  const name = data.name.toUpperCase();
  const age = data.age + 1;
  return { name, age };
}
```

Now the contract is clear. If you prompt an LLM to "add email validation to this function," it knows exactly what structure to work with.

### Example 2: Array Operations

**Without types (Python):**

```python
def find_adults(users):
    return [u for u in users if u["age"] >= 18]
```

**With types (Python):**

```python
from typing import TypedDict

class User(TypedDict):
    name: str
    age: int
    # Python 3.10+ union syntax
    email: str | None

def find_adults(users: list[User]) -> list[User]:
    return [u for u in users if u["age"] >= 18]
```

When you ask an LLM to "modify this to also filter by email domain," it knows the exact structure of `User` and can generate appropriate code.

### Type Inference: You Don't Need to Annotate Everything

Both TypeScript and Python can infer many types automatically. As we said above, these languages have runtime types, and it's often clear what a variable contains or function returns without needing explicit annotation. Focus on function signatures and complex data structures:

**TypeScript:**

```ts
// Type is inferred as number
const count = 16;

// Explicit type for Array, which can't be inferred without data
const values: number[] = [];

// Explicit return type, which is clearer
function multiply(a: number, b: number): number {
  return a * b;
}

// Implicit return type, which is also correct
function double(a: number) {
  return multiply(a, 2);
}
```

**Python:**

```python
# Type is inferred as int
count = 16

# Explicit type for list, which can't be inferred without data
values: list[int] = []

# Explicit return type, which is clearer
def multiply(a: int, b: int) -> int:
    return a * b

# Implicit return type, which is also correct
def double(a: int):
    return multiply(a, 2)
```

### Development Workflow

Here's a suggested workflow for including types in your development with LLMs:

1. **Define your types first** or ask the LLM to help you design them. These will form your contract and help constrain the model.
2. **Write function signatures** with your type annotations
3. **Run the type checker** to verify your types are consistent
4. **Implement the functions** with LLM help, forcing it to adhere to your types
5. **Run the type checker again** to catch errors and validate the code
6. **Use the LLM to fix type errors** and understand them. Feed the code and type errors back into the LLM, and have it explain the solution. Learn as you go.
7. **Refine your types** as you learn more about the problem

This workflow creates a feedback loop where types guide development and catch errors early.

> [!TIP]
> When you're stuck on a type error, it's tempting to use `any` in TypeScript or ignore type errors in Python. You can begin with this approach while you're learning, but it's a dangerous practice long term. Instead, use the error as a learning opportunity. Ask an LLM to explain what the type system is trying to tell you. Understanding type errors makes you a better programmer.

You can see a complete [TypeScript example project](./ts-example/) as part of the notes for this week.

Types transform how you work with LLMs. They provide context that leads to better code generation, they catch errors before runtime, and they serve as documentation for both humans and AI. Start small: add types to function parameters and return values. Let the type checker guide you. Use LLMs to help you understand type errors and learn type patterns. Over time, you'll develop an intuition for when and how to use types effectively.

## Conclusion

This week we've explored how to work effectively with code as text:

1. **LLMs excel at code** because it's structured, unambiguous text
2. **Reading comprehension is the bottleneck** - LLMs can generate code faster than we can evaluate it
3. **GitHub as a definitive reading source and how to extract useful text** through raw URLs, DIFFs, patches, and APIs
4. **LLMs can help us read code better** through strategic prompting patterns
5. **Types make code more readable** for both humans and LLMs

Next week, we'll continue or exploration of type annotations and hints as we look at how to force LLMs to produce structured outputs.