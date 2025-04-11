type Props = {
    input: string;
    onInputChange: (val: string) => void;
    onSend: () => void;
  };
  
  const ChatInput = ({ input, onInputChange, onSend }: Props) => {
    return (
      <footer className="bg-black border-t border-lime-400 p-4">
        <div className="flex items-center border border-lime-400 rounded px-3 py-2">
          <input
            type="text"
            placeholder="Write something"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            className="flex-1 bg-transparent text-lime-400 outline-none placeholder-lime-600"
          />
          <button
            onClick={onSend}
            className="ml-2 bg-lime-400 text-black px-3 py-1 rounded text-sm font-bold"
          >
            ⬆
          </button>
        </div>
      </footer>
    );
  };
  
  export default ChatInput;
  
  