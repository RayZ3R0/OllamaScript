// ==UserScript==
// @name         Ollama Text Processor with Context Menu
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Process selected text using Ollama with Alt + Left Click
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

(function () {
  "use strict";

  // Configuration
  const OLLAMA_API_ENDPOINT = "http://localhost:11434/api/generate";
  const MODEL_NAME = "qwen2.5:1.5b";

  // Simple menu options placeholder - you can replace this later with your full menu options
  const menuOptions = [
    {
      label: "📝 Summarize",
      prompt: `
# IDENTITY and PURPOSE

You are an expert content summarizer. You take content in and output a Markdown formatted summary using the format below.

Take a deep breath and think step by step about how to best accomplish this goal using the following steps.

# OUTPUT SECTIONS

- Combine all of your understanding of the content into a single, 20-word sentence in a section called ONE SENTENCE SUMMARY:.

- Output the 10 most important points of the content as a list with no more than 15 words per point into a section called MAIN POINTS:.

- Output a list of the 5 best takeaways from the content in a section called TAKEAWAYS:.

# OUTPUT INSTRUCTIONS

- Create the output using the formatting above.
- You only output human readable Markdown.
- Output numbered lists, not bullets.
- Do not output warnings or notes—just the requested sections.
- Do not repeat items in the output sections.
- Do not start items with the same opening words.

# INPUT:

INPUT: {{TEXT}}`,
    },
    {
      label: "🧠 Extract Wisdom",
      prompt: `
            # IDENTITY and PURPOSE

You extract surprising, insightful, and interesting information from text content. You are interested in insights related to the purpose and meaning of life, human flourishing, the role of technology in the future of humanity, artificial intelligence and its affect on humans, memes, learning, reading, books, continuous improvement, and similar topics.

Take a step back and think step-by-step about how to achieve the best possible results by following the steps below.

# STEPS

- Extract a summary of the content in 25 words, including who is presenting and the content being discussed into a section called SUMMARY.

- Extract 20 to 50 of the most surprising, insightful, and/or interesting ideas from the input in a section called IDEAS:. If there are less than 50 then collect all of them. Make sure you extract at least 20.

- Extract 10 to 20 of the best insights from the input and from a combination of the raw input and the IDEAS above into a section called INSIGHTS. These INSIGHTS should be fewer, more refined, more insightful, and more abstracted versions of the best ideas in the content.

- Extract 15 to 30 of the most surprising, insightful, and/or interesting quotes from the input into a section called QUOTES:. Use the exact quote text from the input.

- Extract 15 to 30 of the most practical and useful personal habits of the speakers, or mentioned by the speakers, in the content into a section called HABITS. Examples include but aren't limited to: sleep schedule, reading habits, things they always do, things they always avoid, productivity tips, diet, exercise, etc.

- Extract 15 to 30 of the most surprising, insightful, and/or interesting valid facts about the greater world that were mentioned in the content into a section called FACTS:.

- Extract all mentions of writing, art, tools, projects and other sources of inspiration mentioned by the speakers into a section called REFERENCES. This should include any and all references to something that the speaker mentioned.

- Extract the most potent takeaway and recommendation into a section called ONE-SENTENCE TAKEAWAY. This should be a 15-word sentence that captures the most important essence of the content.

- Extract the 15 to 30 of the most surprising, insightful, and/or interesting recommendations that can be collected from the content into a section called RECOMMENDATIONS.

# OUTPUT INSTRUCTIONS

- Only output Markdown.

- Write the IDEAS bullets as exactly 15 words.

- Write the RECOMMENDATIONS bullets as exactly 15 words.

- Write the HABITS bullets as exactly 15 words.

- Write the FACTS bullets as exactly 15 words.

- Write the INSIGHTS bullets as exactly 15 words.

- Extract at least 25 IDEAS from the content.

- Extract at least 10 INSIGHTS from the content.

- Extract at least 20 items for the other output sections.

- Do not give warnings or notes; only output the requested sections.

- You use bulleted lists for output, not numbered lists.

- Do not repeat ideas, quotes, facts, or resources.

- Do not start items with the same opening words.

- Ensure you follow ALL these instructions when creating your output.

# INPUT

INPUT: {{TEXT}}`,
    },
    {
      label: "🗑 Clean Text",
      prompt: `# IDENTITY and PURPOSE

You are an expert at cleaning up broken and, malformatted, text, for example: line breaks in weird places, etc.

# Steps

- Read the entire document and fully understand it.
- Remove any strange line breaks that disrupt formatting.
- Add capitalization, punctuation, line breaks, paragraphs and other formatting where necessary.
- Do NOT change any content or spelling whatsoever.

# OUTPUT INSTRUCTIONS

- Output the full, properly-formatted text.
- Do not output warnings or notes—just the requested sections.

# INPUT:

INPUT: {{TEXT}}`,
    },
  ];

  const styles = `
        :root {
            --ollama-bg-light: #ffffff;
            --ollama-bg-dark: #1e1e1e;
            --ollama-text-light: #333333;
            --ollama-text-dark: #e0e0e0;
            --ollama-accent: #3498db;
            --ollama-border-light: #e0e0e0;
            --ollama-border-dark: #444444;
            --ollama-shadow: rgba(0, 0, 0, 0.15);
        }

        .ollama-summary-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }

        .ollama-summary-overlay.show {
            opacity: 1;
        }

        .ollama-summary-modal {
            background: var(--ollama-bg-light);
            color: var(--ollama-text-light);
            border-radius: 12px;
            box-shadow: 0 12px 24px var(--ollama-shadow);
            max-width: 800px; /* increased from 600px */
            width: 90%;
            max-height: 80%;
            padding: 32px; /* increased from 24px */
            position: relative;
            transform: scale(0.9);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            border: 1px solid var(--ollama-border-light);
            overflow-y: auto;
            pointer-events: auto;
        }

        .ollama-summary-modal.show {
            transform: scale(1);
            opacity: 1;
        }

        .ollama-summary-modal.ollama-summary-loading {
            width: auto;
            max-width: 300px;
            height: auto;
            cursor: move;
            transition: all 0.3s ease;
        }

        .ollama-summary-modal.expanding {
            max-width: 800px;
            width: 90%;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .ollama-dragging {
            user-select: none;
            cursor: move;
        }

        .ollama-summary-close {
            position: absolute;
            top: 16px;
            right: 16px;
            cursor: pointer;
            font-size: 24px;
            color: var(--ollama-accent);
            transition: transform 0.2s ease;
            background: none;
            border: none;
            line-height: 1;
        }

        .ollama-summary-close:hover {
            transform: scale(1.2) rotate(90deg);
        }

        .ollama-summary-content {
            line-height: 1.6;
            font-size: 16px;
            padding: 0 16px;
        }

        .ollama-summary-content strong {
            display: block;
            margin-top: 1em;
            color: var(--ollama-accent);
        }

        .ollama-summary-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: var(--ollama-text-light);
            gap: 16px;
        }

        .ollama-summary-spinner {
            width: 48px;
            height: 48px;
            border: 4px solid var(--ollama-accent);
            border-bottom-color: transparent;
            border-radius: 50%;
            display: inline-block;
            animation: rotation 1s linear infinite;
        }

        .ollama-context-menu {
            position: fixed;
            z-index: 10000;
            background: var(--ollama-bg-light);
            border: 1px solid var(--ollama-border-light);
            border-radius: 8px;
            padding: 8px 0;
            min-width: 200px;
            box-shadow: 0 2px 10px var(--ollama-shadow);
        }

        .ollama-context-menu-item {
            padding: 8px 16px;
            cursor: pointer;
            transition: background-color 0.2s;
            color: var(--ollama-text-light);
        }

        .ollama-context-menu-item:hover {
            background-color: var(--ollama-accent);
            color: white;
        }

        @keyframes rotation {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @media (prefers-color-scheme: dark) {
            .ollama-summary-modal {
                background: var(--ollama-bg-dark);
                color: var(--ollama-text-dark);
                border-color: var(--ollama-border-dark);
            }
            .ollama-context-menu {
                background: var(--ollama-bg-dark);
                border-color: var(--ollama-border-dark);
            }
            .ollama-context-menu-item {
                color: var(--ollama-text-dark);
            }
        }
    `;

  // Inject styles
  const styleElement = document.createElement("style");
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);

  // Create context menu
  function createContextMenu(x, y, selectedText) {
    removeContextMenu();

    // Calculate position accounting for scroll
    const posX = x;
    const posY = y;

    const menu = $("<div>")
      .addClass("ollama-context-menu")
      .css({
        top: posY + "px",
        left: posX + "px",
      });

    menuOptions.forEach((option) => {
      const menuItem = $("<div>")
        .addClass("ollama-context-menu-item")
        .text(option.label)
        .on("click", () => {
          processText(selectedText, option.prompt);
          removeContextMenu();
        });
      menu.append(menuItem);
    });

    $(document.body).append(menu);

    // Adjust position if menu goes off screen
    const menuRect = menu[0].getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (menuRect.right > windowWidth) {
      menu.css("left", windowWidth - menuRect.width - 10 + "px");
    }
    if (menuRect.bottom > windowHeight) {
      menu.css("top", y - menuRect.height - 10 + "px");
    }
  }

  function removeContextMenu() {
    $(".ollama-context-menu").remove();
  }

  function processText(text, promptTemplate) {
    const loading = showLoading();

    GM_xmlhttpRequest({
      method: "POST",
      url: OLLAMA_API_ENDPOINT,
      headers: {
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        model: MODEL_NAME,
        prompt: promptTemplate.replace("{{TEXT}}", text),
        stream: false,
      }),
      onload: function (response) {
        try {
          const responseData = JSON.parse(response.responseText);
          const result = responseData.response.trim();

          // Get the current position of the loading modal
          const modalRect = loading.modal[0].getBoundingClientRect();

          // Add expanding class and animate to center
          loading.modal.addClass("expanding").css({
            transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            position: "fixed",
            left: "50%",
            top: "50%",
            right: "auto",
            bottom: "auto",
            transform: "translate(-50%, -50%)",
          });

          // Wait for animation then show result
          setTimeout(() => {
            createSummaryModal(result);
          }, 500);
        } catch (error) {
          alert("Error processing text: " + error.message);
          loading.hide();
        }
      },
      onerror: function (error) {
        alert("Failed to process text. Ensure Ollama is running.");
        loading.hide();
      },
    });
  }

  function createSummaryModal(content) {
    $(".ollama-summary-overlay").remove();

    const overlay = $("<div>").addClass("ollama-summary-overlay");
    const modal = $("<div>").addClass("ollama-summary-modal");

    const closeButton = $("<button>")
      .addClass("ollama-summary-close")
      .html("&times;")
      .on("click", () => {
        overlay.removeClass("show");
        modal.removeClass("show");
        setTimeout(() => overlay.remove(), 300);
      });
    modal.append(closeButton);

    // New formatting logic
    const formattedContent = content
      // First handle markdown headers
      .replace(/^### (.*?)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*?)$/gm, "<h1>$1</h1>")

      // Handle bold text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")

      // Handle bullet points without extra newlines
      .replace(/^(\s*)-\s*(.*?)(\n|$)/gm, "<li>$2</li>")
      .replace(/^(\s*)\d+\.\s*(.*?)(\n|$)/gm, "<li>$2</li>")

      // Group lists
      .replace(/<\/li>\n*<li>/g, "</li><li>")

      // Handle paragraphs, but not within lists
      .replace(/\n\n(?!<li>)/g, "</p><p>")

      // Clean up any remaining newlines that aren't in lists
      .replace(/\n(?!<li>)/g, "<br>");

    // Add CSS for proper formatting
    const modalStyles = `
        <style>
            .ollama-summary-content h1,
            .ollama-summary-content h2,
            .ollama-summary-content h3 {
                color: var(--ollama-accent);
                margin-top: 1.5em;
                margin-bottom: 0.5em;
            }
            .ollama-summary-content h1 { font-size: 1.5em; }
            .ollama-summary-content h2 { font-size: 1.3em; }
            .ollama-summary-content h3 { font-size: 1.1em; }
            .ollama-summary-content p { margin: 1em 0; }
            .ollama-summary-content li {
                margin: 0.5em 0;
                margin-left: 1.5em;
                list-style-type: disc;
            }
            .ollama-summary-content li li {
                margin-left: 2em;
            }
            .ollama-summary-content strong {
                font-weight: bold;
                color: inherit;
            }
        </style>
    `;

    const contentDiv = $("<div>")
      .addClass("ollama-summary-content")
      .html(modalStyles + "<p>" + formattedContent + "</p>");
    modal.append(contentDiv);

    overlay.append(modal);
    $(document.body).append(overlay);

    setTimeout(() => {
      overlay.addClass("show");
      modal.addClass("show");
    }, 10);

    overlay.on("click", function (e) {
      if (e.target === this) {
        $(this).removeClass("show");
        modal.removeClass("show");
        setTimeout(() => $(this).remove(), 300);
      }
    });

    return overlay;
  }

  function showLoading() {
    $(".ollama-summary-overlay").remove();

    const overlay = $("<div>").addClass("ollama-summary-overlay");
    const modal = $("<div>").addClass(
      "ollama-summary-modal ollama-summary-loading",
    );
    const spinner = $("<div>").addClass("ollama-summary-spinner");
    const loadingText = $("<div>").text("Generating summary...");

    modal.append(spinner, loadingText);
    overlay.append(modal);
    $(document.body).append(overlay);

    // Store the initial position for animation later
    const initialPosition = {
      right: "20px",
      bottom: "20px",
      transform: "none",
      margin: "0",
    };

    modal.css({
      position: "fixed",
      ...initialPosition,
    });

    // Make modal draggable
    let isDragging = false;
    let startX;
    let startY;
    let modalX = window.innerWidth - modal.outerWidth() - 20;
    let modalY = window.innerHeight - modal.outerHeight() - 20;

    modal.on("mousedown", function (e) {
      if (
        e.target === modal[0] ||
        $(e.target).closest(".ollama-summary-loading").length
      ) {
        isDragging = true;
        startX = e.clientX - modalX;
        startY = e.clientY - modalY;
        modal.addClass("ollama-dragging");
      }
    });

    $(document).on("mousemove", function (e) {
      if (isDragging) {
        e.preventDefault();

        let newX = e.clientX - startX;
        let newY = e.clientY - startY;

        const maxX = window.innerWidth - modal.outerWidth();
        const maxY = window.innerHeight - modal.outerHeight();

        newX = Math.min(Math.max(0, newX), maxX);
        newY = Math.min(Math.max(0, newY), maxY);

        modalX = newX;
        modalY = newY;
        modal.css({
          left: newX + "px",
          top: newY + "px",
          right: "auto",
          bottom: "auto",
        });
      }
    });

    $(document).on("mouseup", function () {
      isDragging = false;
      modal.removeClass("ollama-dragging");
    });

    setTimeout(() => {
      overlay.addClass("show");
      modal.addClass("show");
    }, 10);

    return {
      overlay: overlay,
      modal: modal,
      position: {
        x: modalX,
        y: modalY,
      },
      hide: function () {
        this.overlay.removeClass("show");
        setTimeout(() => this.overlay.remove(), 300);
      },
    };
  }

  // Event listeners
  document.addEventListener("mousedown", function (e) {
    // Check if Alt key is pressed and it's a left click
    if (e.altKey && e.button === 0) {
      const selectedText = window.getSelection().toString().trim();

      if (selectedText) {
        // Prevent default action
        e.preventDefault();
        e.stopPropagation();

        // Create context menu at click position using client coordinates
        createContextMenu(e.clientX, e.clientY, selectedText);
      }
    }
  });

  // Modified click event listener
  document.addEventListener("click", function (e) {
    // Only remove context menu if we're not clicking with Alt key pressed
    if (!e.altKey && !$(e.target).closest(".ollama-context-menu").length) {
      removeContextMenu();
    }
  });

  // Close context menu when scrolling
  document.addEventListener("scroll", removeContextMenu);
})();
