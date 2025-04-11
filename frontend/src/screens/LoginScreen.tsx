import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';

type LoginScreenProps = {
  onConnected: () => void;
};

export default function LoginScreen({ onConnected }: LoginScreenProps) {
  return (
    <div className="min-h-screen bg-black text-lime-400 font-mono flex flex-col justify-between p-6">
      <main className="text-center">
        <h1 className="text-2xl font-bold mb-4">The 0Accountant</h1>
        <p className="mb-8">
          Welcome... to SUI DeFi, Mr. Anderson.<br />
          To commence your so-called journey... connect your wallet.<br />
          <span className="italic">It’s inevitable_</span>
        </p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </main>
    </div>
  );
}
