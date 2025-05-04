import { useCurrentAccount } from '@mysten/dapp-kit';
import MessageBubble from '../components/MessageBubble';
import ChatHeader from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';

type ChatMessage = {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
};

type ChatScreenProps = {
  input: string;
  messages: ChatMessage[];
  onInputChange: (value: string) => void;
  onSend: () => void;
  currentStrategy: Strategy | null;
  onExecuteStrategy: (strategy: Strategy) => void;
  onSimulateStrategy: (strategy: Strategy) => void;
};

export default function ChatScreen({
  input,
  messages,
  onInputChange,
  onSend,
  currentStrategy,
  onExecuteStrategy,
  onSimulateStrategy,
}: ChatScreenProps) {
  const account = useCurrentAccount();

  return (
    <div className="min-h-screen bg-black text-lime-400 font-mono flex flex-col">
      <ChatHeader />

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            text={msg.text}
            sender={msg.sender}
            timestamp={msg.timestamp}
          />
        ))}
      </div>

      {currentStrategy && (
        <div className="border border-lime-400 p-4 rounded-md bg-black mb-4">
            <h2 className="text-xl font-bold text-lime-300 mb-2">{currentStrategy.name}</h2>
            <p className="mb-2">{currentStrategy.description}</p>
            <p className="mb-4">
            <strong>Risk:</strong> <span className="capitalize">{currentStrategy.risk}</span>
            </p>

            <div className="space-y-2">
            {currentStrategy.actions.map((action, index) => (
                <div
                key={index}
                className="border border-lime-600 p-2 rounded text-sm"
                >
                <strong>Action {index + 1}:</strong><br />
                Protocol: {action.protocol} <br />
                Type: {action.type} <br />
                Token: {action.token} <br />
                Amount: {action.amount}
                </div>
            ))}
            </div>

            <div className="mt-4 flex space-x-2">
              <button
                className="flex-1 bg-transparent border border-lime-400 text-lime-400 font-semibold px-4 py-2 rounded-md hover:bg-lime-400 hover:text-black transition"
                onClick={() => onSimulateStrategy(currentStrategy)}
              >
                Simulate Strategy
              </button>
              <button
                className="flex-1 bg-lime-400 text-black font-bold px-4 py-2 rounded-md hover:opacity-90 transition"
                onClick={() => onExecuteStrategy(currentStrategy)}
              >
                Execute Strategy
              </button>
            </div>
        </div>
        )}

      <ChatInput
        input={input}
        onInputChange={onInputChange}
        onSend={onSend}
      />
    </div>
  );
}

