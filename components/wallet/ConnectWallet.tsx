import React, { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { EvmServerAccount } from "@coinbase/cdp-sdk";
import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { formatWalletAddress } from '@/utils/format';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Copy, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatUnits } from 'viem';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { AddFunds } from './AddFunds';

const ConnectWallet = () => {

    const { isConnected, address } = useAccount();
    const { disconnect } = useDisconnect();
    const { data: balance } = useBalance({
        address,
    });
    const [wallet, setWallet] = useState<EvmServerAccount | null>(null);
    const [loading, setLoading] = useState(false);

    const handleJoinPlatform = async (address: `0x${string}`) => {

        console.log("handleJoinPlatform", address)
        try {
            setLoading(true);
            const res = await fetch("/api/fetchWallet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address })
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch wallet: ${res.statusText}`);
            }

            const data = await res.json();
            setWallet(data.wallet);
            toast.success('Successfully connected wallet');
        } catch (error) {
            console.error('Error connecting wallet:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to connect wallet');
            setWallet(null);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Wallet address copied to clipboard');
        } catch (err) {
            toast.error('Failed to copy wallet address');
        }
    };

    useEffect(() => {
        if (isConnected && address) {
            handleJoinPlatform(address)
        }
    }, [isConnected, address])

    if (!isConnected) {
        return (
            <ConnectButton />
        )
    }

    return (
        <div>
            {loading ? (
                <div className="flex items-center gap-2 mt-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Connecting wallet...</span>
                </div>
            ) : wallet && (
                <div className="flex items-center gap-4">
                    {balance && (
                        <div className="text-sm text-gray-600">
                            {parseFloat(formatUnits(balance.value, 18)).toFixed(3)} {balance.symbol}
                        </div>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger className='rounded-lg px-4 py-2 bg-blue-600 text-white cursor-pointer'>
                            {formatWalletAddress(wallet.address)}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => copyToClipboard(wallet.address)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Address
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <Dialog>
                                    <DialogTrigger onClick={(e) => e.stopPropagation()}>Add Funds</DialogTrigger>
                                    <DialogContent>
                                        <AddFunds />
                                    </DialogContent>
                                </Dialog>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => disconnect()}
                                className="text-red-600"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Disconnect
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
    );
};

export { ConnectWallet };