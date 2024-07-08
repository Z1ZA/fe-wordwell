import React, { useEffect, useState } from "react";
import { type AI } from "../../app/action";
import { useActions } from "ai/rsc";
import Markdown from "react-markdown";
import CopyToClipboard from "react-copy-to-clipboard";
import { Copy, Check, ArrowsCounterClockwise } from "@phosphor-icons/react";
import "react-tooltip/dist/react-tooltip.css";
import { Tooltip } from "react-tooltip";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GlobalApi from "@/app/_utils/GlobalApi";

const Modal = ({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-0 right-0 mt-4 mr-4 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 w-full max-w-sm">
      <div className="flex items-center">
        <h2 className="text-lg font-semibold flex-grow text-black dark:text-white">
          Notice
        </h2>
        <div className="flex justify-center ml-2">
          <button
            className="text-black dark:text-white focus:outline-none"
            onClick={onClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 256 256"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8Z"></path>
            </svg>
          </button>
        </div>
      </div>
      <div className="flex flex-wrap mx-1 w-full transition-all duration-500 max-h-[200px] overflow-hidden">
        <div className="text-black dark:text-white">{message}</div>
      </div>
    </div>
  );
};

const StreamingComponent = ({
  currentLlmResponse,
}: {
  currentLlmResponse: string;
}) => {
  return (
    <>
      {currentLlmResponse && (
        <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4 max-w-sm md:max-w-md">
          <div className="flex items-center">
            <h2 className="text-lg font-semibold flex-grow dark:text-white text-black">
              Answer
            </h2>
          </div>
          <div className="dark:text-gray-300 text-gray-800">
            {currentLlmResponse}
          </div>
        </div>
      )}
    </>
  );
};

interface LLMResponseComponentProps {
  llmResponse: string;
  currentLlmResponse: string;
  index: number;
  semanticCacheKey: string;
  isolatedView: boolean;
  logo?: string;
}

const SkeletonLoader = () => {
  return (
    <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4">
      <div className="flex items-center">
        <div className="h-4 bg-gray-300 rounded-full dark:bg-gray-600 w-32 mb-4 animate-pulse"></div>
      </div>
      <div className="flex flex-col space-y-2">
        <div className="h-2 bg-gray-300 rounded-full dark:bg-gray-700 w-full animate-pulse delay-75"></div>
        <div className="h-2 bg-gray-300 rounded-full dark:bg-gray-700 w-3/4 animate-pulse delay-100"></div>
        <div className="h-2 bg-gray-300 rounded-full dark:bg-gray-700 w-2/3 animate-pulse delay-150"></div>
      </div>
    </div>
  );
};

const CustomMarkdown: React.FC<{ content: string }> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ node, ...props }) => (
          <p className="mb-2 dark:text-white" {...props} />
        ),
        h1: ({ node, ...props }) => (
          <h1 className="text-xl font-bold mb-2 dark:text-white" {...props} />
        ),
        h2: ({ node, ...props }) => (
          <h2 className="text-lg font-bold mb-2 dark:text-white" {...props} />
        ),
        li: ({ node, ...props }) => (
          <li
            className="list-disc list-inside ml-4 dark:text-white"
            {...props}
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

const LLMResponseComponent = ({
  llmResponse,
  currentLlmResponse,
  index,
  semanticCacheKey,
  isolatedView,
  logo,
}: LLMResponseComponentProps) => {
  const { clearSemanticCache } = useActions<typeof AI>();
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  // const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // const [kataKasar, setKataKasar] = useState<string[]>([]);

  const hasLlmResponse = llmResponse && llmResponse.trim().length > 0;
  const hasCurrentLlmResponse =
    currentLlmResponse && currentLlmResponse.trim().length > 0;

  const handleClearCache = () => {
    clearSemanticCache(semanticCacheKey);
    setShowModal(true);
  };

  // useEffect(() => {
  //   const loadKataKasar = async () => {
  //     try {
  //       const response = await GlobalApi.getAllWords();
  //       const words = response.data.data.map((item: any) =>
  //         item.attributes.title.toLowerCase()
  //       );
  //       setKataKasar(words);
  //     } catch (error) {
  //       console.error("Failed to load kata kasar:", error);
  //     }
  //   };

  //   loadKataKasar();
  // }, []);

  // useEffect(() => {
  //   // Cek apakah llmResponse atau currentLlmResponse adalah kata kasar
  //   const isKataKasar = kataKasar.some(
  //     (kata) =>
  //       llmResponse.toLowerCase().includes(kata) ||
  //       currentLlmResponse.toLowerCase().includes(kata)
  //   );

  //   if (!isKataKasar && (hasLlmResponse || hasCurrentLlmResponse)) {
  //     setErrorMessage("Hanya masukkan kata-kata kasar");
  //   } else {
  //     setErrorMessage(null);
  //   }
  // }, [llmResponse, currentLlmResponse, kataKasar]);

  return (
    <div
      className={
        isolatedView ? "flex flex-col mx-auto max-w-sm md:max-w-md" : ""
      }
    >
      {showModal && (
        <Modal
          message={`The query of '${semanticCacheKey}' has been cleared from cache. `}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* {errorMessage ? (
        <div className="bg-red-500 text-white p-4 rounded-lg shadow-md">
          {errorMessage}
        </div>
      ) :  */}
      {hasLlmResponse || hasCurrentLlmResponse ? (
        <>
          {hasLlmResponse ? (
            <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4 max-w-sm md:max-w-md">
              <div className="flex items-center">
                <h2 className="text-lg font-semibold flex-grow dark:text-white text-black">
                  Response
                </h2>
              </div>
              <div className="dark:text-gray-300 text-gray-800 markdown-container">
                <CustomMarkdown content={llmResponse} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-between">
                  <CopyToClipboard
                    text={llmResponse}
                    onCopy={() => setCopied(true)}
                  >
                    <button
                      id="not-clickable"
                      className="text-black dark:text-white focus:outline-none mr-2"
                    >
                      {copied ? <Check size={20} /> : <Copy size={20} />}
                      <Tooltip anchorSelect="#not-clickable">
                        <button>Copy</button>
                      </Tooltip>
                    </button>
                  </CopyToClipboard>
                </div>
              </div>
            </div>
          ) : (
            <StreamingComponent currentLlmResponse={currentLlmResponse} />
          )}
        </>
      ) : (
        <SkeletonLoader />
      )}
    </div>
  );
};

export default LLMResponseComponent;
