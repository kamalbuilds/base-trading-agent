import { CdpClient } from "@coinbase/cdp-sdk";
import { NextRequest, NextResponse } from "next/server";

const cdp = new CdpClient();

export async function POST(req: NextRequest) {
    const { address } = await req.json();

    if (!address || typeof address !== "string") {
        return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    try {
        const name = address.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 36).replace(/^-+|-+$/g, "");
        const account = await cdp.evm.getOrCreateAccount({ name });
        console.log("account", account);
        return NextResponse.json({ wallet: account });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}