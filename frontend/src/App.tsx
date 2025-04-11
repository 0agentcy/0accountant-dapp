import axios from 'axios';
import { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import ChatScreen from './screens/ChatScreen';

type ChatMessage = {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
};

function App() {
  const [screen, setScreen] = useState<'landing' | 'login' | 'chat'>('landing');
  const account = useCurrentAccount();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'user',
      text: 'Help me create a savings strategy for 3 months',
      timestamp: '22:53',
    },
    {
      sender: 'ai',
      text:
        'Mr. Anderson… You have a choice. Two, in fact.\n\n' +
        '[Option 1] The Safe Construct\n' +
        'Lend USDC. Grow steadily. Minimal risk.\nDeposit $1,000, add $500 later.\n\n' +
        '[Option 2] The Looped Game\nUse SUI as collateral, borrow USDC, reinvest.\nHigher yield. Higher risk.',
      timestamp: '22:53',
    },
    {
      sender: 'user',
      text: 'Let’s go for option 1',
      timestamp: '22:54',
    },
    {
      sender: 'ai',
      text: 'Approve the transaction. I’ll handle the strategy from here.',
      timestamp: '22:54',
    },
  ]);

  useEffect(() => {
    if (screen === 'login' && account) {
      setScreen('chat');
    }
  }, [account, screen]);

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage: ChatMessage = {
      sender: 'user',
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...messages, newMessage]);
    setInput('');
    fetchAIReply(input.trim());
  };

  type Strategy = {
    name: string;
    description: string;
    risk: 'low' | 'medium' | 'high';
    actions: {
      protocol: string;
      type: string;
      token: string;
      amount: number;
    }[];
  };
  
  const [currentStrategy, setCurrentStrategy] = useState<Strategy | null>(null);
  
  const fetchAIReply = async (userPrompt: string) => {
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'mistralai/mistral-small-3.1-24b-instruct:free',
          messages: [
            {
              role: 'system',
              content: `
                You are The 0Accountant, a financial assistant AI trained to create safe, efficient DeFi strategies on the SUI blockchain. 
                When a user asks for a strategy, respond with ONLY a single JSON object, inside a code block. 
                The structure must be:

                {
                  "name": "string",
                  "description": "string",
                  "risk": "low | medium | high",
                  "actions": [
                    {
                      "protocol": "string",
                      "type": "lend | swap | loop",
                      "token": "string",
                      "amount": number
                    }
                  ]
                }

                Do not include any explanation or additional text outside the code block.
              `
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const aiReply = response.data.choices?.[0]?.message?.content || 'No response.';
      const newMessage: ChatMessage = {
        sender: 'ai',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const codeBlockMatch = aiReply.match(/```(?:json)?\s*([\s\S]*?)\s*```/);

      if (codeBlockMatch) {
        try {
          const parsed = JSON.parse(codeBlockMatch[1]);
          setCurrentStrategy(parsed);
        } catch (err) {
          console.error('Failed to parse strategy JSON:', err);
          setCurrentStrategy(null);
        }
      } else {
        setCurrentStrategy(null);
      }

      setMessages((prev) => [...prev, newMessage]);
    } catch (err) {
      console.error('AI fetch failed:', err);
      const fallback: ChatMessage = {
        sender: 'ai',
        text: 'Hmm… something went wrong. Try again, Mr. Anderson.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallback]);
    }
  };

  const handleExecuteStrategy = (strategy: Strategy) => {
    console.log('🚀 Executing strategy:', strategy);
  
    const confirmationMessage: ChatMessage = {
      sender: 'ai',
      text: `Executing "${strategy.name}". Strategy details sent to vault. Stand by, Mr. Anderson...`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  
    setMessages((prev) => [...prev, confirmationMessage]);
  };
  
  // Final render logic
  if (screen === 'landing') return <LandingScreen onLaunch={() => setScreen('login')} />;
  if (screen === 'login') return <LoginScreen onConnected={() => setScreen('chat')} />;
  if (screen === 'chat') {
    return (
      <ChatScreen
        input={input}
        messages={messages}
        onInputChange={setInput}
        onSend={handleSend}
        currentStrategy={currentStrategy}
        onExecuteStrategy={handleExecuteStrategy}
      />
    );
  }

  return null;
}

export default App;
