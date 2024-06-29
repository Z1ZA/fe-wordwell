"use client";
// 1. Import Dependencies
import { FormEvent, useEffect, useRef, useState, useCallback } from "react";
import { useActions, readStreamableValue } from "ai/rsc";
import { type AI } from "@/app/action";
import { ChatScrollAnchor } from "@/lib/hooks/chat-scroll-anchor";
import Textarea from "react-textarea-autosize";
import { useEnterSubmit } from "@/lib/hooks/use-enter-submit";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
// Main components
import SearchResultsComponent from "@/components/answer/SearchResultComponent";
import UserMessageComponent from "@/components/answer/UserMessageComponent";
import InitialQueries from "@/components/answer/InitialQueries";
// Sidebar components
import LLMResponseComponent from "@/components/answer/LLMResponseComponent";
// Function calling components
import { ArrowUp } from "@phosphor-icons/react";
// OPTIONAL: Use Upstash rate limiting to limit the number of requests per user
import RateLimit from "@/components/answer/RateLimit";
import { toolConfig } from "@/app/config-tools";
// 2. Set up types
interface SearchResult {
  favicon: string;
  link: string;
  title: string;
}
interface Message {
  falBase64Image: any;
  logo: string | undefined;
  semanticCacheKey: any;
  cachedData: string;
  id: number;
  type: string;
  content: string;
  userMessage: string;

  isStreaming: boolean;
  searchResults?: SearchResult[];
  conditionalFunctionCallUI?: any;
  status?: string;

  isolatedView: boolean;
}
interface StreamMessage {
  isolatedView: any;
  searchResults?: any;
  userMessage?: string;
  llmResponse?: string;
  llmResponseEnd?: boolean;
  conditionalFunctionCallUI?: any;
  status?: string;
  cachedData?: string;
  semanticCacheKey?: any;
  falBase64Image?: any;
}

const mentionTools = toolConfig.useMentionQueries
  ? toolConfig.mentionTools
  : [];

export default function HalusKata() {
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedMentionTool, setSelectedMentionTool] = useState<string | null>(
    null
  );
  const [selectedMentionToolLogo, setSelectedMentionToolLogo] = useState<
    string | null
  >(null);
  // 3. Set up action that will be used to stream all the messages
  const { myAction } = useActions<typeof AI>();
  // 4. Set up form submission handling
  const { formRef, onKeyDown } = useEnterSubmit();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");
  // 5. Set up state for the messages
  const [messages, setMessages] = useState<Message[]>([]);
  // 6. Set up state for the CURRENT LLM response (for displaying in the UI while streaming)
  const [currentLlmResponse, setCurrentLlmResponse] = useState("");
  // 7. Set up handler for when the user clicks on the follow up button
  const handleFollowUpClick = useCallback(async (question: string) => {
    setCurrentLlmResponse("");
    await handleUserMessageSubmission({
      message: question,
      mentionTool: null,
      logo: null,
    });
  }, []);

  // 8. For the form submission, we need to set up a handler that will be called when the user submits the form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/") {
        if (
          e.target &&
          ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).nodeName)
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (inputRef?.current) {
          inputRef.current.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [inputRef]);
  // 9. Set up handler for when a submission is made, which will call the myAction function
  const handleSubmit = async (payload: {
    message: string;
    mentionTool: string | null;
    logo: string | null;
  }) => {
    if (!payload.message) return;
    await handleUserMessageSubmission(payload);
  };
  const handleFormSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setInputValue("");

    const payload = {
      message: inputValue.trim(),
      mentionTool: selectedMentionTool,
      logo: selectedMentionToolLogo,
    };

    await handleSubmit(payload);
    setSelectedMentionTool(null);
    setSelectedMentionToolLogo(null);
  };
  const handleUserMessageSubmission = async (payload: {
    logo: any;
    message: string;
    mentionTool: string | null;
  }): Promise<void> => {
    const newMessageId = Date.now();
    const newMessage = {
      id: newMessageId,
      type: "userMessage",
      userMessage: payload.message,
      mentionTool: payload.mentionTool,
      logo: payload.logo,
      content: "",
      isStreaming: true,
      searchResults: [] as SearchResult[],
      status: "",
      semanticCacheKey: null,
      cachedData: "",
      isolatedView: !!payload.mentionTool, // Set isolatedView based on mentionTool
      falBase64Image: null,
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    let lastAppendedResponse = "";
    try {
      const streamableValue = await myAction(
        payload.message,
        payload.mentionTool,
        payload.logo
      );

      let llmResponseString = "";
      for await (const message of readStreamableValue(streamableValue)) {
        const typedMessage = message as StreamMessage;
        setMessages((prevMessages) => {
          const messagesCopy = [...prevMessages];
          const messageIndex = messagesCopy.findIndex(
            (msg) => msg.id === newMessageId
          );
          if (messageIndex !== -1) {
            const currentMessage = messagesCopy[messageIndex];

            currentMessage.status =
              typedMessage.status === "rateLimitReached"
                ? "rateLimitReached"
                : currentMessage.status;

            if (typedMessage.isolatedView) {
              currentMessage.isolatedView = true;
            }

            if (
              typedMessage.llmResponse &&
              typedMessage.llmResponse !== lastAppendedResponse
            ) {
              currentMessage.content += typedMessage.llmResponse;
              lastAppendedResponse = typedMessage.llmResponse;
            }

            currentMessage.isStreaming = typedMessage.llmResponseEnd
              ? false
              : currentMessage.isStreaming;
            currentMessage.searchResults =
              typedMessage.searchResults || currentMessage.searchResults;

            currentMessage.semanticCacheKey = messagesCopy[messageIndex];
            currentMessage.falBase64Image = typedMessage.falBase64Image;

            if (typedMessage.conditionalFunctionCallUI) {
              const functionCall = typedMessage.conditionalFunctionCallUI;
            }

            if (typedMessage.cachedData) {
              const data = JSON.parse(typedMessage.cachedData);
              currentMessage.searchResults = data.searchResults;
              currentMessage.content = data.llmResponse;
              currentMessage.isStreaming = false;
              currentMessage.semanticCacheKey = data.semanticCacheKey;
              currentMessage.conditionalFunctionCallUI =
                data.conditionalFunctionCallUI;

              if (data.conditionalFunctionCallUI) {
                const functionCall = data.conditionalFunctionCallUI;
              }
            }
          }
          return messagesCopy;
        });
        if (typedMessage.llmResponse) {
          llmResponseString += typedMessage.llmResponse;
          setCurrentLlmResponse(llmResponseString);
        }
      }
    } catch (error) {
      console.error("Error streaming data for user message:", error);
    }
  };
  return (
    <div className="max-w-md w-full">
      <div
        className={`flex flex-col border dark:border-white items-center rounded-lg p-6 gap-2 shadow-md bg-gradient-to-b duration-300 ease-in-out animate-in dark:from-gray-900/10 dark:from-10% peer-[[data-state=open]]:group-[]:lg:pl-[250px] peer-[[data-state=open]]:group-[]:xl:pl-[300px]] bring-to-front`}
      >
        <div>
          <h1 className="font-medium text-base">
            Perbaiki Kalimat Menjadi Lebih Halus
          </h1>
        </div>
        <div className="w-full sm:px-4">
          {mentionQuery && (
            <div className="">
              {/* <div className="flex items-center"></div> */}
              <ul>
                {mentionTools
                  .filter((tool) =>
                    tool.name.toLowerCase().includes(mentionQuery.toLowerCase())
                  )
                  .map((tool) => (
                    <li
                      key={tool.id}
                      className="flex items-center cursor-pointer dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mb-2"
                      onClick={() => {
                        setSelectedMentionTool(tool.id);
                        setSelectedMentionToolLogo(tool.logo);
                        setMentionQuery("");
                        setInputValue(" "); // Update the input value with a single blank space
                      }}
                    >
                      {tool.logo ? (
                        <img
                          src={tool.logo}
                          alt={tool.name}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <span
                          role="img"
                          aria-label="link"
                          className="mr-2 dark:text-white text-black"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 256 256"
                            fill="currentColor"
                            className="h-4 w-4"
                          >
                            <path d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8Z"></path>
                          </svg>
                        </span>
                      )}

                      <p className="ml-2 dark:text-white block sm:inline text-md sm:text-lg font-semibold dark:text-white text-black">
                        @{tool.name}
                      </p>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <form
            ref={formRef}
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              handleFormSubmit(e);
              setCurrentLlmResponse("");
              if (window.innerWidth < 600) {
                (e.target as HTMLFormElement)["message"]?.blur();
              }
              const value = inputValue.trim();
              setInputValue("");
              if (!value) return;
            }}
          >
            <div className="relative flex flex-col w-full overflow-hidden max-h-60 grow dark:bg-slate-800 bg-gray-100 border sm:px-2">
              {selectedMentionToolLogo && (
                <img
                  src={selectedMentionToolLogo}
                  className="absolute left-2 top-4 w-8 h-8"
                />
              )}
              <Textarea
                ref={inputRef}
                tabIndex={0}
                onKeyDown={onKeyDown}
                placeholder="Masukkan kalimat..."
                className={`w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm dark:text-white text-black pr-[45px] ${
                  selectedMentionToolLogo ? "pl-10" : ""
                }`}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                name="message"
                rows={1}
                value={inputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setInputValue(value);

                  if (value.includes("@")) {
                    const mentionIndex = value.lastIndexOf("@");
                    const query = value.slice(mentionIndex + 1);
                    setMentionQuery(query);
                  } else {
                    setMentionQuery("");
                  }

                  if (value.trim() === "") {
                    setSelectedMentionTool(null);
                    setSelectedMentionToolLogo(null);
                  }
                }}
              />
              <ChatScrollAnchor trackVisibility={true} />
              <div className="absolute right-4 top-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="submit"
                      size="icon"
                      disabled={inputValue === ""}
                    >
                      <ArrowUp />
                      <span className="sr-only">Send message</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send message</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </form>
          {messages.length === 0 && !inputValue && (
            <InitialQueries
              questions={["Kamu kok bangsat banget"]}
              handleFollowUpClick={handleFollowUpClick}
            />
          )}
        </div>
      </div>
      {messages.length > 0 && (
        <div className="flex flex-col items-center justify-center">
          {messages
            .map((message, index) => (
              <div key={`message-${index}`}>
                {message.isolatedView ? (
                  selectedMentionTool === "fal-ai/stable-diffusion-v3-medium" ||
                  message.falBase64Image ===
                  (
                    <LLMResponseComponent
                      key={`llm-response-${index}`}
                      llmResponse={message.content}
                      currentLlmResponse={currentLlmResponse}
                      index={index}
                      semanticCacheKey={message.semanticCacheKey}
                      isolatedView={true}
                      logo={message.logo}
                    />
                  )
                ) : (
                  // Render regular view
                  <div className="flex flex-col md:flex-row max-w-md mx-auto">
                    <div className="w-full">
                      {message.status &&
                        message.status === "rateLimitReached" && <RateLimit />}
                      {message.type === "userMessage" && (
                        <UserMessageComponent message={message.userMessage} />
                      )}

                      <LLMResponseComponent
                        llmResponse={message.content}
                        currentLlmResponse={currentLlmResponse}
                        index={index}
                        semanticCacheKey={message.semanticCacheKey}
                        key={`llm-response-${index}`}
                        isolatedView={false}
                      />

                      {message.searchResults && (
                        <SearchResultsComponent
                          key={`searchResults-${index}`}
                          searchResults={message.searchResults}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
            .reverse()}
        </div>
      )}
    </div>
  );
}
