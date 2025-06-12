import React from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { QRCodeSVG } from 'qrcode.react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { formatWalletAddress } from '@/utils/format';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

const AddFunds = () => {
    const { address } = useAccount();
    const { data: balance } = useBalance({
        address,
    });

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Wallet address copied to clipboard');
        } catch (err) {
            toast.error('Failed to copy wallet address');
        }
    };

    if (!address) return null;

    return (
        <div className="flex flex-col items-center gap-4 p-4">
            <DialogHeader className="text-center">
                <DialogTitle>Add Funds</DialogTitle>
                <DialogDescription>
                    Scan this QR code to send funds to your wallet
                </DialogDescription>
            </DialogHeader>

            <div className="text-center space-y-2">
                {balance && (
                    <>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 mb-1">Your balance</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {parseFloat(formatUnits(balance.value, 18)).toFixed(4)} {balance.symbol}
                            </p>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white p-4 rounded-lg shadow-lg">
                <QRCodeSVG
                    value={address}
                    size={200}
                    level="H"
                    includeMargin={true}
                />
                <div className="flex items-center justify-center gap-2">
                    <p className="text-sm text-gray-600">
                        {formatWalletAddress(address)}
                    </p>
                    <button
                        onClick={() => copyToClipboard(address)}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        title="Copy address"
                    >
                        <Copy className="h-4 w-4 text-gray-500" />
                    </button>
                </div>
            </div>


        </div>
    );
};

export { AddFunds };