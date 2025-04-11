import { useCurrentAccount } from '@mysten/dapp-kit';

export default function ChatHeader() {
  const account = useCurrentAccount();

  return (
    <header className="bg-lime-400 text-black p-4 flex justify-between items-center">
      <div className="font-bold">
        🟢 Sui <span className="text-xs text-black/50">
          [{account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}]
        </span>
      </div>
      <div className="text-xl font-bold">The 0Accountant</div>
      <div className="text-xl">☰</div>
    </header>
  );
}
