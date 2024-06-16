// @mentionFunctions 
import { streamChatCompletion } from './mentionFunctions/streamChatCompletion';
import { portKeyAIGateway } from './mentionFunctions/portKeyAIGateway';
import { portKeyAIGatewayTogetherAI } from './mentionFunctions/portKeyAIGatewayTogetherAI';
import { falAiStableDiffusion3Medium } from './mentionFunctions/falAiStableDiffusion3Medium';

type MentionFunctions = {
    [key: string]: (mentionTool: string, userMessage: string, streamable: any) => Promise<string | undefined>;
};

export const mentionFunctions: MentionFunctions = {
    streamChatCompletion,
    portKeyAIGateway,
    portKeyAIGatewayTogetherAI,
    falAiStableDiffusion3Medium
};