// 1. Defines the FollowUp interface with a 'choices' property that contains an array of objects with a 'message' property, which in turn has a 'content' property of type string.
interface FollowUp {
    choices: {
        message: {
            content: string;
        };
    }[];
}

// 2. Defines the FollowUpComponent functional component that takes 'followUp' and 'handleFollowUpClick' as props.
const FollowUpComponent = ({ followUp, handleFollowUpClick }: { followUp: FollowUp; handleFollowUpClick: (question: string) => void }) => {
    // 3. Defines the 'handleQuestionClick' function that calls the 'handleFollowUpClick' function with the 'question' argument.
    const handleQuestionClick = (question: string) => {
        handleFollowUpClick(question);
    };

    // 4. Returns the JSX for the FollowUpComponent.
    return (
        <div className="bg-white shadow-lg rounded-lg p-4 mt-4">
            <div className="flex items-center">
                <h2 className="text-lg font-semibold flex-grow">Relevant</h2>
                <img src="./mistral.png" alt="mistral logo" className='w-6 h-6 mr-2' />
                <img src="./groq.png" alt="groq logo" className='w-6 h-6' />
            </div>
            <ul className="mt-2">
                {/* Maps over the parsed 'followUp' content and renders a list item for each question. */}
                {followUp.choices[0].message.content && JSON.parse(followUp.choices[0].message.content).followUp.map((question: string, index: number) => (
                    <li
                        key={index}
                        className="flex items-center mt-2 cursor-pointer"
                        onClick={() => handleQuestionClick(question)}
                    >
                        <span role="img" aria-label="link" className="mr-2">🔗</span>
                        <p className="text-black hover:underline">{`${question}`}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FollowUpComponent;