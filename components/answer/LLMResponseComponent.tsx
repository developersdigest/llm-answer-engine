import React, { useState } from 'react';
// 0. Import the 'useActions' hook from the 'use-actions' package
import { type AI } from '../../app/action';
import { useActions } from 'ai/rsc';

// 1. Define the 'LLMResponseComponentProps' interface with properties for 'llmResponse', 'currentLlmResponse', 'index', and 'semanticCacheKey'
interface LLMResponseComponentProps {
    llmResponse: string;
    currentLlmResponse: string;
    index: number;
    semanticCacheKey: string;
}

// 2. Import the 'Markdown' component from 'react-markdown'
import Markdown from 'react-markdown';

// Modal component to display the fade-out message
const Modal = ({ message, onClose }: { message: string; onClose: () => void }) => {
    React.useEffect(() => {
        const timer = setTimeout(onClose, 3000); // Close modal after 3 seconds
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed top-0 right-0 mt-4 mr-4 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 w-full max-w-sm">
            <div className="flex items-center">
                <h2 className="text-lg font-semibold flex-grow text-black dark:text-white">Notice</h2>
                <div className="flex justify-center ml-2">
                    <button className="text-black dark:text-white focus:outline-none" onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className="h-4 w-4">
                            <path d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8Z"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div className="flex flex-wrap mx-1 w-full transition-all duration-500 max-h-[200px] overflow-hidden">
                <div className="text-black dark:text-white">
                    {message}
                </div>
            </div>
        </div>
    );
};

// 3. Define the 'StreamingComponent' functional component that renders the 'currentLlmResponse'
const StreamingComponent = ({ currentLlmResponse }: { currentLlmResponse: string }) => {
    return (
        <>
            {currentLlmResponse && (
                <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4">
                    <div className="flex items-center">
                        <h2 className="text-lg font-semibold flex-grow dark:text-white text-black">Answer</h2>
                        <img src="./groq.png" alt="groq logo" className='w-6 h-6' />
                    </div>
                    <div className="dark:text-gray-300 text-gray-800">{currentLlmResponse}</div>
                </div>
            )}
        </>
    );
};

// 4. Define the 'LLMResponseComponent' functional component that takes 'llmResponse', 'currentLlmResponse', 'index', and 'semanticCacheKey' as props
const LLMResponseComponent = ({ llmResponse, currentLlmResponse, index, semanticCacheKey }: LLMResponseComponentProps) => {
    const { clearSemanticCache } = useActions<typeof AI>();
    const [showModal, setShowModal] = useState(false);

    // 5. Check if 'llmResponse' is not empty
    const hasLlmResponse = llmResponse && llmResponse.trim().length > 0;

    const handleClearCache = () => {
        clearSemanticCache(semanticCacheKey);
        setShowModal(true);
    };

    return (
        <>
            {showModal && (
                <Modal
                    message={`The query of '${semanticCacheKey}' has been cleared from cache. `}
                    onClose={() => setShowModal(false)}
                />
            )}

            {hasLlmResponse ? (
                <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4">
                    {/* 6. If 'llmResponse' is not empty, render a div with the 'Markdown' component */}
                    <div className="flex items-center">
                        <h2 className="text-lg font-semibold flex-grow dark:text-white text-black">Response</h2>
                    </div>
                    <div className="dark:text-gray-300 text-gray-800 markdown-container">
                        <Markdown>{llmResponse}</Markdown>
                        <div className="flex items-center justify-end">
                            <img src="./powered-by-groq.svg" alt="powered by groq" className='mt-2 h-6' />
                        </div>
                    </div>
                    <button className="text-black dark:text-white focus:outline-none" onClick={handleClearCache}>
                        Clear response from cache
                    </button>
                </div>
            ) : (
                // 7. If 'llmResponse' is empty, render the 'StreamingComponent' with 'currentLlmResponse'
                <StreamingComponent currentLlmResponse={currentLlmResponse} />
            )}
        </>
    );
};

export default LLMResponseComponent;
