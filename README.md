# Perplexity-Inspired LLM Answer Engine

![](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmJ0ZnhmNjkwYzczZDlqZzM1dDRka2k1MGx6dW02ZHl5dzV0aGQwMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/mluzeYSMGoAnSXg0ft/giphy.gif)

This repository contains the code and instructions needed to build a sophisticated answer engine that leverages the capabilities of [Groq](https://www.groq.com/), [Mistral AI's Mixtral](https://mistral.ai/news/mixtral-of-experts/), [Langchain.JS](https://js.langchain.com/docs/), [Brave Search](https://search.brave.com/), [Serper API](https://serper.dev/), and [OpenAI](https://openai.com/). Designed to efficiently return sources, answers, images, videos, and follow-up questions based on user queries, this project is an ideal starting point for developers interested in natural language processing and search technologies.

## Technologies Used

- **Next.js**: A React framework for building server-side rendered and static web applications.
- **Tailwind CSS**: A utility-first CSS framework for rapidly building custom user interfaces.
- **Vercel AI SDK**: The Vercel AI SDK is a library for building AI-powered streaming text and chat UIs.
- **Groq & Mixtral**: Technologies for processing and understanding user queries.
- **Langchain.JS**: A JavaScript library focused on text operations, such as text splitting and embeddings.
- **Brave Search**: A privacy-focused search engine used for sourcing relevant content and images.
- **Serper API**: Used for fetching relevant video and image results based on the user's query.
- **OpenAI Embeddings**: Used for creating vector representations of text chunks.
- **Cheerio**: Utilized for HTML parsing, allowing the extraction of content from web pages.

## Getting Started

### Prerequisites

- Ensure Node.js and npm are installed on your machine.
- Obtain API keys from OpenAI, Groq, Brave Search, and Serper.

### Obtaining API Keys

- **OpenAI API Key**: [Generate your OpenAI API key here](https://platform.openai.com/account/api-keys).
- **Groq API Key**: [Get your Groq API key here](https://console.groq.com/keys).
- **Brave Search API Key**: [Obtain your Brave Search API key here](https://brave.com/search/api/).
- **Serper API Key**: [Get your Serper API key here](https://serper.dev/).

### Installation

1. Clone the repository:
    ```
    git clone https://github.com/yourusername/perplexity-inspired-llm-answer-engine.git
    ```
2. Install the required dependencies:
    ```
    npm install
    ```
    or
    ```
    bun install
    ```
3. Create a `.env` file in the root of your project and add your API keys:
    ```
    OPENAI_API_KEY=your_openai_api_key
    GROQ_API_KEY=your_groq_api_key
    BRAVE_SEARCH_API_KEY=your_brave_search_api_key
    SERPER_API=your_serper_api_key

    ```

### Running the Server

To start the server, execute:
```
npm run dev
```
or
```
bun run dev
```

the server will be listening on the specified port.


### Ollama Support

Since this is set up with the OpenAI SDK, you can easily swap out most parts of the code to use Ollama instead.
To get started, 

1. Swap the endpoint from Groq to your Ollama localhost
2. Change the model string to one you have installed. 
3. Finally use ‘ollama’ as API key 🔑

More info: https://ollama.com/blog/openai-compatibility


### Backend + Node Only Express API

![Build a Perplexity-Inspired Answer Engine Using Groq, Mixtral, Langchain, Brave & OpenAI in 10 Min](https://img.youtube.com/vi/43ZCeBTcsS8/0.jpg)

In addition to the Next.JS version of the project, there is a backend only version that uses Node.js and Express. Which is located in the 'original-express-api' directory. This is a standalone version of the project that can be used as a reference for building a similar API. There is also a readme file in the 'original-express-api' directory that explains how to run the backend version.

[Watch the tutorial here](https://youtu.be/43ZCeBTcsS8) for a detailed guide on setting up and running this project. The video covers every step of the process, from API key acquisition to server deployment.

## Contributing

Contributions to the project are welcome. Feel free to fork the repository, make your changes, and submit a pull request. You can also open issues to suggest improvements or report bugs.


## License

This project is licensed under the MIT License.

I'm the developer behind Developers Digest. If you find my work helpful or enjoy what I do, consider supporting me. Here are a few ways you can do that:

- **Patreon**: Support me on Patreon at [patreon.com/DevelopersDigest](https://www.patreon.com/DevelopersDigest)
- **Buy Me A Coffee**: You can buy me a coffee at [buymeacoffee.com/developersdigest](https://www.buymeacoffee.com/developersdigest)
- **Website**: Check out my website at [developersdigest.tech](https://developersdigest.tech)
- **Github**: Follow me on GitHub at [github.com/developersdigest](https://github.com/developersdigest)
- **Twitter**: Follow me on Twitter at [twitter.com/dev__digest](https://twitter.com/dev__digest)