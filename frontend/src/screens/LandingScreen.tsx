type LandingScreenProps = {
    onLaunch: () => void;
  };
  
  export default function LandingScreen({ onLaunch }: LandingScreenProps) {
    return (
      <div className="min-h-screen bg-black text-lime-400 font-mono flex flex-col justify-between p-6">
        <main className="flex flex-col items-center text-center gap-4">
          <h1 className="text-3xl font-bold">The 0Accountant</h1>
          <p className="max-w-md">
            Create and generate DeFi strategies on SUI.<br />
            AI the frontend of crypto.
          </p>
  
          <pre className="text-xs leading-tight mt-4">
  {`
        .--.
       |o_o |
       |:_/ |
      //   \\\\ \\\\
     (|     | )
    /'\\\\_   _/\\\\\`
    \\\\___)=(___/
  `}
          </pre>
  
          <div className="flex gap-4 mt-6">
            <button
              className="bg-lime-400 text-black font-bold py-2 px-4 rounded-md"
              onClick={onLaunch}
            >
              Launch the App
            </button>
            <button
              className="border border-lime-400 text-lime-400 py-2 px-4 rounded-md"
              onClick={() => window.open('https://x.com/yourprofile', '_blank')}
            >
              Follow on X
            </button>
          </div>
        </main>
  
        <footer className="text-right text-sm mt-10">
          <p className="opacity-75">Built on:</p>
          <p className="font-bold">SUI</p>
        </footer>
      </div>
    );
  }
  