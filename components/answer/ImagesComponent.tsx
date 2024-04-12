// 1. Import the 'useState' hook from React
import { useState } from 'react';
import { IconPlus, IconClose } from '@/components/ui/icons';

// 2. Define the 'Image' interface with a required 'link' property and an optional 'alt' property
interface Image {
    link: string;
    alt?: string;
}

// 3. Define the 'ImagesComponentProps' interface with an 'images' property of type 'Image[]'
interface ImagesComponentProps {
    images: Image[];
}

// 4. Define the 'ImagesComponent' functional component that takes 'images' as a prop
const ImagesComponent: React.FC<ImagesComponentProps> = ({ images }) => {
    // 5. Use the 'useState' hook to manage the 'showMore' and 'selectedImage' state
    const [showMore, setShowMore] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // 6. Define the 'ImagesSkeleton' component to render a loading skeleton
    const ImagesSkeleton = () => (
        <>
            {Array.from({ length: showMore ? 9 : 3 }).map((_, index) => (
                <div key={index} className="w-1/3 p-1">
                    <div className="w-full overflow-hidden aspect-square">
                        <div className="w-full h-full bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>
                </div>
            ))}
            {/* <div className="flex justify-center mt-4 w-full">
                <div className="bg-gray-300 dark:bg-gray-700 rounded-lg animate-pulse py-5 px-15 " style={{ height: '24px', width: '85px' }}></div>
            </div> */}
        </>
    );

    // 7. Define the 'handleImageClick' function to set the 'selectedImage' state
    const handleImageClick = (link: string) => {
        setSelectedImage(link);
    };

    // 8. Define the 'handleCloseModal' function to close the modal when clicking outside
    const handleCloseModal = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            setSelectedImage(null);
        }
    };

    // 9. Render the 'ImagesComponent'
    return (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mt-4">
            <div className="flex items-center">
                <h2 className="text-lg font-semibold flex-grow text-black dark:text-white">Images</h2>
                {/* <img src="./brave.png" alt="brave logo" className="w-6 h-6" /> */}
                {images.length > 3 && (
                    <div className="flex justify-center ml-2">
                        <button
                            className="text-black dark:text-white focus:outline-none"
                            onClick={() => setShowMore(!showMore)}>
                            {showMore ? <IconClose /> : <IconPlus />}
                        </button>
                    </div>
                )}
            </div>
            <div className={`flex flex-wrap mx-1 transition-all duration-500 ${showMore ? 'max-h-[500px]' : 'max-h-[200px]'} overflow-hidden`}>
                {images.length === 0 ? (
                    // 10. Render the 'ImagesSkeleton' if there are no images
                    <ImagesSkeleton />
                ) : (
                    // 11. Render the images with a hover effect and click handler
                    images.slice(0, showMore ? 9 : 3).map((image, index) => (
                        <div
                            key={index}
                            className="transition ease-in-out hover:-translate-y-1 hover:scale-105 duration-200 w-1/3 p-1 cursor-pointer"
                            onClick={() => handleImageClick(image.link)}
                        >
                            <div className="w-full overflow-hidden aspect-square">
                                <img
                                    src={image.link}
                                    alt={image.alt || `Image ${index}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>

            {selectedImage && (
                // 13. Render a modal with the selected image if 'selectedImage' is not null
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    onClick={handleCloseModal}
                >
                    <div className="max-w-5xl max-h-full">
                        <img src={selectedImage} alt="Full size" className="max-w-full max-h-full" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImagesComponent;
