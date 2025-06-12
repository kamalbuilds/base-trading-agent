/**
 * Formats a wallet address to show only a specified number of characters at the start and end
 * @param address The wallet address to format
 * @param visibleChars Number of characters to show at start and end
 * @returns Formatted address string (e.g., "0x1234...5678")
 */
export const formatWalletAddress = (address: string, visibleChars: number = 5): string => {
    if (!address) return '';
    if (address.length <= visibleChars * 2) return address;

    const start = address.slice(0, visibleChars);
    const end = address.slice(-visibleChars);
    return `${start}...${end}`;
}; 