// 1. Define the 'ImageProps' interface with optional 'src' and 'query' properties
interface ImageProps {
    src?: string;
    query?: string;
}

// 2. Define the 'Image' functional component that takes 'src' and 'query' as props
export default function Image({ src, query }: ImageProps) {
    // 3. Render the 'Image' component
    return (
        <div className="flex flex-col max-w-[1200px] mx-auto px-4">
            <div className="flex flex-col items-center max-w-[1200px] max-h-full shadow-lg p-4 mt-4 rounded-lg relative">
                {!src ? (
                    // 4. Render the skeleton loader only for the image
                    <div className="w-full h-[300px] md:h-[600px] bg-gray-300 rounded-lg animate-pulse mb-4"></div>
                ) : (
                    <img
                        src={src}
                        alt="Full size"
                        className="w-full h-[300px] md:h-[600px] rounded-lg mb-4"
                    />
                )}
                <div className="flex-1 flex flex-col justify-center items-center">
                    {query && (
                        <div className="text-black text-xl font-bold mb-4">
                            {query}
                        </div>
                    )}
                </div>
                <div className="flex justify-between items-center w-full">
                    <div className="flex-1"></div>
                    <div>
                        <img
                            src="./fal.svg"
                            alt="powered by fal.ai"
                            className="h-6"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}