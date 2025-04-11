type Props = {
    text: string;
    sender: 'user' | 'ai';
    timestamp: string;
  };
  
  const MessageBubble = ({ text, sender, timestamp }: Props) => {
    return (
      <div
        className={`border border-lime-400 p-3 max-w-lg rounded text-sm ${
          sender === 'user' ? 'ml-auto bg-black' : 'bg-lime-900/10'
        }`}
      >
        {text.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        <div className="text-right text-xs opacity-50 mt-1">{timestamp}</div>
      </div>
    );
  };
  
  export default MessageBubble;  