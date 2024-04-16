'use client';
// 1. Import Dependencies
import { FormEvent, useEffect, useRef, useState, useCallback, use } from 'react';
import { useActions, readStreamableValue } from 'ai/rsc';
import { type AI } from './action';
import { ChatScrollAnchor } from '@/lib/hooks/chat-scroll-anchor';
import Textarea from 'react-textarea-autosize';
import { useEnterSubmit } from '@/lib/hooks/use-enter-submit';
import { Tooltip, TooltipContent, TooltipTrigger, } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
// Main components 
import SearchResultsComponent from '@/components/answer/SearchResultsComponent';
import UserMessageComponent from '@/components/answer/UserMessageComponent';
import FollowUpComponent from '@/components/answer/FollowUpComponent';
import InitialQueries from '@/components/answer/InitialQueries';
// Sidebar components
import LLMResponseComponent from '@/components/answer/LLMResponseComponent';
import ImagesComponent from '@/components/answer/ImagesComponent';
import VideosComponent from '@/components/answer/VideosComponent';
// Function calling components
const MapComponent = dynamic(() => import('@/components/answer/Map'), { ssr: false, });
import MapDetails from '@/components/answer/MapDetails';
import ShoppingComponent from '@/components/answer/ShoppingComponent';
import FinancialChart from '@/components/answer/FinancialChart';
import { ArrowUp } from '@phosphor-icons/react';

// 2. Set up types
interface SearchResult {
  favicon: string;
  link: string;
  title: string;
}
interface Message {
  id: number;
  type: string;
  content: string;
  userMessage: string;
  images: Image[];
  videos: Video[];
  followUp: FollowUp | null;
  isStreaming: boolean;
  searchResults?: SearchResult[];
  conditionalFunctionCallUI?: any;
  places?: Place[];
  shopping?: Shopping[];
  ticker?: string | undefined;
}
interface StreamMessage {
  searchResults?: any;
  userMessage?: string;
  llmResponse?: string;
  llmResponseEnd?: boolean;
  images?: any;
  videos?: any;
  followUp?: any;
  conditionalFunctionCallUI?: any;
  places?: Place[];
  shopping?: Shopping[];
  ticker?: string;
}
interface Image {
  link: string;
}
interface Video {
  link: string;
  imageUrl: string;
}
interface Place {
  cid: React.Key | null | undefined;
  latitude: number;
  longitude: number;
  title: string;
  address: string;
  rating: number;
  category: string;
  phoneNumber?: string;
  website?: string;
}
interface FollowUp {
  choices: {
    message: {
      content: string;
    };
  }[];
}
interface Shopping {
  type: string;
  title: string;
  source: string;
  link: string;
  price: string;
  shopping: any;
  position: number;
  delivery: string;
  imageUrl: string;
  rating: number;
  ratingCount: number;
  offers: string;
  productId: string;
}


export default function Page() {
  // 3. Set up action that will be used to stream all the messages
  const { myAction } = useActions<typeof AI>();
  // 4. Set up form submission handling
  const { formRef, onKeyDown } = useEnterSubmit();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');
  // 5. Set up state for the messages
  const [messages, setMessages] = useState<Message[]>([]);
  // 6. Set up state for the CURRENT LLM response (for displaying in the UI while streaming)
  const [currentLlmResponse, setCurrentLlmResponse] = useState('');
  // 7. Set up handler for when the user clicks on the follow up button
  const handleFollowUpClick = useCallback(async (question: string) => {
    setCurrentLlmResponse('');
    await handleUserMessageSubmission(question);
  }, []);
  // 8. For the form submission, we need to set up a handler that will be called when the user submits the form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        if (
          e.target &&
          ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).nodeName)
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
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputRef]);
  // 9. Set up handler for when a submission is made, which will call the myAction function
  const handleSubmit = async (message: string) => {
    if (!message) return;
    await handleUserMessageSubmission(message);
  };
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const messageToSend = inputValue.trim();
    if (!messageToSend) return;
    setInputValue('');
    await handleSubmit(messageToSend);
  };
  const handleUserMessageSubmission = async (userMessage: string): Promise<void> => {
    console.log('handleUserMessageSubmission', userMessage);
    const newMessageId = Date.now();
    const newMessage = {
      id: newMessageId,
      type: 'userMessage',
      userMessage: userMessage,
      content: '',
      images: [],
      videos: [],
      followUp: null,
      isStreaming: true,
      searchResults: [] as SearchResult[],
      places: [] as Place[],
      shopping: [] as Shopping[],
      ticker: undefined,
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    let lastAppendedResponse = "";
    try {
      const streamableValue = await myAction(userMessage);
      let llmResponseString = "";
      for await (const message of readStreamableValue(streamableValue)) {
        const typedMessage = message as StreamMessage;
        setMessages((prevMessages) => {
          const messagesCopy = [...prevMessages];
          const messageIndex = messagesCopy.findIndex(msg => msg.id === newMessageId);
          if (messageIndex !== -1) {
            const currentMessage = messagesCopy[messageIndex];
            if (typedMessage.llmResponse && typedMessage.llmResponse !== lastAppendedResponse) {
              currentMessage.content += typedMessage.llmResponse;
              lastAppendedResponse = typedMessage.llmResponse;
            }
            if (typedMessage.llmResponseEnd) {
              currentMessage.isStreaming = false;
            }
            if (typedMessage.searchResults) {
              currentMessage.searchResults = typedMessage.searchResults;
            }
            if (typedMessage.images) {
              currentMessage.images = [...typedMessage.images];
            }
            if (typedMessage.videos) {
              currentMessage.videos = [...typedMessage.videos];
            }
            if (typedMessage.followUp) {
              currentMessage.followUp = typedMessage.followUp;
            }
            // Optional Function Calling + Conditional UI
            if (typedMessage.conditionalFunctionCallUI) {
              const functionCall = typedMessage.conditionalFunctionCallUI;
              if (functionCall.type === 'places') {
                currentMessage.places = functionCall.places;
              }
              if (functionCall.type === 'shopping') {
                currentMessage.shopping = functionCall.shopping;
              }
              if (functionCall.type === 'ticker') {
                console.log('ticker', functionCall);
                currentMessage.ticker = functionCall.data;
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
    <div>
      {messages.length > 0 && (
        <div className="flex flex-col">
          {messages.map((message, index) => (
            <div key={`message-${index}`} className="flex flex-col md:flex-row">
              <div className="w-full md:w-3/4 md:pr-2">
                {message.type === 'userMessage' && <UserMessageComponent message={message.userMessage} />}
                {message.ticker && message.ticker.length > 0 && (
                  <FinancialChart key={`financialChart-${index}`} ticker={message.ticker} />
                )}
                {message.searchResults && (<SearchResultsComponent key={`searchResults-${index}`} searchResults={message.searchResults} />)}
                {message.places && message.places.length > 0 && (
                  <MapComponent key={`map-${index}`} places={message.places} />
                )}
                <LLMResponseComponent llmResponse={message.content} currentLlmResponse={currentLlmResponse} index={index} key={`llm-response-${index}`}
                />
                {message.followUp && (
                  <div className="flex flex-col">
                    <FollowUpComponent key={`followUp-${index}`} followUp={message.followUp} handleFollowUpClick={handleFollowUpClick} />
                  </div>
                )}
              </div>
              {/* Secondary content area */}
              <div className="w-full md:w-1/4 md:pl-2">
                {message.shopping && message.shopping.length > 0 && <ShoppingComponent key={`shopping-${index}`} shopping={message.shopping} />}
                {message.videos && <VideosComponent key={`videos-${index}`} videos={message.videos} />}
                {message.images && <ImagesComponent key={`images-${index}`} images={message.images} />}
                {message.places && message.places.length > 0 && (
                  <MapDetails key={`map-${index}`} places={message.places} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={`px-2 fixed inset-x-0 bottom-0 w-full bg-gradient-to-b duration-300 ease-in-out animate-in dark:from-gray-900/10 dark:from-10% peer-[[data-state=open]]:group-[]:lg:pl-[250px] peer-[[data-state=open]]:group-[]:xl:pl-[300px]] mb-4 bring-to-front`}>
        <div className="mx-auto max-w-xl sm:px-4 ">
          {messages.length === 0 && (
            <InitialQueries questions={['How is apple\'s stock doing these days?', 'Where can I get the best bagel in NYC?', 'I want to buy a mens patagonia vest']} handleFollowUpClick={handleFollowUpClick} />
          )}
          <form
            ref={formRef}
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              handleFormSubmit(e);
              setCurrentLlmResponse('');
              if (window.innerWidth < 600) {
                (e.target as HTMLFormElement)['message']?.blur();
              }
              const value = inputValue.trim();
              setInputValue('');
              if (!value) return;
            }}
          >
            <div className="relative flex flex-col w-full overflow-hidden max-h-60 grow dark:bg-slate-800 bg-gray-100 rounded-md border sm:px-2">
              <Textarea
                ref={inputRef}
                tabIndex={0}
                onKeyDown={onKeyDown}
                placeholder="Send a message."
                className="w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm dark:text-white text-black pr-[45px]"
                autoFocus
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                name="message"
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <ChatScrollAnchor trackVisibility={true} />
              <div className="absolute right-5 top-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="submit" size="icon" disabled={inputValue === ''}>
                      <ArrowUp />
                      <span className="sr-only">Send message</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send message</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </form>
        </div>
      </div>
      <div className="pb-[80px] pt-4 md:pt-10"></div>
    </div>
  );
};