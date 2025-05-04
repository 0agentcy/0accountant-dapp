type Props = {
    text: string;
    sender: 'user' | 'ai';
    timestamp: string;
  };

export default function MessageBubble({ text, sender, timestamp }: Props) {
  // regex to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  return (
    <div
      className={`border border-lime-400 p-3 max-w-lg rounded text-sm ${
        sender === 'user' ? 'ml-auto bg-black text-lime-400' : 'bg-lime-900/10'
      }`}
    >
      {/* for each line, split on URLs and render link or plain text */}
      {text.split('\n').map((line, i) => {
        const parts = line.split(urlRegex);
        return (
          <p key={i}>
            {parts.map((part, idx) =>
              urlRegex.test(part) ? (
                <a
                  key={idx}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-lime-600"
                >
                  {part}
                </a>
              ) : (
                <span key={idx}>{part}</span>
              )
            )}
          </p>
        );
      })}
      <div className="text-right text-xs opacity-50 mt-1">{timestamp}</div>
    </div>
  );
}
