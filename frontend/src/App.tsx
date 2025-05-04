import axios from 'axios';
import { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import ChatScreen from './screens/ChatScreen';
import { executeStrategy, TOKEN_DECIMALS } from './api/strategy';

type ChatMessage = {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
};

function App() {
  const [dryRunMode] = useState<boolean>(true);
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

  async function handleExecuteStrategyBase(strategy: Strategy, dryRun: boolean) {
    // 1️⃣ show a “sending…” message
    setMessages(prev => [
      ...prev,
      {
        sender: 'ai',
        text: `🕑 Sending your "${strategy.name}" strategy to the vault…`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    
    // 2️⃣ compute integer amount in smallest units
    const action = strategy.actions[0];
    const decimals = TOKEN_DECIMALS[action.token] ?? 0;
    const humanAmount = action.amount; // the user‐facing float
    const intAmount = BigInt(
      Math.round(humanAmount * 10 ** decimals)
    );

    // 3️⃣ call your backend
    try {
      const resp = await executeStrategy(
        action.token,
        intAmount,
        dryRunMode
      );
    
    // 4️⃣ build the result text
    let resultText: string;
    if (resp.status === 'error') {
      resultText = `❌ ${dryRun ? 'Simulation' : 'Execution'} failed: ${resp.message}`;
    } else if (resp.mode === 'live') {
      resultText = `✅ On-chain! Tx digest: ${resp.digest}`;
    } else {
      // dryRun case
      resultText =
        `🛠 Dry-run OK: ${resp.dryRunStatus}` +
        `\nCreated: ${resp.created.map(o => o.id).join(', ')}`;
    }
  
  
      // 3️⃣ show final status
      const resultMessage: ChatMessage = {
        sender: 'ai',
        text: resultText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, resultMessage]);
    } catch (err: any) {

      const backendMessage = err.response?.data?.message ?? err.message;

      const errorMessage: ChatMessage = {
        sender: 'ai',
        text: `❌ Execution failed: ${backendMessage}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };  
  const handleExecuteStrategy = (s: Strategy) => handleExecuteStrategyBase(s, false);
  const handleSimulateStrategy = (s: Strategy) => handleExecuteStrategyBase(s, true);

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
          onSimulateStrategy={handleSimulateStrategy}
        />
    );
  }

  return null;
}

export default App;
